// components/category-creator.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CategoryCreatorProps {
  companyId: string;
  onCategoryCreated: () => void;
  tableName: 'supplier_categories' | 'item_categories'; // NOUVEAU: Pour le rendre réutilisable
}
export function CategoryCreator({ companyId, onCategoryCreated }: CategoryCreatorProps) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [categoryName, setCategoryName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!categoryName.trim()) {
      toast.error("Le nom de la catégorie ne peut pas être vide.")
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase
      .from(tableName) // NOUVEAU: Utilise le nom de la table passé en prop
      .insert({ name: categoryName, company_id: companyId })
    if (error) {
      toast.error(`Erreur: ${error.message}`)
    } else {
      toast.success("Catégorie ajoutée.")
      setCategoryName("")
      onCategoryCreated() // Rafraîchit la liste dans le composant parent
      setIsOpen(false)
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer une nouvelle catégorie</DialogTitle></DialogHeader>
        <div className="py-4">
          <Label htmlFor="category-name">Nom de la catégorie</Label>
          <Input id="category-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Création..." : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
