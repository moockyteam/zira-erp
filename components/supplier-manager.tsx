"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

// Importations des composants UI
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { CompanySelector } from "@/components/company-selector"
import { SupplierImportDialog } from "./supplier-import-dialog"

type Company = { id: string; name: string }
type Supplier = {
  id: string
  name: string
  matricule_fiscal: string | null
  contact_person: string | null
  email: string | null
  phone_number: string | null
  address: string | null
  city: string | null
  country: string | null
  iban: string | null
  notes: string | null
  balance: number | null
}

const initialFormData = {
  name: "",
  matricule_fiscal: "",
  contact_person: "",
  email: "",
  phone_number: "",
  address: "",
  city: "",
  country: "Tunisie",
  iban: "",
  notes: "",
  balance: "0.000",
}

export function SupplierManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState(initialFormData)

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSuppliers(selectedCompanyId)
    } else {
      setSuppliers([])
      setIsInitialLoading(false)
    }
  }, [selectedCompanyId])

  const fetchSuppliers = async (companyId: string) => {
    setIsInitialLoading(true)
    const { data, error } = await supabase.from("suppliers").select("*").eq("company_id", companyId).order("name")
    if (error) {
      toast.error("Impossible de charger les fournisseurs.")
      console.error(error)
    } else {
      setSuppliers(data as Supplier[])
    }
    setIsInitialLoading(false)
  }

  const resetFormAndClose = () => {
    setEditingSupplier(null)
    setFormData(initialFormData)
    setIsFormOpen(false)
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleAddNewClick = () => {
    setEditingSupplier(null)
    setFormData(initialFormData)
    setIsFormOpen(true)
  }

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      ...initialFormData,
      ...supplier,
      balance: supplier.balance?.toString() ?? "0.000",
    })
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId) return
    setIsSubmitting(true)
    setError(null)

    const dataToSubmit = {
      ...formData,
      balance: Number.parseFloat(formData.balance) || 0,
      company_id: selectedCompanyId,
    }

    if (editingSupplier) {
      const { error: updateError } = await supabase.from("suppliers").update(dataToSubmit).eq("id", editingSupplier.id)
      if (updateError) {
        setError("Erreur lors de la mise à jour.")
        toast.error(`Erreur: ${updateError.message}`)
      } else {
        toast.success(`Fournisseur "${formData.name}" mis à jour.`)
        resetFormAndClose()
        await fetchSuppliers(selectedCompanyId)
      }
    } else {
      const { error: insertError } = await supabase.from("suppliers").insert(dataToSubmit)
      if (insertError) {
        setError("Erreur lors de la création du fournisseur.")
        toast.error(`Erreur: ${insertError.message}`)
      } else {
        toast.success("Nouveau fournisseur ajouté avec succès !")
        resetFormAndClose()
        await fetchSuppliers(selectedCompanyId)
      }
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (supplierId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.")) {
      setIsSubmitting(true)
      const { error } = await supabase.from("suppliers").delete().eq("id", supplierId)
      if (error) {
        toast.error("Erreur lors de la suppression.")
      } else {
        toast.success("Fournisseur supprimé.")
        resetFormAndClose()
        await fetchSuppliers(selectedCompanyId!)
      }
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses fournisseurs.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Liste des Fournisseurs</CardTitle>
              <CardDescription>Liste de tous les fournisseurs pour l'entreprise sélectionnée.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <SupplierImportDialog
                companyId={selectedCompanyId}
                onImportSuccess={() => fetchSuppliers(selectedCompanyId!)}
              />
              <Button onClick={handleAddNewClick}>Ajouter un fournisseur</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule Fiscal</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-[200px]" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-4 w-[150px]" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-4 w-[150px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-[80px] ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-[70px]" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Aucun fournisseur trouvé pour cette entreprise.
                      <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                        Ajoutez votre premier fournisseur.
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{supplier.contact_person}</TableCell>
                      <TableCell className="hidden md:table-cell">{supplier.matricule_fiscal}</TableCell>
                      <TableCell className="text-right font-mono">
                        {supplier.balance != null ? supplier.balance.toFixed(3) : "N/A"} TND
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(supplier)}>
                          Gérer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? `Modifier : ${editingSupplier.name}` : "Ajouter un nouveau fournisseur"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            {/* Colonne 1 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom du fournisseur *</Label>
                <Input id="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="matricule_fiscal">Matricule Fiscal</Label>
                <Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="contact_person">Personne de contact</Label>
                <Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="phone_number">Téléphone</Label>
                <Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" value={formData.iban} onChange={handleInputChange} />
              </div>
            </div>
            {/* Colonne 2 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={formData.city} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={formData.country} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="balance">Solde initial (TND)</Label>
                <Input id="balance" type="number" step="0.001" value={formData.balance} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={formData.notes} onChange={handleInputChange} rows={4} />
              </div>
            </div>
            {error && <p className="md:col-span-2 text-sm text-destructive">{error}</p>}
            <DialogFooter className="md:col-span-2 pt-4">
              {editingSupplier && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(editingSupplier.id)}
                  disabled={isSubmitting}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={resetFormAndClose} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
