// components/stock-issue-manager.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2 } from "lucide-react"
import { PrintButton } from "./print-button"
import { VoucherPreviewDialog } from "./voucher-preview-dialog"
import { CompanySelector } from "@/components/company-selector" // <-- J'ai ajouté l'importation

// Définition des types
type Company = { id: string; name: string; }
type Item = { id: string; name: string; quantity_on_hand: number; }
type VoucherLine = { itemId: string; quantity: string; }
type StockIssueVoucher = {
  id: string;
  reference: string | null;
  reason: string | null;
  voucher_date: string;
}

export function StockIssueManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null) // <-- J'ai ajusté le type pour autoriser null
  const [items, setItems] = useState<Item[]>([])
  const [vouchers, setVouchers] = useState<StockIssueVoucher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [voucherReference, setVoucherReference] = useState('')
  const [voucherReason, setVoucherReason] = useState('')
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([{ itemId: '', quantity: '' }])

  useEffect(() => {
    // Sélectionne la première entreprise par défaut s'il n'y en a qu'une
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyData(selectedCompanyId)
    } else {
      setItems([])
      setVouchers([])
    }
  }, [selectedCompanyId])

  const fetchCompanyData = async (companyId: string) => {
    setIsLoading(true)
    const [itemsResponse, vouchersResponse] = await Promise.all([
      supabase.from("items").select("id, name, quantity_on_hand").eq("company_id", companyId).order('name'),
      supabase.from("stock_issue_vouchers").select("*").eq("company_id", companyId).order('created_at', { ascending: false })
    ])
    
    if (itemsResponse.error) console.error("Erreur chargement articles:", itemsResponse.error)
    else setItems(itemsResponse.data)

    if (vouchersResponse.error) console.error("Erreur chargement bons:", vouchersResponse.error)
    else setVouchers(vouchersResponse.data)
    setIsLoading(false)
  }

  const addLine = () => setVoucherLines([...voucherLines, { itemId: '', quantity: '' }]);
  const removeLine = (index: number) => setVoucherLines(voucherLines.filter((_, i) => i !== index));
  const updateLine = (index: number, field: keyof VoucherLine, value: string) => {
    const newLines = [...voucherLines];
    newLines[index][field] = value;
    setVoucherLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!selectedCompanyId) return;
    setIsLoading(true)
    setError(null)

    if (!voucherReference.trim() || voucherLines.some(line => !line.itemId || !line.quantity || parseFloat(line.quantity) <= 0)) {
      setError("La référence et toutes les lignes (article/quantité) sont obligatoires.")
      setIsLoading(false)
      return
    }

    const { data: voucherData, error: voucherError } = await supabase
      .from('stock_issue_vouchers').insert({ company_id: selectedCompanyId, reference: voucherReference, reason: voucherReason }).select('id').single()

    if (voucherError || !voucherData) {
      setError("Erreur lors de la création du bon de sortie.")
      setIsLoading(false)
      return
    }

    const linesToInsert = voucherLines.map(line => ({ voucher_id: voucherData.id, item_id: line.itemId, quantity: parseFloat(line.quantity) }))
    const { error: linesError } = await supabase.from('stock_issue_voucher_lines').insert(linesToInsert)

    if (linesError) {
      setError("Erreur lors de l'ajout des articles au bon de sortie.")
    } else {
      alert("Bon de sortie créé avec succès ! Le stock a été mis à jour.")
      setVoucherReference('')
      setVoucherReason('')
      setVoucherLines([{ itemId: '', quantity: '' }])
      await fetchCompanyData(selectedCompanyId)
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-8">
      {/* --- J'AI REMPLACÉ L'ANCIEN SÉLECTEUR PAR LE COMPOSANT RÉUTILISABLE --- */}
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses bons de sortie.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <div className="space-y-8">
          {/* CARTE 1 : FORMULAIRE DE CRÉATION */}
          <Card>
            <CardHeader>
              <CardTitle>Créer un nouveau Bon de Sortie</CardTitle>
              <CardDescription>Ce document enregistrera une sortie de stock pour un usage interne, une perte, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reference">Référence du Bon *</Label>
                    <Input id="reference" value={voucherReference} onChange={e => setVoucherReference(e.target.value)} placeholder="Ex: BS-2025-001" required />
                  </div>
                  <div>
                    <Label htmlFor="reason">Motif de la sortie</Label>
                    <Textarea id="reason" value={voucherReason} onChange={e => setVoucherReason(e.target.value)} placeholder="Ex: Utilisation pour projet X, Casse..." />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label>Articles à sortir</Label>
                  {voucherLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                      <Select value={line.itemId} onValueChange={value => updateLine(index, 'itemId', value)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Choisir un article..." /></SelectTrigger>
                        <SelectContent>
                          {items.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} (Stock: {item.quantity_on_hand})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Qté" className="w-24" value={line.quantity} onChange={e => updateLine(index, 'quantity', e.target.value)} step="0.01" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={voucherLines.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLine}><PlusCircle className="h-4 w-4 mr-2" /> Ajouter une ligne</Button>
                </div>
                <div>
                  {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                  <Button type="submit" disabled={isLoading}>{isLoading ? "Création en cours..." : "Valider le Bon de Sortie"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* CARTE 2 : LISTE DE L'HISTORIQUE */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des Bons de Sortie</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
                  ) : vouchers.length > 0 ? (
                    vouchers.map((voucher) => (
                      <TableRow key={voucher.id}>
                        <TableCell className="font-medium">{voucher.reference}</TableCell>
                        <TableCell>{new Date(voucher.voucher_date).toLocaleString('fr-FR')}</TableCell>
                        <TableCell>{voucher.reason}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          <VoucherPreviewDialog voucherId={voucher.id} />
                          <PrintButton voucherId={voucher.id} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        Aucun bon de sortie pour cette entreprise.
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