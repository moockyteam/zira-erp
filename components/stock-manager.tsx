"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StockEntryDialog } from "./stock-entry-dialog"
import { StockImportDialog } from "./stock-import-dialog"
import { CompanySelector } from "@/components/company-selector"

type Company = { id: string; name: string; }
type Item = {
  id: string;
  name: string;
  reference: string | null;
  category: string;
  quantity_on_hand: number;
  unit_of_measure: string | null;
  purchase_price: number | null;
  sale_price: number | null;
}
type Supplier = { id: string; name: string; }

const stockCategories = [
  { value: 'MARCHANDISE', label: 'Marchandise' },
  { value: 'MATIERE_PREMIERE', label: 'Matière Première' },
  { value: 'PRODUIT_SEMI_FINI', label: 'Produit Semi-Fini' },
  { value: 'FOURNITURE_CONSOMMABLE', label: 'Fourniture & Consommable' },
]

export function StockManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [formData, setFormData] = useState({
    name: '', reference: '', category: '', quantity_on_hand: '0',
    unit_of_measure: '', purchase_price: '', sale_price: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyData(selectedCompanyId)
    } else {
      setItems([])
      setSuppliers([])
    }
  }, [selectedCompanyId])

  const fetchCompanyData = async (companyId: string) => {
    setIsLoading(true)
    const [itemsResponse, suppliersResponse] = await Promise.all([
      supabase.from("items").select("*").eq("company_id", companyId).order('name'),
      supabase.from("suppliers").select("id, name").eq("company_id", companyId).order('name')
    ])
    
    if (itemsResponse.error) setError("Impossible de charger les articles.")
    else setItems(itemsResponse.data)

    if (suppliersResponse.error) setError("Impossible de charger les fournisseurs.")
    else setSuppliers(suppliersResponse.data)
    
    setIsLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !formData.name.trim() || !formData.category) {
      setError("Le nom et la catégorie de l'article sont obligatoires.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("items").insert({
      company_id: selectedCompanyId,
      name: formData.name,
      reference: formData.reference || null,
      category: formData.category,
      quantity_on_hand: parseFloat(formData.quantity_on_hand) || 0,
      unit_of_measure: formData.unit_of_measure || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
    });
    
    if (insertError) {
      setError("Erreur lors de la création de l'article.");
      console.error(insertError);
    } else {
      setFormData({ name: '', reference: '', category: '', quantity_on_hand: '0', unit_of_measure: '', purchase_price: '', sale_price: '' });
      await fetchCompanyData(selectedCompanyId);
    }
    setIsLoading(false);
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
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer son inventaire.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Ajouter un nouvel article à l'inventaire</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div><Label htmlFor="name">Nom de l'article *</Label><Input id="name" value={formData.name} onChange={handleInputChange} required /></div>
                  <div><Label htmlFor="reference">Référence (SKU)</Label><Input id="reference" value={formData.reference} onChange={handleInputChange} /></div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                      <SelectContent>
                        {stockCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="quantity_on_hand">Quantité initiale</Label><Input id="quantity_on_hand" type="number" step="0.01" value={formData.quantity_on_hand} onChange={handleInputChange} /></div>
                </div>
                <div className="space-y-4">
                  <div><Label htmlFor="purchase_price">Prix d'achat (HT)</Label><Input id="purchase_price" type="number" step="0.01" placeholder="0.00" value={formData.purchase_price} onChange={handleInputChange} /></div>
                  <div><Label htmlFor="sale_price">Prix de vente (HT)</Label><Input id="sale_price" type="number" step="0.01" placeholder="0.00" value={formData.sale_price} onChange={handleInputChange} /></div>
                </div>
                <div className="md:col-span-3">
                  {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                  <Button type="submit" disabled={isLoading}>{isLoading ? "Ajout en cours..." : "Ajouter l'article"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1.5">
                <CardTitle>Inventaire Actuel</CardTitle>
                <CardDescription>Liste de tous les articles en stock pour cette entreprise.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <StockImportDialog 
                    companyId={selectedCompanyId}
                    onImportSuccess={() => fetchCompanyData(selectedCompanyId)}
                  />
                  <StockEntryDialog 
                    companyId={selectedCompanyId}
                    items={items}
                    suppliers={suppliers}
                    onEntrySuccess={() => fetchCompanyData(selectedCompanyId)}
                  />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Quantité en Stock</TableHead>
                    <TableHead className="text-right">Prix de Vente</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.reference}</TableCell>
                        <TableCell><Badge variant="outline">{stockCategories.find(c => c.value === item.category)?.label}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{item.quantity_on_hand}</TableCell>
                        <TableCell className="text-right font-mono">{item.sale_price ? `${item.sale_price.toFixed(2)} TND` : '-'}</TableCell>
                        <TableCell><Button variant="outline" size="sm">Gérer</Button></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center">{isLoading ? "Chargement..." : "Aucun article dans l'inventaire."}</TableCell></TableRow>
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