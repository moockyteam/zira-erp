"use client"

import type React from "react"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2, FileText, Package, PackageX, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { PrintButton } from "./print-button"
import { VoucherPreviewDialog } from "./voucher-preview-dialog"
import { StockIssueFormDialog } from "./stock-issue-form-dialog"
import { useCompany } from "@/components/providers/company-provider"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

// Définition des types
type Company = { id: string; name: string }
type Item = { id: string; name: string; quantity_on_hand: number }
type VoucherLine = { itemId: string; quantity: string }
type StockIssueVoucher = {
  id: string
  reference: string | null
  reason: string | null
  voucher_date: string
  created_at?: string
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



  // Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

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
    <div className="space-y-6">
      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <PackageX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses bons de sortie.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          <PageHeader
            title="Bons de Sortie"
            description="Gérez les sorties de stock (pertes, consommation interne, etc.)"
            icon={PackageX}
          >
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="lg"
              className="shadow-sm"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Bon de Sortie
            </Button>
          </PageHeader>

          <div className="grid grid-cols-1 gap-8">


            {/* COLONNE 2 : HISTORIQUE (LISTE) */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Historique</h3>
                <FilterToolbar
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  searchPlaceholder="Rechercher..."
                  resultCount={filteredVouchers.length}
                  resultLabel="bons"
                />
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
      <StockIssueFormDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        companyId={selectedCompanyId || ""}
        onSuccess={() => selectedCompanyId && fetchCompanyData(selectedCompanyId)}
      />
    </div>
  )
}
