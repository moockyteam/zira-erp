"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCompany } from "@/components/providers/company-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Package, ArrowUpDown, ChevronUp, ChevronDown, PackageX, TrendingDown, FileText } from "lucide-react"
import { ReturnVoucherActions } from "./return-voucher-actions"
import { ReturnVoucherForm } from "./return-voucher-form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
// Import standardized components
import { PageHeader } from "@/components/ui/page-header"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

type ReturnVoucher = {
  id: string
  return_voucher_number: string
  customers: { name: string } | null
  return_date: string
  status: "BROUILLON" | "RETOURNE" | "ANNULE"
  return_voucher_lines?: any[]
}

type SortConfig = {
  key: keyof ReturnVoucher | "customer_name"
  direction: "asc" | "desc"
}

export function ReturnVoucherManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [returns, setReturns] = useState<ReturnVoucher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReturn, setEditingReturn] = useState<any | null>(null)

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "return_date", direction: "desc" })

  useEffect(() => {
    if (selectedCompanyId) {
      fetchReturns(selectedCompanyId)
    } else {
      setReturns([])
      setIsLoading(false)
    }
  }, [selectedCompanyId])

  const fetchReturns = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("return_vouchers")
      .select(`
        *, 
        customers(id, name),
        return_voucher_lines(*)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur lors du chargement des bons de retour:", error);
    } else {
      // Map the data to handle Supabase returning arrays for joined relations
      const formattedData = (data as any[]).map(item => ({
        ...item,
        customers: Array.isArray(item.customers) && item.customers.length > 0
          ? item.customers[0]
          : item.customers
      }))
      setReturns(formattedData as ReturnVoucher[])
    }
    setIsLoading(false)
  }

  const handleOpenForm = (returnVoucher: any | null) => {
    setEditingReturn(returnVoucher)
    setIsFormOpen(true)
  }

  // Statistics
  const stats = useMemo(() => {
    const totalReturns = returns.length
    const thisMonthReturns = returns.filter((r) => {
      const returnDate = new Date(r.return_date)
      const now = new Date()
      return returnDate.getMonth() === now.getMonth() && returnDate.getFullYear() === now.getFullYear()
    }).length

    const totalItems = returns.reduce((sum, r) => sum + (r.return_voucher_lines?.length || 0), 0)

    return { totalReturns, thisMonthReturns, totalItems }
  }, [returns])

  // Filtering & Sorting Logic
  const filteredReturns = useMemo(() => {
    let result = [...returns]

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter((r) =>
        r.return_voucher_number.toLowerCase().includes(lowerTerm) ||
        (r.customers?.name || "").toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter)
    }

    // 3. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof ReturnVoucher]
      let bValue: any = b[sortConfig.key as keyof ReturnVoucher]

      if (sortConfig.key === "customer_name") {
        aValue = a.customers?.name || ""
        bValue = b.customers?.name || ""
      }

      if (aValue === null || aValue === undefined) aValue = ""
      if (bValue === null || bValue === undefined) bValue = ""

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [returns, searchTerm, statusFilter, sortConfig])

  const requestSort = (key: keyof ReturnVoucher | "customer_name") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof ReturnVoucher | "customer_name") => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const getStatusBadgeStyle = (status: ReturnVoucher["status"]) => {
    switch (status) {
      case "BROUILLON": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
      case "RETOURNE": return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      case "ANNULE": return "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
      default: return ""
    }
  }

  return (
    <div className="space-y-6">
      {!selectedCompanyId && (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <PackageX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">Aucune entreprise sélectionnée</h3>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise dans la barre latérale.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          {/* Header */}
          <PageHeader
            title="Bons de Retour"
            description="Gérez les retours de marchandises clients."
            icon={TrendingDown}
          >
            <Button onClick={() => handleOpenForm(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nouveau Bon de Retour
            </Button>
          </PageHeader>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-indigo-600/70 mb-1">Total Retours</p>
              <div className="text-2xl font-bold text-indigo-700">{stats.totalReturns}</div>
            </div>

            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-orange-600/70 mb-1">Ce Mois</p>
              <div className="text-2xl font-bold text-orange-700">{stats.thisMonthReturns}</div>
            </div>

            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-purple-600/70 mb-1">Articles Retournés</p>
              <div className="text-2xl font-bold text-purple-700">{stats.totalItems}</div>
            </div>
          </div>

          {/* Filters & Table */}
          <FilterToolbar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Rechercher par numéro ou client..."
            resultCount={filteredReturns.length}
            resultLabel={filteredReturns.length > 1 ? "bons de retour" : "bon de retour"}
            onReset={() => { setSearchTerm(""); setStatusFilter("all"); }}
            showReset={!!searchTerm || statusFilter !== "all"}
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="BROUILLON">Brouillon</SelectItem>
                <SelectItem value="RETOURNE">Retourné</SelectItem>
                <SelectItem value="ANNULE">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </FilterToolbar>

          <Card className="border bg-card shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead
                      className="cursor-pointer hover:text-primary transition-colors h-11"
                      onClick={() => requestSort("return_voucher_number")}
                    >
                      <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Numéro {getSortIcon("return_voucher_number")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary transition-colors h-11"
                      onClick={() => requestSort("customer_name")}
                    >
                      <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Client {getSortIcon("customer_name")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary transition-colors h-11"
                      onClick={() => requestSort("return_date")}
                    >
                      <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Date {getSortIcon("return_date")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary transition-colors h-11"
                      onClick={() => requestSort("status")}
                    >
                      <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Statut {getSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead className="h-11 w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Chargement...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredReturns.length > 0 ? (
                    filteredReturns.map((r) => (
                      <TableRow
                        key={r.id}
                        className="group hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium text-foreground">
                          {r.return_voucher_number}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.customers?.name || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.return_date).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("px-2.5 py-0.5 text-xs font-medium border shadow-sm", getStatusBadgeStyle(r.status))}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <ReturnVoucherActions
                            returnVoucher={r}
                            onEdit={() => handleOpenForm(r)}
                            onActionSuccess={() => fetchReturns(selectedCompanyId!)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-[300px] text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <PackageX className="h-12 w-12 text-muted-foreground/20" />
                          {searchTerm || statusFilter !== "all" ? (
                            <>
                              <h3 className="text-lg font-semibold">Aucun bon de retour trouvé</h3>
                              <p className="text-sm text-muted-foreground text-center mb-4">
                                Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres.
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSearchTerm("")
                                  setStatusFilter("all")
                                }}
                              >
                                Réinitialiser les filtres
                              </Button>
                            </>
                          ) : (
                            <>
                              <h3 className="text-lg font-semibold">Aucun Bon de Retour</h3>
                              <p className="text-sm text-muted-foreground text-center mb-4">
                                Vous n'avez pas encore créé de bon de retour pour cette entreprise.
                              </p>
                              <Button onClick={() => handleOpenForm(null)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Créer un bon de retour
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {isFormOpen && (
        <ReturnVoucherForm
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          companyId={selectedCompanyId!}
          initialData={editingReturn}
          onSuccess={() => fetchReturns(selectedCompanyId!)}
        />
      )}
    </div>
  )
}
