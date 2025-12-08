// components/manage-item-dialog.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Item, stockCategories } from "./stock-manager" // On importe les types depuis stock-manager
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"

interface ManageItemDialogProps {
  item: Item | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // Pour rafraîchir la liste après une action
}

export function ManageItemDialog({ item, isOpen, onOpenChange, onSuccess }: ManageItemDialogProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Partial<Item>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pré-remplit le formulaire quand un item est sélectionné
  useEffect(() => {
    if (item) {
      setFormData(item)
    }
  }, [item])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: keyof Item, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleUpdate = async () => {
    if (!item || !formData.name?.trim() || !formData.category) {
      setError("Le nom et la catégorie sont obligatoires.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("items")
      .update({
        name: formData.name,
        reference: formData.reference || null,
        category: formData.category,
        unit_of_measure: formData.unit_of_measure || null,
        purchase_price: formData.purchase_price ? parseFloat(String(formData.purchase_price)) : null,
        sale_price: formData.sale_price ? parseFloat(String(formData.sale_price)) : null,
        description: (formData as any).description || null, // Supposant que description existe
      })
      .eq('id', item.id);

    if (updateError) {
      setError("Erreur lors de la mise à jour de l'article.");
      console.error(updateError);
    } else {
      onSuccess(); // Rafraîchir
      onOpenChange(false); // Fermer
    }
    setIsLoading(false);
  }

  const handleArchive = async () => {
    if (!item) return;
    setIsLoading(true);
    
    const { error: archiveError } = await supabase
      .from("items")
      .update({ is_archived: true }) // On passe simplement le booléen à true
      .eq('id', item.id);

    if (archiveError) {
       setError("Erreur lors de l'archivage de l'article.");
       console.error(archiveError);
    } else {
        onSuccess();
        onOpenChange(false);
    }
    setIsLoading(false);
  }
  
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gérer l'article : {item.name}</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l'article ou archivez-le pour le masquer des listes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-2"><Label htmlFor="name">Nom de l'article *</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label htmlFor="reference">Référence (SKU)</Label><Input id="reference" value={formData.reference || ''} onChange={handleInputChange} /></div>
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Select value={formData.category} onValueChange={(value) => handleSelectChange('category', value)}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                <SelectContent>{stockCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="unit_of_measure">Unité de mesure</Label><Input id="unit_of_measure" value={formData.unit_of_measure || ''} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label htmlFor="purchase_price">Prix d'achat (HT)</Label><Input id="purchase_price" type="number" step="0.01" value={formData.purchase_price ?? ''} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label htmlFor="sale_price">Prix de vente (HT)</Label><Input id="sale_price" type="number" step="0.01" value={formData.sale_price ?? ''} onChange={handleInputChange} /></div>
        </div>
        {error && <p className="text-sm text-destructive text-center mb-2">{error}</p>}
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isLoading}><Trash2 className="mr-2 h-4 w-4" /> Archiver</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle><AlertDialogDescription>L'archivage masquera cet article de la liste d'inventaire et des sélecteurs. Il ne sera pas supprimé de l'historique. Cette action est réversible depuis la base de données.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleArchive}>Confirmer l'archivage</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button type="button" onClick={handleUpdate} disabled={isLoading}>{isLoading ? "Sauvegarde..." : "Sauvegarder les modifications"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}