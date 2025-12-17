// components/payments/supplier-payment-dialog.tsx

"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export function SupplierPaymentDialog({ isOpen, onOpenChange, supplier, companyId, purchaseOrder, onSuccess }: any) {
  const supabase = createClient();
  
  // On initialise le montant avec le montant dû de la commande si elle est fournie
  const initialAmount = purchaseOrder?.total_ttc ? purchaseOrder.total_ttc.toString() : "";

  const [amount, setAmount] = useState(initialAmount);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Virement");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Mettre à jour le montant si la commande change (cas où la modale est réutilisée)
  useEffect(() => {
    setAmount(purchaseOrder?.total_ttc ? purchaseOrder.total_ttc.toString() : "");
  }, [purchaseOrder]);

  const isDeferredPayment = paymentMethod === 'Chèque' || paymentMethod === 'Traite';

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    if (isDeferredPayment && !dueDate) {
      toast.error("Veuillez saisir une date d'échéance pour ce type de paiement.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.rpc('record_purchase_payment', {
      p_company_id: companyId,
      p_supplier_id: supplier.id,
      p_po_id: purchaseOrder?.id || null, // Lier à la commande si elle existe
      p_amount: parseFloat(amount),
      p_payment_date: paymentDate,
      p_due_date: isDeferredPayment ? dueDate : null,
      p_method: paymentMethod,
      p_reference: reference,
      p_notes: notes,
    });

    if (error) {
      toast.error("Erreur lors de l'enregistrement: " + error.message);
    } else {
      toast.success("Paiement enregistré avec succès.");
      onSuccess();
      onOpenChange(false);
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer un Paiement</DialogTitle>
          <DialogDescription>
            Pour le fournisseur : <span className="font-semibold">{supplier?.name}</span>
            {purchaseOrder && ` (Réf. BC: ${purchaseOrder.po_number})`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label>Montant Payé *</Label><Input type="number" placeholder="0.000" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Date de Paiement/Émission *</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
          <div><Label>Méthode de Paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div><Label>Date d'Échéance *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div><Label>N° de Chèque/Traite</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
            </>
          )}
          <div><Label>Notes / Références</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
