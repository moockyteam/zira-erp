"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

    const handleSave = async () => {
        if (!amount || amount <= 0) {
            toast.error("Veuillez saisir un montant valide")
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            // Call the RPC function (v2)
            const { data, error } = await supabase.rpc('record_global_payment', {
                p_customer_id: customerId,
                p_amount: amount,
                p_payment_method: method,
                p_notes: notes,
                p_date: date
            })

            if (error) throw error

            console.log("Global Payment Result:", data)
            setResult(data)
            toast.success("Paiement enregistré avec succès")
            onPaymentComplete()

        } catch (error: any) {
            console.error("Payment error:", error)
            toast.error("Erreur lors de l'enregistrement: " + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        if (result) {
            // Reset form on close if success
            setAmount(0)
            setNotes("")
            setResult(null)
        }
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Paiement Global - Allocation Automatique</DialogTitle>
                    <DialogDescription>
                        Le montant saisi sera automatiquement affecté aux factures et BL impayés les plus anciens pour {customerName}.
                    </DialogDescription>
                </DialogHeader>

                {!result ? (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">Montant (TND)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.001"
                                className="font-mono text-lg bg-green-50 text-green-700"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="method">Mode de paiement</Label>
                                <Select value={method} onValueChange={setMethod}>
                                    <SelectTrigger id="method">
                                        <SelectValue placeholder="Sélectionner" />
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
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes / Référence</Label>
                            <Textarea
                                id="notes"
                                placeholder="Ref. Chèque, N° Virement, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                        <Alert className="bg-blue-50 border-blue-100 mt-2">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 text-xs">Information</AlertTitle>
                            <AlertDescription className="text-blue-700 text-xs text-muted-foreground">
                                L'algorithme FIFO (First-In First-Out) sera appliqué. Les documents les plus vieux seront soldés en priorité.
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md border border-green-100">
                            <CheckCircle2 className="h-6 w-6" />
                            <div className="font-semibold px-2">Traitement effectué avec succès !</div>
                        </div>

                        <div className="text-sm space-y-2 border rounded-md p-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Montant Total :</span>
                                <span className="font-bold">{amount.toFixed(3)} TND</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Alloué :</span>
                                <span className="font-bold text-green-600">{result.total_paid.toFixed(3)} TND</span>
                            </div>
                            {result.remaining_unallocated > 0.001 && (
                                <div className="flex justify-between border-t pt-2">
                                    <span className="text-orange-600 font-medium">Non alloué (Reste) :</span>
                                    <span className="font-bold text-orange-600">{result.remaining_unallocated.toFixed(3)} TND</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Détail des affectations :</Label>
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {result.allocations && result.allocations.length > 0 ? (
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left p-2">Type</th>
                                                <th className="text-left p-2">Ref</th>
                                                <th className="text-right p-2">Payé</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.allocations.map((alloc: any, i: number) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">{alloc.document_type === 'INVOICE' ? 'Facture' : 'BL'}</td>
                                                    <td className="p-2 font-medium">{alloc.reference}</td>
                                                    <td className="p-2 text-right">{alloc.amount_paid.toFixed(3)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-4 text-center text-muted-foreground italic text-xs">
                                        Aucun document n'était en attente de paiement.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {!result ? (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                                Annuler
                            </Button>
                            <Button onClick={handleSave} disabled={isLoading || amount <= 0}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer et Allouer
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleClose}>
                            Fermer
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
