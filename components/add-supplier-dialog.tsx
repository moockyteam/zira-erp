"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, User, Building2, MapPin, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

type Supplier = { id: string; name: string }

interface AddSupplierDialogProps {
    companyId: string
    onSupplierAdded: (supplier: Supplier) => void
}

export function AddSupplierDialog({ companyId, onSupplierAdded }: AddSupplierDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Minimal required fields + common contact info
    const [formData, setFormData] = useState({
        name: "",
        contact_person: "",
        email: "",
        phone_number: "",
        address: "",
        matricule_fiscal: "",
    })

    const supabase = createClient()

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return

        setIsSubmitting(true)
        const { data, error } = await supabase
            .from("suppliers")
            .insert({
                ...formData,
                company_id: companyId,
            })
            .select("id, name")
            .single()

        if (error) {
            toast.error(`Erreur: ${error.message}`)
        } else {
            toast.success("Fournisseur ajouté.")
            onSupplierAdded(data)
            setFormData({
                name: "",
                contact_person: "",
                email: "",
                phone_number: "",
                address: "",
                matricule_fiscal: "",
            })
            setIsOpen(false)
        }
        setIsSubmitting(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" title="Nouveau Fournisseur">
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Nouveau Fournisseur</DialogTitle>
                    <DialogDescription>
                        Ajout rapide d'un fournisseur.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nom de l'entreprise *</Label>
                        <Input id="name" value={formData.name} onChange={handleInputChange} required placeholder="Ex: Fournisseur XYZ" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contact_person">Personne de contact</Label>
                        <Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone_number">Téléphone</Label>
                            <Input id="phone_number" value={formData.phone_number} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Créer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
