"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Loader2 } from "lucide-react"

type Category = {
    id: string
    name: string
    parent_id: string | null
}

interface AddCategoryDialogProps {
    companyId: string
    parentCategories: Category[]
    onCategoryAdded: () => void
}

export function AddCategoryDialog({ companyId, parentCategories, onCategoryAdded }: AddCategoryDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [name, setName] = useState("")
    const [parentId, setParentId] = useState<string | "none">("none")

    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setIsSubmitting(true)
        try {
            const { error } = await supabase.from("supplier_categories").insert({
                name: name.trim(),
                company_id: companyId,
                parent_id: parentId === "none" ? null : parentId,
            })

            if (error) throw error

            toast.success("Catégorie ajoutée avec succès")
            setIsOpen(false)
            setName("")
            setParentId("none")
            onCategoryAdded()
        } catch (error: any) {
            toast.error("Erreur lors de l'ajout", { description: error.message })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-1"
                onClick={() => setIsOpen(true)}
                title="Ajouter une catégorie personnalisée"
            >
                <PlusCircle className="h-5 w-5 text-primary" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Nouvelle Catégorie</DialogTitle>
                        <DialogDescription>
                            Créez une catégorie personnalisée pour vos fournisseurs.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="cat-name">Nom de la catégorie</Label>
                            <Input
                                id="cat-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Prestataire IT"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Affiliation (Optionnel)</Label>
                            <Select
                                value={parentId}
                                onValueChange={(val) => {
                                    setParentId(val)
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner un parent..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    <SelectItem value="none">Aucune (Catégorie Principale)</SelectItem>
                                    {parentCategories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            Sous-catégorie de "{cat.name}"
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Laissez sur "Aucune" pour créer une nouvelle catégorie principale.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !name.trim()}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Créer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
