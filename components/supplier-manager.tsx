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

// Définition des types pour les données que nous allons manipuler
type Company = {
  id: string;
  name: string;
}
type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone_number: string | null;
  matricule_fiscal: string | null;
}

// Le composant accepte la liste des entreprises de l'utilisateur en props
export function SupplierManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  // États
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [formData, setFormData] = useState({ name: '', contact_person: '', email: '', phone_number: '', matricule_fiscal: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Effet : se déclenche quand l'utilisateur change d'entreprise dans le menu déroulant
  useEffect(() => {
    if (selectedCompanyId) {
      fetchSuppliers(selectedCompanyId)
    } else {
      setSuppliers([]) // Vider la liste si aucune entreprise n'est sélectionnée
    }
  }, [selectedCompanyId])

  // Fonction pour charger les fournisseurs de l'entreprise sélectionnée
  const fetchSuppliers = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("company_id", companyId)
    
    if (error) {
      console.error("Erreur de chargement des fournisseurs:", error)
      setError("Impossible de charger les fournisseurs.")
    } else {
      setSuppliers(data)
    }
    setIsLoading(false)
  }

  // Gérer les changements dans les champs du formulaire
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  // Gérer la soumission du formulaire pour ajouter un nouveau fournisseur
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError("Le nom du fournisseur est obligatoire.")
      return
    }
    setIsLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from("suppliers")
      .insert({ ...formData, company_id: selectedCompanyId })
    
    if (insertError) {
      setError("Erreur lors de la création du fournisseur.")
      console.error(insertError)
    } else {
      setFormData({ name: '', contact_person: '', email: '', phone_number: '', matricule_fiscal: '' }) // Vider le formulaire
      await fetchSuppliers(selectedCompanyId) // Recharger la liste
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionnez une entreprise</CardTitle>
          <CardDescription>Choisissez l'entreprise pour laquelle vous souhaitez gérer les fournisseurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Cliquez pour choisir..." />
            </SelectTrigger>
            <SelectContent>
              {userCompanies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Cette section ne s'affiche que si une entreprise est sélectionnée */}
      {selectedCompanyId && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un nouveau fournisseur</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div><Label htmlFor="name">Nom du fournisseur *</Label><Input id="name" value={formData.name} onChange={handleInputChange} required /></div>
                  <div><Label htmlFor="contact_person">Personne de contact</Label><Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} /></div>
                  <div><Label htmlFor="matricule_fiscal">Matricule Fiscal</Label><Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} /></div>
                </div>
                <div className="space-y-4">
                  <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formData.email} onChange={handleInputChange} /></div>
                  <div><Label htmlFor="phone_number">Téléphone</Label><Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} /></div>
                </div>
                <div className="md:col-span-2">
                  {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Ajout en cours..." : "Ajouter le fournisseur"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Liste des Fournisseurs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length > 0 ? (
                    suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact_person}</TableCell>
                        <TableCell>{supplier.email}</TableCell>
                        <TableCell>{supplier.phone_number}</TableCell>
                        <TableCell><Button variant="outline" size="sm">Gérer</Button></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        {isLoading ? "Chargement..." : "Aucun fournisseur pour cette entreprise."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
