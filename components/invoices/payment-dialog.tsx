//  components/invoices/payment-dialog.tsx

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface PaymentDialogProps {
  documentId: string
  documentReference: string
  amountDue: number
  customerId: string
  companyId: string
  onPaymentSuccess: () => void
  children: React.ReactNode
}

export function PaymentDialog({
  documentId,
  documentReference,
  amountDue,
  customerId,
  companyId,
  onPaymentSuccess,
  children
}: PaymentDialogProps) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // États du formulaire
  const [amount, setAmount] = useState(amountDue.toFixed(3))
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

    if (paymentAmount > amountDue + 0.001) {
      if (
        !window.confirm(
          `Le montant saisi (${paymentAmount.toFixed(3)}) est supérieur au montant dû (${amountDue.toFixed(3)}). Continuer ?`,
        )
      ) {
        return
      }
    }

    setIsLoading(true)
    setError(null)

    // Construct payload for invoice payment
    const payload = {
      p_company_id: companyId,
      p_customer_id: customerId,
      p_amount: paymentAmount,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod || null,
      p_notes: notes || null,
      p_bank_name: bankName || null,
      p_check_number: checkNumber || null,
      p_check_date: checkDate || null,
      p_invoice_id: documentId
    }

    // Call the original RPC for INVOICES
    const { error: rpcError } = await supabase.rpc("record_payment", payload)

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
      setAmount(amountDue.toFixed(3))
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
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Facture {documentReference} - Reste à payer : {amountDue.toFixed(3)} TND
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
            {/* Simple select or input for method */}
            <select
              id="method"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
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
                <Label htmlFor="checkDate" className="text-right">Échéance</Label>
                <Input id="checkDate" type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="col-span-3" />
              </div>
            </>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" placeholder="Optionnel" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
