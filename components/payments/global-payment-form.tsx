"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Check, ChevronsUpDown, Loader2, AlertCircle, CheckCircle2, DollarSign, Calendar, CreditCard, FileText, Info } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

interface GlobalPaymentFormProps {
    companyId: string
    onPaymentSuccess: () => void
    onCustomerSelect?: (customerId: string) => void
}

export function GlobalPaymentForm({ companyId, onPaymentSuccess, onCustomerSelect }: GlobalPaymentFormProps) {
    const supabase = createClient()
    const [isLoading, setIsLoading] = useState(false)
    const [customers, setCustomers] = useState<any[]>([])
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Form State
    const [selectedCustomerId, setSelectedCustomerId] = useState("")
    const [amount, setAmount] = useState<number>(0)
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [method, setMethod] = useState<string>("VIREMENT")
    const [notes, setNotes] = useState<string>("")

    // Result State
    const [result, setResult] = useState<any>(null)
    const [customerBalance, setCustomerBalance] = useState<number | null>(null)

    // Fetch Customers on mount
    useEffect(() => {
        const fetchCustomers = async () => {
            if (!companyId) return
            const { data } = await supabase
                .from("customers")
                .select("id, name")
                .eq("company_id", companyId)
                .order("name")

            if (data) setCustomers(data)
        }
        fetchCustomers()
    }, [companyId, supabase])

    // Fetch Balance when customer changes
    useEffect(() => {
        const fetchBalance = async () => {
            if (!selectedCustomerId) {
                setCustomerBalance(null)
                return
            }
            // We can reuse calculate_customer_balance or just fetch it if stored. 
            // For now let's just use the RPC which is reliable.
            const { data, error } = await supabase.rpc('calculate_customer_balance', { p_customer_id: selectedCustomerId })
            if (!error) setCustomerBalance(data)
        }
        fetchBalance()
    }, [selectedCustomerId, supabase])

    // Avoir Mode State
    const [transactionType, setTransactionType] = useState<"PAYMENT" | "AVOIR">("PAYMENT")

    const handleReset = () => {
        setAmount(0)
        setNotes("")
        setResult(null)
        // Keep customer selected
    }

    const handleSave = async () => {
        if (!selectedCustomerId) {
            toast.error("Veuillez sélectionner un client")
            return
        }
        if (!amount || amount <= 0) {
            toast.error("Veuillez saisir un montant valide")
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            // If AVOIR, force method to 'AVOIR'
            // If PAYMENT, use selected method
            const finalMethod = transactionType === "AVOIR" ? "AVOIR" : method

            // Call the RPC function (v2)
            const { data, error } = await supabase.rpc('record_global_payment', {
                p_customer_id: selectedCustomerId,
                p_amount: amount,
                p_payment_method: finalMethod,
                p_notes: notes,
                p_date: date
            })

            if (error) throw error

            setResult(data)
            toast.success(transactionType === "AVOIR" ? "Avoir enregistré avec succès" : "Paiement enregistré avec succès")
            onPaymentSuccess()

            // Refresh balance
            const { data: newBalance } = await supabase.rpc('calculate_customer_balance', { p_customer_id: selectedCustomerId })
            setCustomerBalance(newBalance)

        } catch (error: any) {
            console.error("Payment error:", error)
            toast.error("Erreur: " + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (!isMounted) return null

    if (result) {
        return (
            <Card className="border-l-4 border-l-emerald-500 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                        {transactionType === "AVOIR" ? "Avoir Enregistré !" : "Paiement enregistré !"}
                    </CardTitle>
                    <CardDescription>
                        {transactionType === "AVOIR" ? "L'avoir de" : "Le paiement de"} <strong>{amount.toFixed(3)} TND</strong> a été traité avec succès.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-lg">
                        <div>
                            <span className="text-muted-foreground block">Montant Total</span>
                            <span className="font-bold text-lg">{amount.toFixed(3)} <span className="text-xs font-normal">TND</span></span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-right">Montant Alloué</span>
                            <span className="font-bold text-lg text-emerald-600 block text-right">{result.total_paid.toFixed(3)} <span className="text-xs font-normal">TND</span></span>
                        </div>
                        {result.remaining_unallocated > 0.001 && (
                            <div className="col-span-2 pt-2 border-t mt-2 flex justify-between">
                                <span className="text-orange-600 font-medium">Non alloué (Solde Créditeur)</span>
                                <span className="font-bold text-orange-600">{result.remaining_unallocated.toFixed(3)} TND</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Affectations (FIFO)</h4>
                        <div className="border rounded-md overflow-hidden bg-background">
                            {result.allocations && result.allocations.length > 0 ? (
                                <table className="w-full text-xs">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="text-left p-2 font-medium">Type</th>
                                            <th className="text-left p-2 font-medium">Référence</th>
                                            <th className="text-right p-2 font-medium">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {result.allocations.map((alloc: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">{alloc.document_type === 'INVOICE' ? 'Facture' : 'BL'}</td>
                                                <td className="p-2 font-medium">{alloc.reference}</td>
                                                <td className="p-2 text-right font-mono">{alloc.amount_paid.toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground italic text-xs">
                                    Le montant a été ajouté au solde créditeur du client (aucun document en attente).
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleReset} className="w-full">
                        {transactionType === "AVOIR" ? "Nouvel Avoir" : "Nouveau Paiement"}
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="shadow-lg border-l-4 border-l-primary h-full">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Nouvelle Transaction
                </CardTitle>
                <CardDescription>
                    Enregistrer un encaissement ou un avoir client.
                </CardDescription>

                {/* TYPE TOGGLE */}
                <div className="flex p-1 bg-muted rounded-lg mt-4">
                    <button
                        onClick={() => setTransactionType("PAYMENT")}
                        className={cn(
                            "flex-1 text-sm font-medium py-2 rounded-md transition-all",
                            transactionType === "PAYMENT"
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Encaissement
                    </button>
                    <button
                        onClick={() => setTransactionType("AVOIR")}
                        className={cn(
                            "flex-1 text-sm font-medium py-2 rounded-md transition-all",
                            transactionType === "AVOIR"
                                ? "bg-background text-emerald-600 shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Avoir / Avance
                    </button>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">

                {/* CUSTOMER SELECTION */}
                <div className="space-y-2">
                    <Label className="text-base">Client</Label>
                    <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCustomerCombobox}
                                className="w-full justify-between h-12 text-base"
                            >
                                {selectedCustomerId
                                    ? customers.find((c) => c.id === selectedCustomerId)?.name
                                    : "Rechercher un client..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0">
                            <Command>
                                <CommandInput placeholder="Rechercher..." />
                                <CommandList>
                                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                                    <CommandGroup>
                                        {customers.map((c) => (
                                            <CommandItem
                                                key={c.id}
                                                value={c.name}
                                                onSelect={() => {
                                                    setSelectedCustomerId(c.id)
                                                    if (onCustomerSelect) onCustomerSelect(c.id)
                                                    setOpenCustomerCombobox(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {c.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {customerBalance !== null && (
                        <div className={cn(
                            "text-sm font-medium px-3 py-2 rounded-md flex justify-between items-center border",
                            customerBalance > 0 ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        )}>
                            <span>Solde actuel :</span>
                            <span className="text-lg font-bold">{customerBalance.toFixed(3)} TND</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Montant (TND)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.001"
                                className="pl-10 h-12 text-lg font-bold"
                                placeholder="0.000"
                                value={amount === 0 ? "" : amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="date"
                                className="pl-10 h-12"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {transactionType === "PAYMENT" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Mode de Paiement</Label>
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ESPECES">Espèces</SelectItem>
                                    <SelectItem value="CHEQUE">Chèque</SelectItem>
                                    <SelectItem value="VIREMENT">Virement</SelectItem>
                                    <SelectItem value="TRAITE">Traite</SelectItem>
                                    <SelectItem value="CARTE_BANCAIRE">Carte Bancaire</SelectItem>
                                    <SelectItem value="AUTRE">Autre</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Référence / Notes</Label>
                            <Input
                                placeholder="Ex: Chèque n°123456"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-10"
                            />
                        </div>
                    </div>
                )}

                {transactionType === "AVOIR" && (
                    <div className="space-y-2">
                        <Label>Motif de l'Avoir / Notes</Label>
                        <Input
                            placeholder="Ex: Retour marchandise, Geste commercial..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-10 bg-emerald-50/50 border-emerald-100"
                        />
                    </div>
                )}


                <Alert className={cn(
                    "border-l-4",
                    transactionType === "AVOIR"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-blue-50 border-blue-500 text-blue-800"
                )}>
                    <Info className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold uppercase mb-1">
                        {transactionType === "AVOIR" ? "Mode Avoir Client" : "Mode Encaissement"}
                    </AlertTitle>
                    <AlertDescription className="text-xs opacity-90">
                        {transactionType === "AVOIR"
                            ? "Ce montant sera déduit de la dette du client. S'il ne doit rien, cela créera un solde créditeur (avance) en sa faveur."
                            : "Ce paiement sera utilisé pour régler les factures et BL impayés les plus anciens (FIFO)."
                        }
                    </AlertDescription>
                </Alert>

            </CardContent>
            <CardFooter className="bg-muted/10 p-4 border-t">
                <Button
                    size="lg"
                    className={cn(
                        "w-full font-bold transition-all",
                        transactionType === "AVOIR" ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    )}
                    onClick={handleSave}
                    disabled={isLoading || !selectedCustomerId || amount <= 0}
                >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {transactionType === "AVOIR" ? "Enregistrer l'Avoir" : "Enregistrer le Paiement"}
                </Button>
            </CardFooter>
        </Card>
    )
}
