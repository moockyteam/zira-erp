"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, FileText, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle, Clock, XCircle, FileType } from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { QuoteActions } from "./quote-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

type CompanyForList = { id: string; name: string; logo_url: string | null }
type QuoteStatus = "BROUILLON" | "ENVOYE" | "CONFIRME" | "REFUSE"

type Quote = {
  id: string
  quote_number: string
  customer_id: string | null
  prospect_name: string | null
  customers: { name: string } | null
  quote_date: string
  total_ttc: number
  status: QuoteStatus
  currency: string
}

type SortConfig = {
  key: keyof Quote | "customer_name"
  direction: "asc" | "desc"
}

export function QuoteList({ userCompanies }: { userCompanies: CompanyForList[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "quote_date", direction: "desc" })

  useEffect(() => {
    if (selectedCompanyId) {
      fetchQuotes(selectedCompanyId)
    } else {
      setQuotes([])
    }
  }, [selectedCompanyId])

  const fetchQuotes = async (companyId: string) => {
    setIsLoading(true)

    const [quotesRes, customersRes] = await Promise.all([
      supabase
        .from("quotes")
        .select(`id, quote_number, customer_id, prospect_name, quote_date, total_ttc, status, currency`)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
    ])

    if (quotesRes.error) {
      console.error("Erreur chargement devis:", quotesRes.error)
    } else {
      const customerMap = new Map(customersRes.data?.map(c => [c.id, c.name]) || [])
      const quotesWithCustomers = quotesRes.data.map((q: any) => ({
        ...q,
        customers: q.customer_id ? { name: customerMap.get(q.customer_id) || "" } : null
      }))
      setQuotes(quotesWithCustomers)
    }

    setIsLoading(false)
  }

  const handleStatusChange = (quoteId: string, newStatus: QuoteStatus) => {
    setQuotes((currentQuotes) =>
      currentQuotes.map((quote) => (quote.id === quoteId ? { ...quote, status: newStatus } : quote)),
    )
  }

  // Statistics
  const stats = useMemo(() => {
    const totalByCurrency: Record<string, number> = {}

    quotes.forEach((q) => {
      const curr = q.currency || "TND"
      totalByCurrency[curr] = (totalByCurrency[curr] || 0) + q.total_ttc
    })

    const totalCount = quotes.length
    const confirmedCount = quotes.filter((q) => q.status === "CONFIRME").length
    const pendingCount = quotes.filter((q) => q.status === "BROUILLON" || q.status === "ENVOYE").length
    const refusedCount = quotes.filter((q) => q.status === "REFUSE").length

    return {
      totalByCurrency,
      totalCount,
      confirmedCount,
      pendingCount,
      refusedCount,
    }
  }, [quotes])

  // Filtering & Sorting Logic
  const filteredQuotes = useMemo(() => {
    let result = [...quotes]

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter((q) =>
        q.quote_number.toLowerCase().includes(lowerTerm) ||
        (q.customers?.name || "").toLowerCase().includes(lowerTerm) ||
        (q.prospect_name || "").toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((q) => q.status === statusFilter)
    }

    // 3. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Quote]
      let bValue: any = b[sortConfig.key as keyof Quote]

      if (sortConfig.key === "customer_name") {
        aValue = a.customers?.name || a.prospect_name || ""
        bValue = b.customers?.name || b.prospect_name || ""
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [quotes, searchTerm, statusFilter, sortConfig])

  const requestSort = (key: keyof Quote | "customer_name") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof Quote | "customer_name") => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const getStatusBadgeStyle = (status: QuoteStatus) => {
    switch (status) {
      case "BROUILLON": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
      case "ENVOYE": return "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
      case "CONFIRME": return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      case "REFUSE": return "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
      default: return ""
    }
  }

  // Helper to format currency values for KPI
  const formatTotalValue = (totals: Record<string, number>) => {
    const entries = Object.entries(totals)
    if (entries.length === 0) return "0.000 TND"
    // If single currency, standard display
    if (entries.length === 1) {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: entries[0][0] }).format(entries[0][1])
    }
    // If multiple, join with +
    return entries.map(([curr, val]) =>
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: curr, maximumFractionDigits: 0 }).format(val)
    ).join(' + ')
  }

  if (!selectedCompanyId) {
    return (
      <Card className="text-center py-12 border-dashed">
        <CardContent>
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground">Aucune entreprise sélectionnée</h3>
          <p className="text-muted-foreground">Veuillez sélectionner une entreprise dans la barre latérale.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Devis"
        description="Gérez vos devis clients et suivez leur statut."
        icon={FileText}
      >
        <Link href={`/dashboard/quotes/new?companyId=${selectedCompanyId}`}>
          <Button size="lg" className="shadow-sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau Devis
          </Button>
        </Link>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Devis"
          value={formatTotalValue(stats.totalByCurrency)}
          icon={FileType}
          variant="info"
          subtitle={`${stats.totalCount} devis au total`}
        />
        <KpiCard
          title="Confirmés"
          value={stats.confirmedCount}
          icon={CheckCircle}
          variant="success"
          subtitle="Devis acceptés"
        />
        <KpiCard
          title="En Attente"
          value={stats.pendingCount}
          icon={Clock}
          variant="warning"
          subtitle="En cours de validation"
        />
        <KpiCard
          title="Refusés"
          value={stats.refusedCount}
          icon={XCircle}
          variant="danger"
          subtitle="Devis rejetés"
        />
      </div>

      {/* Filters & Table */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numéro ou client..."
        resultCount={filteredQuotes.length}
        resultLabel={filteredQuotes.length > 1 ? "devis trouvés" : "devis trouvé"}
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
            <SelectItem value="ENVOYE">Envoyé</SelectItem>
            <SelectItem value="CONFIRME">Confirmé</SelectItem>
            <SelectItem value="REFUSE">Refusé</SelectItem>
          </SelectContent>
        </Select>
      </FilterToolbar>

      <Card className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("quote_number")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Numéro {getSortIcon("quote_number")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("customer_name")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Client / Prospect {getSortIcon("customer_name")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("quote_date")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date {getSortIcon("quote_date")}
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
                <TableHead
                  className="text-right cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("total_ttc")}
                >
                  <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Montant TTC {getSortIcon("total_ttc")}
                  </div>
                </TableHead>
                <TableHead className="h-11 w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Chargement...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredQuotes.length > 0 ? (
                filteredQuotes.map((quote) => (
                  <TableRow
                    key={quote.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">
                      {quote.quote_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {quote.customers?.name || quote.prospect_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(quote.quote_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("px-2.5 py-0.5 text-xs font-medium border shadow-sm", getStatusBadgeStyle(quote.status))}
                      >
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: quote.currency || "TND"
                      }).format(quote.total_ttc)}
                    </TableCell>
                    <TableCell className="text-right">
                      <QuoteActions
                        quoteId={quote.id}
                        currentStatus={quote.status}
                        onStatusChange={(newStatus) => handleStatusChange(quote.id, newStatus)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-[300px] text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <FileText className="h-12 w-12 text-muted-foreground/20" />
                      {searchTerm || statusFilter !== "all" ? (
                        <>
                          <h3 className="text-lg font-semibold">Aucun devis trouvé</h3>
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
                          <h3 className="text-lg font-semibold">Aucun devis</h3>
                          <p className="text-sm text-muted-foreground text-center mb-4">
                            Vous n'avez pas encore créé de devis pour cette entreprise.
                            Commencez par en créer un nouveau.
                          </p>
                          <Link href={`/dashboard/quotes/new?companyId=${selectedCompanyId}`}>
                            <Button>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Créer un devis
                            </Button>
                          </Link>
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
    </div>
  )
}
