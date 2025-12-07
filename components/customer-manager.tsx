// components/customer-manager.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CustomerImportDialog } from "./customer-import-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { CompanySelector } from "@/components/company-selector" // <-- CHANGEMENT: J'importe le bon composant

// Définition des types
type Company = { id: string; name: string; }
type Customer = {
  id: string;
  name: string;
  customer_type: 'PARTICULIER' | 'ENTREPRISE';
  contact_person: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  matricule_fiscal: string | null;
  balance: number | null;
}

const customerTypes = [
  { value: 'ENTREPRISE', label: 'Entreprise' },
  { value: 'PARTICULIER', label: 'Particulier' },
]

const initialAddFormData = {
  name: '', customer_type: 'ENTREPRISE' as 'ENTREPRISE' | 'PARTICULIER', contact_person: '',
  email: '', phone_number: '', address: '', matricule_fiscal: '', balance: '0.000'
};

export function CustomerManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null) // <-- CHANGEMENT: J'autorise null
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addFormData, setAddFormData] = useState(initialAddFormData)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  // <-- CHANGEMENT: Logique de sélection automatique de l'entreprise
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) fetchCustomers(selectedCompanyId)
    else setCustomers([])
  }, [selectedCompanyId])

  const fetchCustomers = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order('name')
    if (error) setError("Impossible de charger les clients.")
    else setCustomers(data as Customer[])
    setIsLoading(false)
  }

  const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddFormData(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId || !addFormData.name.trim()) {
      setError("Le nom du client est obligatoire.")
      return
    }
    setIsLoading(true)
    setError(null)

    const dataToInsert = {
      ...addFormData,
      balance: parseFloat(addFormData.balance) || 0,
      company_id: selectedCompanyId,
    }

    const { error: insertError } = await supabase.from("customers").insert(dataToInsert)
    
    if (insertError) {
      setError("Erreur lors de la création du client.")
      console.error(insertError);
    } else {
      setAddFormData(initialAddFormData)
      await fetchCustomers(selectedCompanyId)
    }
    setIsLoading(false)
  }

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingCustomer) {
      const { id, value } = e.target;
      setEditingCustomer({ ...editingCustomer, [id]: value })
    }
  }

  const handleUpdate = async () => {
    if (!editingCustomer) return
    setIsLoading(true)
    const { error } = await supabase.from('customers').update({
      ...editingCustomer,
      balance: parseFloat(editingCustomer.balance as any) || 0,
    }).eq('id', editingCustomer.id)
    if (error) {
      setError("Erreur lors de la mise à jour.")
      console.error(error);
    } else {
      setIsEditDialogOpen(false)
      await fetchCustomers(selectedCompanyId!)
    }
    setIsLoading(false)
  }

  const handleDelete = async (customerId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      setIsLoading(true)
      const { error } = await supabase.from('customers').delete().eq('id', customerId)
      if (error) setError("Erreur lors de la suppression.")
      else {
        setIsEditDialogOpen(false)
        await fetchCustomers(selectedCompanyId!)
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* <-- CHANGEMENT: Remplacement de l'ancien sélecteur par le composant standard --> */}
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {/* <-- CHANGEMENT: Affichage conditionnel si aucune entreprise n'est sélectionnée --> */}
      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses clients.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Ajouter un nouveau client</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div><Label htmlFor="name">Nom du client *</Label><Input id="name" value={addFormData.name} onChange={handleAddFormChange} required /></div>
                  <div>
                    <Label htmlFor="customer_type">Type de client</Label>
                    <Select value={addFormData.customer_type} onValueChange={(value) => setAddFormData(prev => ({ ...prev, customer_type: value as 'ENTREPRISE' | 'PARTICULIER' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {customerTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                   <div><Label htmlFor="matricule_fiscal">Matricule Fiscal</Label><Input id="matricule_fiscal" value={addFormData.matricule_fiscal} onChange={handleAddFormChange} /></div>
                </div>
                <div className="space-y-4">
                  <div><Label htmlFor="contact_person">Personne de contact</Label><Input id="contact_person" value={addFormData.contact_person} onChange={handleAddFormChange} /></div>
                  <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={addFormData.email} onChange={handleAddFormChange} /></div>
                  <div><Label htmlFor="phone_number">Téléphone</Label><Input id="phone_number" type="tel" value={addFormData.phone_number} onChange={handleAddFormChange} /></div>
                </div>
                <div className="space-y-4">
                  <div><Label htmlFor="address">Adresse</Label><Input id="address" value={addFormData.address} onChange={handleAddFormChange}/></div>
                  <div>
                    <Label htmlFor="balance">Solde initial (TND)</Label>
                    <Input id="balance" type="number" step="0.001" value={addFormData.balance} onChange={handleAddFormChange} />
                    <p className="text-xs text-muted-foreground mt-1">Positif si le client vous doit de l'argent, négatif pour un avoir.</p>
                  </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                  <Button type="submit" disabled={isLoading}>{isLoading ? "Ajout en cours..." : "Ajouter le client"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Liste des Clients</CardTitle><CardDescription>Liste de tous les clients pour cette entreprise.</CardDescription></div>
                <CustomerImportDialog companyId={selectedCompanyId} onImportSuccess={() => fetchCustomers(selectedCompanyId!)} />
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
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell><Badge variant={customer.customer_type === 'ENTREPRISE' ? 'default' : 'secondary'}>{customer.customer_type}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">{customer.matricule_fiscal}</TableCell>
                        <TableCell className="text-right font-mono">
                          {customer.balance != null ? customer.balance.toFixed(3) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setEditingCustomer(customer)}>Gérer</Button>
                          </DialogTrigger>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier le client</DialogTitle>
              </DialogHeader>
              {editingCustomer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div><Label htmlFor="name">Nom</Label><Input id="name" value={editingCustomer.name} onChange={handleEditFormChange} /></div>
                  <div><Label htmlFor="matricule_fiscal">Matricule Fiscal</Label><Input id="matricule_fiscal" value={editingCustomer.matricule_fiscal || ''} onChange={handleEditFormChange} /></div>
                  <div><Label htmlFor="contact_person">Contact</Label><Input id="contact_person" value={editingCustomer.contact_person || ''} onChange={handleEditFormChange} /></div>
                  <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={editingCustomer.email || ''} onChange={handleEditFormChange} /></div>
                  <div><Label htmlFor="phone_number">Téléphone</Label><Input id="phone_number" type="tel" value={editingCustomer.phone_number || ''} onChange={handleEditFormChange} /></div>
                  <div>
                    <Label htmlFor="balance">Solde (TND)</Label>
                    <Input id="balance" type="number" step="0.001" value={editingCustomer.balance ?? '0'} onChange={handleEditFormChange} />
                  </div>
                </div>
              )}
              <DialogFooter className="justify-between">
                <Button variant="destructive" onClick={() => handleDelete(editingCustomer!.id)} disabled={isLoading}>
                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                </Button>
                <Button onClick={handleUpdate} disabled={isLoading}>
                  {isLoading ? "Sauvegarde..." : "Sauvegarder les modifications"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}