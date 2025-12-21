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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Search, Download, Check, ChevronsUpDown, Building2, User, Wallet, MapPin } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { SupplierImportDialog } from "./supplier-import-dialog"
import { AddCategoryDialog } from "./add-category-dialog"
import { CompanySelector } from "@/components/company-selector"
import * as XLSX from "xlsx"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string; logo_url: string | null }
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
  bank_name: string | null
  notes: string | null
  balance: number | null
  category_id: string | null
  subcategory_id: string | null
}

type Category = {
  id: string
  name: string
  parent_id: string | null
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
  bank_name: "",
  notes: "",
  balance: "0.000",
  category_id: "",
  subcategory_id: "",
}

export function SupplierManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [categories, setCategories] = useState<Category[]>([])

  // Pagination & Filtering States
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSuppliers(selectedCompanyId)
      fetchCategories()
    } else {
      setSuppliers([])
      setIsInitialLoading(false)
    }
  }, [selectedCompanyId])

  const fetchCategories = async () => {
    const { data } = await supabase.from("supplier_categories").select("*").order("name")
    if (data) setCategories(data)
  }

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
      matricule_fiscal: supplier.matricule_fiscal || "",
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone_number: supplier.phone_number || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      iban: supplier.iban || "",
      bank_name: supplier.bank_name || "",
      notes: supplier.notes || "",
      balance: supplier.balance?.toString() ?? "0.000",
      category_id: supplier.category_id || "",
      subcategory_id: supplier.subcategory_id || "",
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
      balance: Number.parseFloat(formData.balance.replace(",", ".")) || 0,
      company_id: selectedCompanyId,
      category_id: formData.category_id || null,
      subcategory_id: formData.subcategory_id || null,
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

  // Derived State for Filtering & Pagination
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || supplier.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const parentCategories = categories.filter(c => !c.parent_id)
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  const handleExportTemplate = () => {
    const headers = [
      "Nom", "Matricule Fiscal", "Contact", "Email", "Téléphone",
      "Adresse", "Ville", "Pays", "IBAN", "Notes", "Solde", "Catégorie", "Sous-catégorie"
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers]) // Create sheet with just headers
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Fournisseurs")
    XLSX.writeFile(wb, "modele_fournisseurs.xlsx")
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
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle>Liste des Fournisseurs</CardTitle>
                <CardDescription>
                  Gérez vos fournisseurs, filtrez par catégorie et suivez les soldes.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportTemplate}>
                  <Download className="h-4 w-4 mr-2" /> Modèle Excel
                </Button>
                <SupplierImportDialog
                  companyId={selectedCompanyId}
                  onImportSuccess={() => fetchSuppliers(selectedCompanyId!)}
                  categories={categories}
                />
                <Button onClick={handleAddNewClick}>Ajouter</Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Toutes catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {parentCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Catégorie</TableHead>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                      Aucun fournisseur trouvé pour cette entreprise.
                      <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                        Ajoutez votre premier fournisseur.
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSuppliers.map((supplier) => {
                    const categoryName = categories.find(c => c.id === supplier.category_id)?.name
                    const subCategoryName = categories.find(c => c.id === supplier.subcategory_id)?.name

                    return (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          <div>{supplier.name}</div>
                          <div className="text-xs text-muted-foreground md:hidden">{categoryName}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {categoryName && (
                            <div className="flex flex-col text-sm">
                              <span className="font-medium">{categoryName}</span>
                              {subCategoryName && <span className="text-xs text-muted-foreground">{subCategoryName}</span>}
                            </div>
                          )}
                        </TableCell>
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
                    )
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} sur {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-1">
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              {editingSupplier ? (
                <>
                  <User className="h-6 w-6 text-primary" />
                  Modifier le fournisseur
                </>
              ) : (
                <>
                  <User className="h-6 w-6 text-primary" />
                  Nouveau fournisseur
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground/80">
              Remplissez les informations ci-dessous pour gérer votre fournisseur.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-8 py-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* COLONNE GAUCHE */}
              <div className="space-y-6">

                {/* SECTION: IDENTITÉ */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2 text-primary">
                    <Building2 className="h-5 w-5" />
                    Identité & Contact
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="name">Nom de l'entreprise / fournisseur *</Label>
                      <Input id="name" value={formData.name} onChange={handleInputChange} required placeholder="Ex: Fournisseur SARL" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="contact_person">Personne de contact</Label>
                      <Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} placeholder="Ex: Mr. Ahmed" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="email@exemple.com" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="phone_number">Téléphone</Label>
                        <Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} placeholder="+216..." />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="matricule_fiscal">Matricule Fiscal</Label>
                      <Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} placeholder="1234567/A..." />
                    </div>
                  </div>
                </div>

                {/* SECTION: LOCALISATION */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2 text-primary">
                    <MapPin className="h-5 w-5" />
                    Localisation
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="address">Adresse</Label>
                      <Input id="address" value={formData.address} onChange={handleInputChange} placeholder="Rue, Avenue..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="city">Ville</Label>
                        <Input id="city" value={formData.city} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="country">Pays</Label>
                        <Input id="country" value={formData.country} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* COLONNE DROITE */}
              <div className="space-y-6">

                {/* SECTION: CLASSIFICATION */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2 text-primary">
                    <Wallet className="h-5 w-5" />
                    Classification & Finances
                  </h3>

                  <div className="space-y-3">
                    {/* COMBOBOX CATEGORIE */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <Label>Catégorie</Label>
                        <AddCategoryDialog
                          companyId={selectedCompanyId || ""}
                          parentCategories={parentCategories}
                          onCategoryAdded={fetchCategories}
                        />
                      </div>
                      <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isCategoryOpen}
                            className="w-full justify-between font-normal"
                          >
                            {formData.category_id
                              ? parentCategories.find((c) => c.id === formData.category_id)?.name
                              : "Sélectionner une catégorie..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Rechercher une catégorie..." />
                            <CommandList>
                              <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
                              <CommandGroup>
                                {parentCategories.map((category) => (
                                  <CommandItem
                                    key={category.id}
                                    value={category.name}
                                    onSelect={() => {
                                      setFormData(prev => ({ ...prev, category_id: category.id, subcategory_id: "" }))
                                      setIsCategoryOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.category_id === category.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {category.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* SOUS-CATEGORIE (Show only if Category Selected) */}
                    <div className="space-y-1">
                      <Label className={cn(!formData.category_id && "text-muted-foreground")}>Sous-catégorie</Label>
                      <Select
                        value={formData.subcategory_id}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, subcategory_id: val }))}
                        disabled={!formData.category_id}
                      >
                        <SelectTrigger><SelectValue placeholder={formData.category_id ? "Choisir..." : "Sélectionnez d'abord une catégorie"} /></SelectTrigger>
                        <SelectContent>
                          {formData.category_id && getSubCategories(formData.category_id).map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 pt-2">
                      <Label htmlFor="iban">IBAN / RIB</Label>
                      <Input id="iban" value={formData.iban} onChange={handleInputChange} placeholder="TN59..." />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="bank_name">Banque</Label>
                      <Input id="bank_name" value={formData.bank_name} onChange={handleInputChange} placeholder="Nom de la banque" />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="balance">Solde Initial (TND)</Label>
                      <Input id="balance" value={formData.balance} onChange={handleInputChange} placeholder="0.000" />
                      <p className="text-[0.8rem] text-muted-foreground">Une valeur positive indique que vous devez de l'argent.</p>
                    </div>

                    <div className="space-y-1 pt-2">
                      <Label htmlFor="notes">Notes internes</Label>
                      <Textarea id="notes" value={formData.notes} onChange={handleInputChange} rows={3} placeholder="Observations..." />
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200 flex items-center gap-2">⚠️ {error}</div>}

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-0 z-10 gap-2">
              {editingSupplier && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(editingSupplier.id)}
                  disabled={isSubmitting}
                  className="mr-auto hidden sm:flex"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </Button>
              )}
              <Button type="button" variant="outline" onClick={resetFormAndClose} disabled={isSubmitting} className="h-11">
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-11 min-w-[150px]">
                {isSubmitting ? "Sauvegarde..." : editingSupplier ? "Enregistrer les modifications" : "Ajouter le fournisseur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
