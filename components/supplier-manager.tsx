// components/supplier-manager.tsx

"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { CompanySelector } from "@/components/company-selector"
import { CategoryCreator } from "@/components/category-creator"
import { SupplierImportDialog } from "@/components/supplier-import-dialog" // NOUVEAU

// --- TYPES ---
type Company = { id: string; name: string }
type SupplierCategory = { id: string; name: string }
type Supplier = {
  id: string; name: string; contact_person: string | null; email: string | null; phone_number: string | null;
  matricule_fiscal: string | null; category_id: string | null; balance: number | null; address: string | null;
  city: string | null; country: string | null; iban: string | null; notes: string | null;
  supplier_categories: { name: string } | null;
}

const initialFormData = {
  name: '', contact_person: '', email: '', phone_number: '', matricule_fiscal: '', category_id: null as string | null,
  balance: 0, address: '', city: '', country: '', iban: '', notes: '',
}

export function SupplierManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  // --- ÉTATS (STATE) ---
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<SupplierCategory[]>([])
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // NOUVEAU: États pour la recherche et le filtre
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState("all")

  // --- EFFETS (EFFECTS) ---
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) fetchInitialData(selectedCompanyId)
    else { setSuppliers([]); setCategories([]); setIsInitialLoading(false) }
  }, [selectedCompanyId])

  // --- FONCTIONS DE DONNÉES ---
  const fetchInitialData = async (companyId: string) => {
    setIsInitialLoading(true)
    await Promise.all([fetchSuppliers(companyId), fetchCategories(companyId)])
    setIsInitialLoading(false)
  }
  const fetchSuppliers = async (companyId: string) => {
    const { data, error } = await supabase.from("suppliers").select("*, supplier_categories(name)").eq("company_id", companyId).order('name')
    if (error) toast.error("Impossible de charger les fournisseurs.")
    else setSuppliers(data as Supplier[])
  }
  const fetchCategories = async (companyId: string) => {
    const { data, error } = await supabase.from("supplier_categories").select("id, name").eq("company_id", companyId).order('name')
    if (error) toast.error("Impossible de charger les catégories.")
    else setCategories(data)
  }

  // --- LOGIQUE DE FILTRAGE ---
  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(s => filterCategoryId === 'all' || s.category_id === filterCategoryId)
  }, [suppliers, searchTerm, filterCategoryId])

  // --- GESTION DU FORMULAIRE ---
  const resetFormAndClose = () => { setEditingSupplier(null); setFormData(initialFormData); setIsFormOpen(false) }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }
  const handleAddNewClick = () => { setEditingSupplier(null); setFormData(initialFormData); setIsFormOpen(true) }
 const handleEditClick = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    // --- LA CORRECTION EST ICI ---
    // On s'assure que chaque champ potentiellement null est converti en chaîne vide
    setFormData({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone_number: supplier.phone_number || '',
      matricule_fiscal: supplier.matricule_fiscal || '',
      category_id: supplier.category_id || null, // category_id peut rester null car il est géré par le <Select>
      balance: supplier.balance || 0,
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || '',
      iban: supplier.iban || '',
      notes: supplier.notes || '',
    })
    // --- FIN DE LA CORRECTION ---
    setIsFormOpen(true)
  }

  // --- ACTIONS CRUD ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId) return
    setIsSubmitting(true)
    const dataToSubmit = { ...formData, company_id: selectedCompanyId, balance: Number(formData.balance) || 0 }
    if (editingSupplier) {
      const { error } = await supabase.from("suppliers").update(dataToSubmit).eq("id", editingSupplier.id)
      if (error) toast.error(error.message)
      else { toast.success("Fournisseur mis à jour."); resetFormAndClose(); await fetchSuppliers(selectedCompanyId) }
    } else {
      const { error } = await supabase.from("suppliers").insert(dataToSubmit)
      if (error) toast.error(error.message)
      else { toast.success("Fournisseur ajouté."); resetFormAndClose(); await fetchSuppliers(selectedCompanyId) }
    }
    setIsSubmitting(false)
  }
  const handleDelete = async (supplierId: string) => {
    if (window.confirm("Êtes-vous sûr ?")) {
      const { error } = await supabase.from('suppliers').delete().eq('id', supplierId)
      if (error) toast.error(error.message)
      else { toast.success("Fournisseur supprimé."); resetFormAndClose(); await fetchSuppliers(selectedCompanyId!) }
    }
  }

  // --- EXPORT EXCEL ---
  const handleExport = () => {
    const dataToExport = filteredSuppliers.map(s => ({
      "Nom": s.name, "Matricule Fiscal": s.matricule_fiscal, "Contact": s.contact_person,
      "Email": s.email, "Téléphone": s.phone_number, "Adresse": s.address, "Ville": s.city,
      "Pays": s.country, "IBAN": s.iban, "Notes": s.notes, "Solde": s.balance,
      "Catégorie": s.supplier_categories?.name,
    }))
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fournisseurs")
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" })
    saveAs(data, `fournisseurs_${selectedCompanyId}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-8">
      <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} />

      {!selectedCompanyId && userCompanies.length > 1 && <Card className="text-center py-12"><CardContent><p>Veuillez sélectionner une entreprise.</p></CardContent></Card>}

      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div><CardTitle>Liste des Fournisseurs</CardTitle><CardDescription>Gérez les fournisseurs de l'entreprise.</CardDescription></div>
            <div className="flex items-center gap-2">
              <SupplierImportDialog companyId={selectedCompanyId} onImportSuccess={() => fetchSuppliers(selectedCompanyId)} />
              <Button onClick={handleExport}>Exporter</Button>
              <Button onClick={handleAddNewClick}>Ajouter</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Input placeholder="Rechercher par nom..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
              <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun fournisseur trouvé.</TableCell></TableRow>
                ) : (
                  filteredSuppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.supplier_categories?.name || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">{s.contact_person}</TableCell>
                      <TableCell className="text-right font-mono">{s.balance?.toFixed(2) || '0.00'} TND</TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => handleEditClick(s)}>Gérer</Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingSupplier ? `Modifier : ${editingSupplier.name}` : "Ajouter un fournisseur"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2"><Label>Informations Principales</Label></div>
            <div><Input id="name" placeholder="Nom *" value={formData.name} onChange={handleInputChange} required /></div>
            <div><Input id="matricule_fiscal" placeholder="Matricule Fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} /></div>
            <div className="md:col-span-2"><Label>Contact</Label></div>
            <div><Input id="contact_person" placeholder="Personne de contact" value={formData.contact_person} onChange={handleInputChange} /></div>
            <div><Input id="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} /></div>
            <div><Input id="phone_number" type="tel" placeholder="Téléphone" value={formData.phone_number} onChange={handleInputChange} /></div>
            <div><Input id="address" placeholder="Adresse" value={formData.address} onChange={handleInputChange} /></div>
            <div><Input id="city" placeholder="Ville" value={formData.city} onChange={handleInputChange} /></div>
            <div><Input id="country" placeholder="Pays" value={formData.country} onChange={handleInputChange} /></div>
            <div className="md:col-span-2"><Label>Informations Financières et Catégorie</Label></div>
            <div><Input id="iban" placeholder="IBAN / RIB" value={formData.iban} onChange={handleInputChange} /></div>
            <div><Input id="balance" type="number" step="0.01" placeholder="Solde initial" value={formData.balance} onChange={handleInputChange} /></div>
            <div className="md:col-span-2 flex gap-2">
              <Select value={formData.category_id || ''} onValueChange={(v) => setFormData(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Catégorie..." /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <CategoryCreator companyId={selectedCompanyId!} onCategoryCreated={() => fetchCategories(selectedCompanyId!)} />
            </div>
          </form>
          <DialogFooter className="justify-between">
            {editingSupplier ? <Button variant="destructive" onClick={() => handleDelete(editingSupplier.id)}><Trash2 className="h-4 w-4 mr-2" /> Supprimer</Button> : <div></div>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={resetFormAndClose}>Annuler</Button>
              <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Sauvegarde..." : "Sauvegarder"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}