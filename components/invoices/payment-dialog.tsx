// Placez ce code dans : components/invoices/payment-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface PaymentDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  onPaymentSuccess: () => void;
  children: React.ReactNode; // Le bouton qui déclenche l'ouverture
}

export function PaymentDialog({ invoiceId, invoiceNumber, amountDue, onPaymentSuccess, children }: PaymentDialogProps) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // États du formulaire, réinitialisés à chaque ouverture
  const [amount, setAmount] = useState(amountDue.toFixed(3))
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0 || !paymentDate) {
      setError("Veuillez saisir une date et un montant valides.");
      return;
    }

    if (paymentAmount > amountDue + 0.001) { // Tolérance pour les erreurs de virgule flottante
        if (!window.confirm(`Le montant saisi (${paymentAmount.toFixed(3)}) est supérieur au montant dû (${amountDue.toFixed(3)}). Continuer ?`)) {
            return;
        }
    }

    setIsLoading(true);
    setError(null);

    // On appelle la fonction RPC que nous avons créée dans Supabase
    const { error: rpcError } = await supabase.rpc('record_invoice_payment', {
        p_invoice_id: invoiceId,
        p_amount: paymentAmount,
        p_payment_date: paymentDate,
        p_payment_method: paymentMethod || null,
        p_notes: notes || null
    });

    if (rpcError) {
      setError("Erreur : " + rpcError.message);
      console.error(rpcError);
    } else {
      onPaymentSuccess(); // Rafraîchit la liste parente
      setIsOpen(false); // Ferme la popup
    }
    setIsLoading(false);
  }

  // Gère la réinitialisation du formulaire à l'ouverture
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setAmount(amountDue.toFixed(3));
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMethod('');
      setNotes('');
      setError(null);
    }
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Paiement pour la facture {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Montant restant à payer : <span className="font-bold">{amountDue.toFixed(3)} TND</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">Montant *</Label>
            <Input id="amount" type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="paymentDate" className="text-right">Date *</Label>
            <Input id="paymentDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="paymentMethod" className="text-right">Méthode</Label>
            <Input id="paymentMethod" placeholder="Virement, Chèque..." value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Input id="notes" placeholder="Réf. transaction..." value={notes} onChange={e => setNotes(e.target.value)} className="col-span-3" />
          </div>
          {error && <p className="col-span-4 text-sm text-destructive text-center pt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sauvegarde...</> : "Enregistrer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}