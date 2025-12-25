"use client"

import type React from "react"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2, FileText, Package, Truck, ArrowUpDown, ChevronUp, ChevronDown, Search, PackageX } from "lucide-react"
import { PrintButton } from "./print-button"
import { VoucherPreviewDialog } from "./voucher-preview-dialog"
import { useCompany } from "@/components/providers/company-provider"
import { SearchInput } from "@/components/ui/search-input"
import { cn } from "@/lib/utils"

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

type SortConfig = {
  key: keyof StockIssueVoucher
  direction: "asc" | "desc"
}

export function StockIssueManager({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [items, setItems] = useState<Item[]>([])
  const [vouchers, setVouchers] = useState<StockIssueVoucher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [voucherReference, setVoucherReference] = useState("")
  const [voucherReason, setVoucherReason] = useState("")
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([{ itemId: "", quantity: "" }])

  // List Filter & Sort State
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "voucher_date", direction: "desc" })

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
      supabase.from("items").select("id, name, quantity_on_hand").eq("company_id", companyId).eq("is_archived", false).order("name"),
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
      // alert("Bon de sortie créé avec succès ! Le stock a été mis à jour.") // Removed alert for better UX
      setVoucherReference("")
      setVoucherReason("")
      setVoucherLines([{ itemId: "", quantity: "" }])
      await fetchCompanyData(selectedCompanyId)
    }
    setIsLoading(false)
  }

  // Filtering & Sorting Logic
  const filteredVouchers = useMemo(() => {
    let result = [...vouchers]

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter((v) =>
        (v.reference || "").toLowerCase().includes(lowerTerm) ||
        (v.reason || "").toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key]
      let bValue: any = b[sortConfig.key]

      // Handle nulls
      if (aValue === null) aValue = ""
      if (bValue === null) bValue = ""

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [vouchers, searchTerm, sortConfig])

  const requestSort = (key: keyof StockIssueVoucher) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof StockIssueVoucher) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  return (
    <div className="space-y-8">
      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <PackageX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses bons de sortie.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* COLONNE 1 : FORMULAIRE DE CRÉATION */}
          <div className="space-y-6">
            {/* Note: Keeping the Card style for the Form to distinguish it as an input area, but cleaning it up */}
            <Card className="border-l-4 border-l-orange-500 shadow-md">
              <CardHeader className="bg-orange-50/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-orange-950">Nouveau Bon de Sortie</CardTitle>
                    <CardDescription>
                      Enregistrez une sortie de stock (perte, usage interne...)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* General Info */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reference" className="text-xs font-semibold uppercase text-muted-foreground">
                          Référence *
                        </Label>
                        <Input
                          id="reference"
                          value={voucherReference}
                          onChange={(e) => setVoucherReference(e.target.value)}
                          placeholder="Ex: BS-2025-001"
                          required
                          className="h-10 border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason" className="text-xs font-semibold uppercase text-muted-foreground">
                          Motif
                        </Label>
                        <Input
                          id="reason"
                          value={voucherReason}
                          onChange={(e) => setVoucherReason(e.target.value)}
                          placeholder="Ex: Utilisation interne"
                          className="h-10 border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-500" />
                        Articles
                      </h3>
                    </div>

                    {voucherLines.map((line, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 space-y-1">
                          <Select value={line.itemId} onValueChange={(value) => updateLine(index, "itemId", value)}>
                            <SelectTrigger className={cn("h-10", !line.itemId && "text-muted-foreground")}>
                              <SelectValue placeholder="Sélectionner un article" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  <span className="font-medium">{item.name}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">(Stock: {item.quantity_on_hand})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Input
                            type="number"
                            placeholder="Qté"
                            className="h-10 text-right"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, "quantity", e.target.value)}
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={voucherLines.length <= 1}
                          className="h-10 w-10 text-muted-foreground hover:text-red-600 hover:bg-red-50"
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
                      className="w-full mt-2 border-dashed text-muted-foreground hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Ajouter un article
                    </Button>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white shadow-md transition-all h-11"
                  >
                    {isLoading ? "Création en cours..." : "Valider la Sortie de Stock"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* COLONNE 2 : HISTORIQUE (LISTE) */}
          <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground">Historique</CardTitle>
                    <CardDescription>Liste des bons de sortie créés</CardDescription>
                  </div>
                  <SearchInput
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm("")}
                    className="w-full sm:w-[250px]"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead
                          className="cursor-pointer hover:text-primary transition-colors h-10"
                          onClick={() => requestSort("reference")}
                        >
                          <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Référence {getSortIcon("reference")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:text-primary transition-colors h-10"
                          onClick={() => requestSort("voucher_date")}
                        >
                          <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Date {getSortIcon("voucher_date")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:text-primary transition-colors h-10"
                          onClick={() => requestSort("reason")}
                        >
                          <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Motif {getSortIcon("reason")}
                          </div>
                        </TableHead>
                        <TableHead className="h-10 w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Chargement...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredVouchers.length > 0 ? (
                        filteredVouchers.map((voucher) => (
                          <TableRow
                            key={voucher.id}
                            className="group hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="font-medium text-foreground">
                              {voucher.reference || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(voucher.voucher_date).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="text-muted-foreground truncate max-w-[150px]" title={voucher.reason || ""}>
                              {voucher.reason || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <VoucherPreviewDialog voucherId={voucher.id} />
                                <PrintButton voucherId={voucher.id} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-[200px] text-center">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <PackageX className="h-10 w-10 text-muted-foreground/20" />
                              {searchTerm ? (
                                <>
                                  <p className="text-sm text-muted-foreground">Aucun résultat trouvé.</p>
                                  <Button variant="link" onClick={() => setSearchTerm("")} className="text-primary h-auto p-0">
                                    Effacer la recherche
                                  </Button>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">Aucun historique.</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
