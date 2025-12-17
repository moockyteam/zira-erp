// components/customer-manager.tsx

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

// Importations des composants UI
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch" // NOUVEAU: Importation du Switch pour la TVA
import { CompanySelector } from "@/components/company-selector"
import { CustomerImportDialog } from "./customer-import-dialog"

// --- TYPES ---
type Company = { id: string; name: string; }
// MODIFIÉ: Ajout du champ pour la TVA
type Customer = {
  id: string;
  name: string;
  customer_type: 'PARTICULIER' | 'ENTREPRISE';
  contact_person: string | null;
  email: string | null;
  phone_number: string | null;
  street: string | null;
  delegation: string | null;
  governorate: string | null;
  country: string | null;
  matricule_fiscal: string | null;
  balance: number | null;
  is_subject_to_vat: boolean | null; // NOUVEAU: Champ pour la TVA
}

const customerTypes = [
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'PARTICULIER', label: 'Particulier' },
]

// MODIFIÉ: Mise à jour de l'état initial du formulaire
const initialFormData = {
  name: '', customer_type: 'ENTREPRISE' as 'ENTREPRISE' | 'PARTICULIER', contact_person: '',
  email: '', phone_number: '', street: '', delegation: '', governorate: '', country: 'Tunisie',
  matricule_fiscal: '', balance: '0.000', is_subject_to_vat: false, // NOUVEAU
};

export function CustomerManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  // --- ÉTATS (STATE) ---
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  
  // NOUVEAU: États pour gérer l'UX
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- EFFETS (EFFECTS) ---
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId)
    } else {
      setCustomers([])
      setIsInitialLoading(false)
    }
  }, [selectedCompanyId])

  // --- FONCTIONS ---
  const fetchCustomers = async (companyId: string) => {
    setIsInitialLoading(true)
    const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order('name')
    if (error) {
      toast.error("Impossible de charger les clients.")
      console.error(error)
    } else {
      setCustomers(data as Customer[])
    }
    setIsInitialLoading(false)
  }

  const resetFormAndClose = () => {
    setEditingCustomer(null)
    setFormData(initialFormData)
    setIsFormOpen(false)
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleAddNewClick = () => {
    setEditingCustomer(null)
    setFormData(initialFormData)
    setIsFormOpen(true)
  }

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      ...initialFormData,
      ...customer,
      balance: customer.balance?.toString() ?? '0.000',
      is_subject_to_vat: customer.is_subject_to_vat ?? false,
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
      balance: parseFloat(formData.balance) || 0,
      company_id: selectedCompanyId,
    }

    if (editingCustomer) { // Mode Mise à jour
      const { error: updateError } = await supabase.from("customers").update(dataToSubmit).eq("id", editingCustomer.id)
      if (updateError) {
        setError("Erreur lors de la mise à jour.")
        toast.error(`Erreur: ${updateError.message}`)
      } else {
        toast.success(`Client "${formData.name}" mis à jour.`)
        resetFormAndClose()
        await fetchCustomers(selectedCompanyId)
      }
    } else { // Mode Création
      const { error: insertError } = await supabase.from("customers").insert(dataToSubmit)
      if (insertError) {
        setError("Erreur lors de la création du client.")
        toast.error(`Erreur: ${insertError.message}`)
      } else {
        toast.success("Nouveau client ajouté avec succès !")
        resetFormAndClose()
        await fetchCustomers(selectedCompanyId)
      }
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (customerId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.")) {
      setIsSubmitting(true)
      const { error } = await supabase.from('customers').delete().eq('id', customerId)
      if (error) {
        toast.error("Erreur lors de la suppression.")
      } else {
        toast.success("Client supprimé.")
        resetFormAndClose()
        await fetchCustomers(selectedCompanyId!)
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
          <CardContent><p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses clients.</p></CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Liste des Clients</CardTitle>
              <CardDescription>Liste de tous les clients pour l'entreprise sélectionnée.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <CustomerImportDialog companyId={selectedCompanyId} onImportSuccess={() => fetchCustomers(selectedCompanyId!)} />
              <Button onClick={handleAddNewClick}>Ajouter un client</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule Fiscal</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[70px]" /></TableCell>
                    </TableRow>
                  ))
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Aucun client trouvé pour cette entreprise.
                      <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                        Ajoutez votre premier client.
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell><Badge variant={customer.customer_type === 'ENTREPRISE' ? 'default' : 'secondary'}>{customer.customer_type}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">{customer.matricule_fiscal}</TableCell>
                      <TableCell className="text-right font-mono">{customer.balance != null ? customer.balance.toFixed(3) : 'N/A'}</TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => handleEditClick(customer)}>Gérer</Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODIFIÉ: La modale unifiée pour l'ajout et la modification */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? `Modifier : ${editingCustomer.name}` : "Ajouter un nouveau client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            {/* Colonne 1 */}
            <div className="space-y-4">
              <div><Label htmlFor="name">Nom du client *</Label><Input id="name" value={formData.name} onChange={handleInputChange} required /></div>
              <div>
                <Label htmlFor="customer_type">Type de client</Label>
                <Select value={formData.customer_type} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_type: value as 'ENTREPRISE' | 'PARTICULIER' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{customerTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="matricule_fiscal">Matricule Fiscal</Label><Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} /></div>
              <div><Label htmlFor="contact_person">Personne de contact</Label><Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} /></div>
              <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formData.email} onChange={handleInputChange} /></div>
              <div><Label htmlFor="phone_number">Téléphone</Label><Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} /></div>
            </div>
            {/* Colonne 2 */}
            <div className="space-y-4">
              <div><Label htmlFor="street">Rue et numéro</Label><Input id="street" value={formData.street} onChange={handleInputChange}/></div>
              <div><Label htmlFor="delegation">Délégation / Ville</Label><Input id="delegation" value={formData.delegation} onChange={handleInputChange}/></div>
              <div><Label htmlFor="governorate">Gouvernorat / Région</Label><Input id="governorate" value={formData.governorate} onChange={handleInputChange}/></div>
              <div><Label htmlFor="country">Pays</Label><Input id="country" value={formData.country} onChange={handleInputChange}/></div>
              <div>
                <Label htmlFor="balance">Solde initial (TND)</Label>
                <Input id="balance" type="number" step="0.001" value={formData.balance} onChange={handleInputChange} />
              </div>
              {/* NOUVEAU: Champ pour la TVA */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="is_subject_to_vat">Client soumis à la TVA ?</Label>
                <Switch id="is_subject_to_vat" checked={formData.is_subject_to_vat} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_subject_to_vat: checked }))} />
              </div>
            </div>
            {error && <p className="md:col-span-2 text-sm text-destructive">{error}</p>}
            <DialogFooter className="md:col-span-2 pt-4">
              {editingCustomer && (
                <Button type="button" variant="destructive" onClick={() => handleDelete(editingCustomer.id)} disabled={isSubmitting} className="mr-auto">
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={resetFormAndClose} disabled={isSubmitting}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Sauvegarde..." : "Sauvegarder"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
