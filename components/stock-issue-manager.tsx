// components/stock-issue-manager.tsx
"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2, FileText, Package, Truck } from "lucide-react"
import { PrintButton } from "./print-button"
import { VoucherPreviewDialog } from "./voucher-preview-dialog"
import { CompanySelector } from "@/components/company-selector"

// Définition des types
type Company = { id: string; name: string }
type Item = { id: string; name: string; quantity_on_hand: number }
type VoucherLine = { itemId: string; quantity: string }
type StockIssueVoucher = {
  id: string
  reference: string | null
  reason: string | null
  voucher_date: string
}

export function StockIssueManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null) // <-- J'ai ajusté le type pour autoriser null
  const [items, setItems] = useState<Item[]>([])
  const [vouchers, setVouchers] = useState<StockIssueVoucher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [voucherReference, setVoucherReference] = useState("")
  const [voucherReason, setVoucherReason] = useState("")
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([{ itemId: "", quantity: "" }])

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
      supabase.from("items").select("id, name, quantity_on_hand").eq("company_id", companyId).order("name"),
      supabase
        .from("stock_issue_vouchers")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ])

    if (itemsResponse.error) console.error("Erreur chargement articles:", itemsResponse.error)
    else setItems(itemsResponse.data)

    if (vouchersResponse.error) console.error("Erreur chargement bons:", vouchersResponse.error)
    else setVouchers(vouchersResponse.data)
    setIsLoading(false)
  }

  const addLine = () => setVoucherLines([...voucherLines, { itemId: "", quantity: "" }])
  const removeLine = (index: number) => setVoucherLines(voucherLines.filter((_, i) => i !== index))
  const updateLine = (index: number, field: keyof VoucherLine, value: string) => {
    const newLines = [...voucherLines]
    newLines[index][field] = value
    setVoucherLines(newLines)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId) return
    setIsLoading(true)
    setError(null)

    if (
      !voucherReference.trim() ||
      voucherLines.some((line) => !line.itemId || !line.quantity || Number.parseFloat(line.quantity) <= 0)
    ) {
      setError("La référence et toutes les lignes (article/quantité) sont obligatoires.")
      setIsLoading(false)
      return
    }

    const { data: voucherData, error: voucherError } = await supabase
      .from("stock_issue_vouchers")
      .insert({ company_id: selectedCompanyId, reference: voucherReference, reason: voucherReason })
      .select("id")
      .single()

    if (voucherError || !voucherData) {
      setError("Erreur lors de la création du bon de sortie.")
      setIsLoading(false)
      return
    }

    const linesToInsert = voucherLines.map((line) => ({
      voucher_id: voucherData.id,
      item_id: line.itemId,
      quantity: Number.parseFloat(line.quantity),
    }))
    const { error: linesError } = await supabase.from("stock_issue_voucher_lines").insert(linesToInsert)

    if (linesError) {
      setError("Erreur lors de l'ajout des articles au bon de sortie.")
    } else {
      alert("Bon de sortie créé avec succès ! Le stock a été mis à jour.")
      setVoucherReference("")
      setVoucherReason("")
      setVoucherLines([{ itemId: "", quantity: "" }])
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
          <Card className="border-l-4 border-l-orange-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Créer un nouveau Bon de Sortie</CardTitle>
                  <CardDescription>
                    Enregistrez une sortie de stock pour usage interne, perte ou autre motif
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                  <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informations Générales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reference" className="text-sm font-medium">
                        Référence du Bon *
                      </Label>
                      <Input
                        id="reference"
                        value={voucherReference}
                        onChange={(e) => setVoucherReference(e.target.value)}
                        placeholder="Ex: BS-2025-001"
                        required
                        className="border-2 focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reason" className="text-sm font-medium">
                        Motif de la sortie
                      </Label>
                      <Textarea
                        id="reason"
                        value={voucherReason}
                        onChange={(e) => setVoucherReason(e.target.value)}
                        placeholder="Ex: Utilisation pour projet X, Casse..."
                        className="border-2 focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Articles à Sortir
                  </h3>
                  <div className="space-y-3">
                    {voucherLines.map((line, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 border-2 border-emerald-200 dark:border-emerald-800 rounded-md bg-white dark:bg-gray-950 hover:shadow-md transition-shadow"
                      >
                        <Select value={line.itemId} onValueChange={(value) => updateLine(index, "itemId", value)}>
                          <SelectTrigger className="flex-1 border-2">
                            <SelectValue placeholder="Choisir un article..." />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} (Stock: {item.quantity_on_hand})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="text"
                          placeholder="Quantité"
                          className="w-32 border-2"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, "quantity", e.target.value.replace(",", "."))}
                          step="0.01"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={voucherLines.length <= 1}
                          className="hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLine}
                      className="w-full border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 bg-transparent"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Ajouter une ligne
                    </Button>
                  </div>
                </div>

                <div>
                  {error && (
                    <p className="text-sm text-destructive mb-4 p-3 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-md">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    {isLoading ? "Création en cours..." : "Valider le Bon de Sortie"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-xl">Historique des Bons de Sortie</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-blue-200 dark:border-blue-800">
                    <TableHead className="font-semibold text-blue-700 dark:text-blue-300">Référence</TableHead>
                    <TableHead className="font-semibold text-blue-700 dark:text-blue-300">Date</TableHead>
                    <TableHead className="font-semibold text-blue-700 dark:text-blue-300">Motif</TableHead>
                    <TableHead className="font-semibold text-blue-700 dark:text-blue-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : vouchers.length > 0 ? (
                    vouchers.map((voucher) => (
                      <TableRow
                        key={voucher.id}
                        className="border-b-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <TableCell className="font-medium">{voucher.reference}</TableCell>
                        <TableCell>{new Date(voucher.voucher_date).toLocaleString("fr-FR")}</TableCell>
                        <TableCell>{voucher.reason}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          <VoucherPreviewDialog voucherId={voucher.id} />
                          <PrintButton voucherId={voucher.id} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
