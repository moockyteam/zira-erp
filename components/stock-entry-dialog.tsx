"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Définition des types
type Item = { id: string; name: string }
type Supplier = { id: string; name: string }

interface StockEntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  items: Item[]
  selectedItem?: Item | null
  suppliers: Supplier[]
  onEntrySuccess: () => void
}

export function StockEntryDialog({
  isOpen,
  onOpenChange,
  companyId,
  items,
  selectedItem,
  suppliers,
  onEntrySuccess,
}: StockEntryDialogProps) {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // États du formulaire
  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [quantity, setQuantity] = useState<string>("")
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  useEffect(() => {
    if (isOpen && selectedItem) {
      setSelectedItemId(selectedItem.id)
    }
  }, [isOpen, selectedItem])

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity || Number.parseFloat(quantity) <= 0) {
      setError("Veuillez sélectionner un article et entrer une quantité valide.")
      return
    }
    setIsLoading(true)
    setError(null)

    const qty = Number.parseFloat(quantity)

    // D'abord enregistrer le mouvement de stock
    const { error: insertError } = await supabase.from("stock_movements").insert({
      company_id: companyId,
      item_id: selectedItemId,
      movement_type: "ENTREE",
      quantity: qty,
      supplier_id: selectedSupplierId || null,
      notes: notes || null,
    })

    if (insertError) {
      setError("Erreur lors de l'enregistrement de l'entrée.")
      console.error(insertError)
      setIsLoading(false)
      return
    }

    // Récupérer la quantité actuelle de l'article
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("quantity_on_hand")
      .eq("id", selectedItemId)
      .single()

    if (fetchError) {
      setError("Erreur lors de la récupération des données de l'article.")
      console.error(fetchError)
      setIsLoading(false)
      return
    }

    // Mettre à jour la quantité en stock (ajouter la quantité d'entrée)
    const newQuantity = item.quantity_on_hand + qty
    const { error: updateError } = await supabase
      .from("items")
      .update({ quantity_on_hand: newQuantity })
      .eq("id", selectedItemId)

    if (updateError) {
      setError("Erreur lors de la mise à jour du stock.")
      console.error(updateError)
      setIsLoading(false)
      return
    }

    // Succès !
    onEntrySuccess()
    onOpenChange(false)
    // Réinitialise le formulaire
    setSelectedItemId("")
    setQuantity("")
    setSelectedSupplierId("")
    setNotes("")
    setIsLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enregistrer une Entrée en Stock</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle quantité pour un article existant. Le stock sera mis à jour automatiquement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="item" className="text-right">
              Article *
            </Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Sélectionnez un article..." />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantité *
            </Label>
            <Input
              id="quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(",", "."))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="supplier" className="text-right">
              Fournisseur
            </Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="(Optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Réf. facture, BL fournisseur..."
              className="col-span-3"
            />
          </div>
          {error && <p className="col-span-4 text-sm text-destructive text-center">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Enregistrer l'entrée"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
