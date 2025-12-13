//component/stock-entry-dialog.tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Définition des types
type Item = { id: string; name: string; }
type Supplier = { id: string; name: string; }

interface StockEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  items: Item[];
  suppliers: Supplier[];
  onEntrySuccess: () => void; // Fonction pour rafraîchir la liste des articles
}

export function StockEntryDialog({ companyId, items, suppliers, onEntrySuccess }: StockEntryDialogProps) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // États du formulaire
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity || parseFloat(quantity) <= 0) {
      setError("Veuillez sélectionner un article et entrer une quantité valide.")
      return
    }
    setIsLoading(true)
    setError(null)

    const { error: insertError } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      item_id: selectedItemId,
      movement_type: 'ENTREE',
      quantity: parseFloat(quantity),
      supplier_id: selectedSupplierId || null,
      notes: notes || null,
    })

    if (insertError) {
      setError("Erreur lors de l'enregistrement de l'entrée.")
      console.error(insertError)
    } else {
      // Succès !
      onEntrySuccess() // Appelle la fonction de rafraîchissement
      setIsOpen(false) // Ferme la boîte de dialogue
      // Réinitialise le formulaire
      setSelectedItemId('')
      setQuantity('')
      setSelectedSupplierId('')
      setNotes('')
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
     
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enregistrer une Entrée en Stock</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle quantité pour un article existant. Le stock sera mis à jour automatiquement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="item" className="text-right">Article *</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="Sélectionnez un article..." /></SelectTrigger>
              <SelectContent>
                {items.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantité *</Label>
            <Input id="quantity" type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="supplier" className="text-right">Fournisseur</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="(Optionnel)" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Réf. facture, BL fournisseur..." className="col-span-3" />
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
