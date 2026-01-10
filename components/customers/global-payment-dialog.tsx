"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CheckCircle2, DollarSign, Calendar, CreditCard, Info } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface GlobalPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
    onPaymentComplete: () => void
}

export function GlobalPaymentDialog({
    open,
    onOpenChange,
    customerId,
    customerName,
    onPaymentComplete
}: GlobalPaymentDialogProps) {
    const supabase = createClient()
    const [isLoading, setIsLoading] = useState(false)
    const [amount, setAmount] = useState<number>(0)
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [method, setMethod] = useState<string>("VIREMENT")
    const [notes, setNotes] = useState<string>("")
    const [result, setResult] = useState<any>(null)

    // New features matching GlobalPaymentForm
    const [transactionType, setTransactionType] = useState<"PAYMENT" | "AVOIR">("PAYMENT")
    const [customerBalance, setCustomerBalance] = useState<number | null>(null)

    // Fetch Balance when dialog opens or customer changes
    useEffect(() => {
        const fetchBalance = async () => {
            if (!customerId || !open) {
                setCustomerBalance(null)
                return
            }
            const { data, error } = await supabase.rpc('calculate_customer_balance', { p_customer_id: customerId })
            if (!error) setCustomerBalance(data)
        }
        fetchBalance()
    }, [customerId, open, supabase])

    const handleSave = async () => {
        if (!amount || amount <= 0) {
            toast.error("Veuillez saisir un montant valide")
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            // If AVOIR, force method to 'AVOIR'
            const finalMethod = transactionType === "AVOIR" ? "AVOIR" : method

            const { data, error } = await supabase.rpc('record_global_payment', {
                p_customer_id: customerId,
                p_amount: amount,
                p_payment_method: finalMethod,
                p_notes: notes,
                p_date: date
            })

            if (error) throw error

            setResult(data)
            toast.success(transactionType === "AVOIR" ? "Avoir enregistré avec succès" : "Paiement enregistré avec succès")
            onPaymentComplete()

            // Refresh balance
            const { data: newBalance } = await supabase.rpc('calculate_customer_balance', { p_customer_id: customerId })
            setCustomerBalance(newBalance)

        } catch (error: any) {
            console.error("Payment error:", error)
            toast.error("Erreur: " + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleReset = () => {
        setAmount(0)
        setNotes("")
        setResult(null)
        // Keep dialog open for new entry
    }

    const handleClose = () => {
        if (result) {
            setAmount(0)
            setNotes("")
            setResult(null)
        }
        setTransactionType("PAYMENT")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        {transactionType === "AVOIR" ? "Avoir / Avance" : "Paiement Global"} - {customerName}
                    </DialogTitle>
                    <DialogDescription>
                        {transactionType === "AVOIR"
                            ? "Ce montant sera déduit de la dette du client ou créera un crédit."
                            : "Le montant sera automatiquement affecté aux documents impayés (FIFO)."}
                    </DialogDescription>
                </DialogHeader>

                {!result ? (
                    <div className="space-y-5 py-4">
                        {/* TYPE TOGGLE - Matching GlobalPaymentForm */}
                        <div className="flex p-1 bg-muted rounded-lg">
                            <button
                                type="button"
                                onClick={() => setTransactionType("PAYMENT")}
                                className={cn(
                                    "flex-1 text-sm font-medium py-2.5 rounded-md transition-all",
                                    transactionType === "PAYMENT"
                                        ? "bg-background text-primary shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Encaissement
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransactionType("AVOIR")}
                                className={cn(
                                    "flex-1 text-sm font-medium py-2.5 rounded-md transition-all",
                                    transactionType === "AVOIR"
                                        ? "bg-background text-emerald-600 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Avoir / Avance
                            </button>
                        </div>

                        {/* BALANCE DISPLAY - Matching GlobalPaymentForm */}
                        {customerBalance !== null && (
                            <div className={cn(
                                "text-sm font-medium px-4 py-3 rounded-lg flex justify-between items-center border",
                                customerBalance > 0
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                                <span className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    Solde actuel :
                                </span>
                                <span className="text-lg font-bold">{customerBalance.toFixed(3)} TND</span>
                            </div>
                        )}

                        {/* AMOUNT INPUT */}
                        <div className="space-y-2">
                            <Label>Montant (TND)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    step="0.001"
                                    className="pl-10 h-12 text-lg font-bold"
                                    placeholder="0.000"
                                    value={amount === 0 ? "" : amount}
                                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* DATE & METHOD */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        className="pl-10 h-10"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            {transactionType === "PAYMENT" && (
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
                            )}
                            {transactionType === "AVOIR" && (
                                <div className="space-y-2">
                                    <Label>Motif</Label>
                                    <Input
                                        placeholder="Ex: Retour, Geste..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="h-10 bg-emerald-50/50 border-emerald-100"
                                    />
                                </div>
                            )}
                        </div>

                        {/* NOTES (for Payment mode only) */}
                        {transactionType === "PAYMENT" && (
                            <div className="space-y-2">
                                <Label>Référence / Notes</Label>
                                <Input
                                    placeholder="Ex: Chèque n°123456"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        )}

                        {/* INFO ALERT - Matching GlobalPaymentForm */}
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
                                    : "Ce paiement sera utilisé pour régler les factures et BL impayés les plus anciens (FIFO)."}
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    /* SUCCESS VIEW - Matching GlobalPaymentForm */
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="h-7 w-7" />
                            <div>
                                <div className="font-bold text-lg">
                                    {transactionType === "AVOIR" ? "Avoir Enregistré !" : "Paiement enregistré !"}
                                </div>
                                <div className="text-sm text-emerald-700/80">
                                    {transactionType === "AVOIR" ? "L'avoir de" : "Le paiement de"} <strong>{amount.toFixed(3)} TND</strong> a été traité.
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-lg">
                            <div>
                                <span className="text-muted-foreground block">Montant Saisi</span>
                                <span className="font-bold text-lg">{(result.total_requested || amount).toFixed(3)} <span className="text-xs font-normal">TND</span></span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-right">Alloué aux Documents</span>
                                <span className="font-bold text-lg text-emerald-600 block text-right">{(result.total_allocated || result.total_paid || 0).toFixed(3)} <span className="text-xs font-normal">TND</span></span>
                            </div>
                            {(result.total_credited > 0.001 || result.credited > 0.001 || result.remaining_unallocated > 0.001) && (
                                <div className="col-span-2 pt-2 border-t mt-2 flex justify-between items-center">
                                    <span className="text-blue-600 font-medium flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        {(result.total_credited > 0 || result.credited > 0) ? "Stocké en Crédit Client" : "Non alloué"}
                                    </span>
                                    <span className="font-bold text-blue-600">{(result.total_credited || result.credited || result.remaining_unallocated || 0).toFixed(3)} TND</span>
                                </div>
                            )}
                            {(result.total_credited > 0.001 || result.credited > 0.001) && (
                                <div className="col-span-2 bg-blue-50 border border-blue-200 text-blue-700 p-2 rounded text-xs">
                                    ✓ Le crédit a été enregistré et sera déduit automatiquement du solde client.
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Affectations (FIFO)</h4>
                            <div className="border rounded-md overflow-hidden bg-background max-h-[150px] overflow-y-auto">
                                {result.allocations && result.allocations.length > 0 ? (
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted sticky top-0">
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
                                    <div className="p-6 text-center text-muted-foreground italic text-xs">
                                        Le montant a été ajouté au solde créditeur du client (aucun document en attente).
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Updated Balance Display */}
                        {customerBalance !== null && (
                            <div className={cn(
                                "text-sm font-medium px-4 py-3 rounded-lg flex justify-between items-center border",
                                customerBalance > 0
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                                <span>Nouveau solde :</span>
                                <span className="text-lg font-bold">{customerBalance.toFixed(3)} TND</span>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="border-t pt-4">
                    {!result ? (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                                Annuler
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isLoading || amount <= 0}
                                className={cn(
                                    transactionType === "AVOIR" ? "bg-emerald-600 hover:bg-emerald-700" : ""
                                )}
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {transactionType === "AVOIR" ? "Enregistrer l'Avoir" : "Confirmer et Allouer"}
                            </Button>
                        </>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={handleClose} className="flex-1">
                                Fermer
                            </Button>
                            <Button onClick={handleReset} className="flex-1">
                                {transactionType === "AVOIR" ? "Nouvel Avoir" : "Nouveau Paiement"}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
