"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DeliveryNotePaymentDialogProps {
    deliveryNoteId: string
    deliveryNoteReference: string
    amountDue: number
    customerId: string // To update balance
    onPaymentSuccess: () => void
    children: React.ReactNode
}

export function DeliveryNotePaymentDialog({
    deliveryNoteId,
    deliveryNoteReference,
    amountDue,
    customerId,
    onPaymentSuccess,
    children
}: DeliveryNotePaymentDialogProps) {
    const supabase = createClient()
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form states
    const [amount, setAmount] = useState(amountDue > 0 ? amountDue.toFixed(3) : "0.000") // Default to 0 if amountDue is 0 (which it is for now)
    const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [paymentMethod, setPaymentMethod] = useState("")
    const [notes, setNotes] = useState("")
    const [bankName, setBankName] = useState("")
    const [checkNumber, setCheckNumber] = useState("")
    const [checkDate, setCheckDate] = useState("")

    const handleSubmit = async () => {
        const paymentAmount = Number.parseFloat(amount)
        if (!paymentAmount || paymentAmount <= 0 || !paymentDate) {
            setError("Veuillez saisir une date et un montant valides.")
            return
        }

        setIsLoading(true)
        setError(null)

        const payload = {
            p_delivery_note_id: deliveryNoteId,
            p_amount: paymentAmount,
            p_payment_date: paymentDate,
            p_payment_method: paymentMethod || null,
            p_notes: notes || null,
            p_bank_name: bankName || null,
            p_check_number: checkNumber || null,
            p_check_date: checkDate || null,
        }

        // Call the DEDICATED RPC for Delivery Notes
        const { error: rpcError } = await supabase.rpc("record_delivery_note_payment", payload)

        if (rpcError) {
            setError("Erreur : " + rpcError.message)
            console.error(rpcError)
        } else {
            onPaymentSuccess()
            setIsOpen(false)
        }
        setIsLoading(false)
    }

    const handleOpenChange = (open: boolean) => {
        if (open) {
            setAmount(amountDue > 0 ? amountDue.toFixed(3) : "0.000")
            setPaymentDate(format(new Date(), "yyyy-MM-dd"))
            setPaymentMethod("")
            setNotes("")
            setBankName("")
            setCheckNumber("")
            setCheckDate("")
            setError(null)
        }
        setIsOpen(open)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Paiement Bon de Livraison</DialogTitle>
                    <DialogDescription>
                        BL {deliveryNoteReference} - Montant à régler
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">Montant</Label>
                        <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3" step="0.001" />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">Date</Label>
                        <Input id="date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="col-span-3" />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="method" className="text-right">Méthode</Label>
                        <select
                            id="method"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors input-bordered col-span-3"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option value="">Sélectionner...</option>
                            <option value="ESPECES">Espèces</option>
                            <option value="CHEQUE">Chèque</option>
                            <option value="VIREMENT">Virement</option>
                            <option value="TRAITE">Traite</option>
                        </select>
                    </div>

                    {paymentMethod === 'CHEQUE' && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="bank" className="text-right">Banque</Label>
                                <Input id="bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="col-span-3" placeholder="Nom de la banque" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="checkNum" className="text-right">N° Chèque</Label>
                                <Input id="checkNum" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="checkDate" className="text-right">Date Chèque</Label>
                                <Input id="checkDate" type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="col-span-3" />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes" className="text-right">Notes</Label>
                        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? <span className="flex items-center gap-2">Enregistrement...</span> : "Enregistrer"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
