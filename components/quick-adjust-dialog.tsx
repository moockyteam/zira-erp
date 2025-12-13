// components/quick-adjust-dialog.tsx

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Item } from "./manage-item-dialog"

interface QuickAdjustDialogProps {
  item: Item | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function QuickAdjustDialog({ item, isOpen, onOpenChange, onSuccess }: QuickAdjustDialogProps) {
  const supabase = createClient()
  const [newQuantity, setNewQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setNewQuantity(item.quantity_on_hand.toString())
      setReason("")
    }
  }, [item])

  const handleAdjust = async () => {
    if (!item || newQuantity === "") {
      toast.error("La nouvelle quantité est requise.")
      return
    }
    setIsSaving(true)

    const nQty = parseFloat(newQuantity)
    const pQty = item.quantity_on_hand
    const adjustment = nQty - pQty

    // 1. Mettre à jour la quantité de l'article
    const { error: updateError } = await supabase
      .from("items")
      .update({ quantity_on_hand: nQty })
      .eq("id", item.id)

    if (updateError) {
      toast.error(updateError.message)
      setIsSaving(false)
      return
    }

    // 2. Enregistrer le mouvement d'ajustement pour la traçabilité
    await supabase.from("stock_adjustments").insert({
      item_id: item.id,
      company_id: item.company_id, // Assurez-vous que company_id est dans le type Item
      adjustment_quantity: adjustment,
      previous_quantity: pQty,
      new_quantity: nQty,
      reason: reason || "Ajustement manuel",
    })

    toast.success("Quantité mise à jour.")
    onSuccess()
    onOpenChange(false)
    setIsSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustement Rapide</DialogTitle>
          <DialogDescription>{item?.name || 'Chargement...'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Quantité actuelle</Label>
            {/* CORRECTION ICI: On s'assure que la valeur n'est jamais undefined */}
            <Input value={item?.quantity_on_hand || ''} disabled />
          </div>
          <div>
            <Label htmlFor="new-qty">Nouvelle quantité en stock</Label>
            <Input id="new-qty" type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="reason">Raison de l'ajustement (optionnel)</Label>
            <Input id="reason" placeholder="Ex: Correction d'inventaire, Perte..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAdjust} disabled={isSaving}>{isSaving ? "Enregistrement..." : "Valider l'ajustement"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}