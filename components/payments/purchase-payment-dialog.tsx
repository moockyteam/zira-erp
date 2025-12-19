// components/payments/supplier-payment-dialog.tsx

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SupplierPaymentDialog({ isOpen, onOpenChange, supplier, companyId, onSuccess }: any) {
  const supabase = createClient()
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Virement")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setAmount("")
      setDueDate("")
      setReference("")
      setNotes("")
      setPaymentMethod("Virement")
    }
  }, [isOpen])

  const isDeferredPayment = paymentMethod === "Chèque" || paymentMethod === "Traite"

  const handleSave = async () => {
    setIsSaving(true)
    const { error } = await supabase.rpc("record_purchase_payment", {
      p_company_id: companyId,
      p_supplier_id: supplier.id,
      p_po_id: null, // Paiement non lié à un BC spécifique
      p_amount: Number.parseFloat(amount),
      p_payment_date: paymentDate,
      p_due_date: isDeferredPayment ? dueDate : null,
      p_method: paymentMethod,
      p_reference: reference,
      p_notes: notes,
    })
    if (error) toast.error("Erreur: " + error.message)
    else {
      toast.success("Paiement enregistré.")
      onSuccess()
      onOpenChange(false)
    }
    setIsSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paiement pour {supplier?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Montant Payé *</Label>
            <Input
              type="text"
              placeholder="0.000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            />
          </div>
          <div>
            <Label>Date de Paiement/Émission</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>Méthode de Paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Virement">Virement</SelectItem>
                <SelectItem value="Espèces">Espèces</SelectItem>
                <SelectItem value="Chèque">Chèque</SelectItem>
                <SelectItem value="Traite">Traite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isDeferredPayment && (
            <>
              <div>
                <Label>Date d'Échéance</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>N° de Chèque/Traite</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label>Notes / Références Commandes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
