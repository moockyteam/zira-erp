"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Package, Truck, XCircle, ArrowUpDown, ChevronUp, ChevronDown, FileText, CreditCard, Box, Archive } from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { DnActions } from "./delivery-note-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DeliveryNotePaymentDialog } from "@/components/delivery-notes/delivery-note-payment-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

type Dn = {
  id: string
  delivery_note_number: string
  customer_id: string
  customers: { name: string } | null
  delivery_date: string
  status: "BROUILLON" | "LIVRE" | "ANNULE"
  total_ttc?: number
  invoice_id?: string
}

type SortConfig = {
  key: keyof Dn | "customer_name"
  direction: "asc" | "desc"
}

export function DeliveryNoteList({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [deliveryNotes, setDeliveryNotes] = useState<Dn[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "delivery_date", direction: "desc" })

  useEffect(() => {
    if (selectedCompanyId) {
      fetchDns(selectedCompanyId)
    } else {
      setDeliveryNotes([])
    }
  }, [selectedCompanyId])

  // Force refresh when the page becomes visible (after navigating back)
  // Force refresh when the page becomes visible (after navigating back)
  // REMOVED at user request for stability
  /*
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedCompanyId) {
        fetchDns(selectedCompanyId)
      }
    }

    const handleFocus = () => {
      if (selectedCompanyId) {
        fetchDns(selectedCompanyId)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [selectedCompanyId])
  */

  const fetchDns = async (companyId: string) => {
    setIsLoading(true)

    // 1. Fetch BLs
    const { data, error } = await supabase
      .from("delivery_notes")
      .select(`
        id, 
        delivery_note_number, 
        customer_id, 
        customers(name), 
        delivery_date, 
        status, 
        total_ttc,
        invoice_id
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur chargement BL:", error)
      setIsLoading(false)
      return
    }

    // 2. Fetch Payments for these BLs explicitly
    const blIds = data?.map(d => d.id) || []
    let paymentsMap: Record<string, number> = {}

    if (blIds.length > 0) {
      const { data: payments } = await supabase
        .from("delivery_note_payments")
        .select("delivery_note_id, amount")
        .in("delivery_note_id", blIds)

      if (payments) {
        payments.forEach((p: any) => {
          if (!paymentsMap[p.delivery_note_id]) paymentsMap[p.delivery_note_id] = 0
          paymentsMap[p.delivery_note_id] += (p.amount || 0)
        })
      }
    }

    // 3. Merge & Calculate Status
    const formattedData = (data as any[]).map(item => {
      const totalPaid = paymentsMap[item.id] || 0
      const totalTTC = item.total_ttc || 0

      let paymentStatus = "NON_PAYE"
      if (totalPaid >= (totalTTC - 0.005) && totalTTC > 0) paymentStatus = "PAYE"
      else if (totalPaid > 0) paymentStatus = "PARTIELLEMENT_PAYE"

      // Only relevant for LIVRE and not cancelled
      if (item.status !== "LIVRE") paymentStatus = "NA"

      return {
        ...item,
        customers: Array.isArray(item.customers) && item.customers.length > 0
          ? item.customers[0]
          : item.customers,
        totalPaid,
        paymentStatus
      }
    })

    setDeliveryNotes(formattedData as Dn[])
    setIsLoading(false)
  }

  // Statistics
  const stats = useMemo(() => {
    const total = deliveryNotes.length
    const draft = deliveryNotes.filter((dn) => dn.status === "BROUILLON").length
    const delivered = deliveryNotes.filter((dn) => dn.status === "LIVRE").length
    const cancelled = deliveryNotes.filter((dn) => dn.status === "ANNULE").length

    return { total, draft, delivered, cancelled }
  }, [deliveryNotes])

  // Payment Status Filter
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")

  // ... (existing useEffects)

  // Filtering & Sorting Logic
  const filteredDeliveryNotes = useMemo(() => {
    let result = [...deliveryNotes]

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter((dn) =>
        dn.delivery_note_number.toLowerCase().includes(lowerTerm) ||
        (dn.customers?.name || "").toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((dn) => dn.status === statusFilter)
    }

    // 3. Payment Status Filter
    if (paymentStatusFilter !== "all") {
      result = result.filter((dn: any) => {
        // Handle mapped payment status
        const payStatus = dn.paymentStatus || "NON_PAYE"
        // Special case: if invoiced, we might want to exclude it or include it based on logic?
        // For now, simple string match
        return payStatus === paymentStatusFilter
      })
    }

    // 4. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Dn]
      let bValue: any = b[sortConfig.key as keyof Dn]

      if (sortConfig.key === "customer_name") {
        aValue = a.customers?.name || ""
        bValue = b.customers?.name || ""
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [deliveryNotes, searchTerm, statusFilter, paymentStatusFilter, sortConfig])

  const requestSort = (key: keyof Dn | "customer_name") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof Dn | "customer_name") => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const getStatusBadgeStyle = (status: Dn["status"]) => {
    switch (status) {
      case "BROUILLON": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
      case "LIVRE": return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      case "ANNULE": return "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
      default: return ""
    }
  }

  if (!selectedCompanyId) {
    return (
      <Card className="text-center py-12 border-dashed">
        <CardContent>
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
        title="Bons de Livraison"
        description="Créez et suivez vos livraisons clients."
        icon={Package}
      >
        <Link href={`/dashboard/delivery-notes/new?companyId=${selectedCompanyId}`} passHref>
          <Button size="lg" className="shadow-sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau BL
          </Button>
        </Link>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total"
          value={stats.total}
          icon={Box}
          variant="info"
          subtitle="Tous les BLs"
        />
        <KpiCard
          title="Brouillons"
          value={stats.draft}
          icon={Archive}
          variant="warning"
          subtitle="En préparation"
        />
        <KpiCard
          title="Livrés"
          value={stats.delivered}
          icon={Truck}
          variant="success"
          subtitle="Livrés au client"
        />
        <KpiCard
          title="Annulés"
          value={stats.cancelled}
          icon={XCircle}
          variant="danger"
          subtitle="BLs annulés"
        />
      </div >

      {/* Filters & Table */}
      < FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numéro ou client..."
        resultCount={filteredDeliveryNotes.length}
        resultLabel={filteredDeliveryNotes.length > 1 ? "bons de livraison trouvés" : "bon de livraison trouvé"}
        onReset={() => { setSearchTerm(""); setStatusFilter("all"); setPaymentStatusFilter("all"); }
        }
        showReset={!!searchTerm || statusFilter !== "all" || paymentStatusFilter !== "all"
        }
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Statut BL" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous (Statut BL)</SelectItem>
            <SelectItem value="BROUILLON">Brouillon</SelectItem>
            <SelectItem value="LIVRE">Livré</SelectItem>
            <SelectItem value="ANNULE">Annulé</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Paiement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous (Paiement)</SelectItem>
            <SelectItem value="PAYE">Payé</SelectItem>
            <SelectItem value="PARTIELLEMENT_PAYE">Partiellement</SelectItem>
            <SelectItem value="NON_PAYE">Non Payé</SelectItem>
            <SelectItem value="NA">N/A (Non Livré)</SelectItem>
          </SelectContent>
        </Select>
      </FilterToolbar >

      <Card className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("delivery_note_number")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Numéro {getSortIcon("delivery_note_number")}
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
                  onClick={() => requestSort("delivery_date")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date Livraison {getSortIcon("delivery_date")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("status")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Statut BL {getSortIcon("status")}
                  </div>
                </TableHead>
                <TableHead className="h-11">
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Paiement
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11 text-right"
                  onClick={() => requestSort("total_ttc" as any)}
                >
                  <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground gap-1">
                    Montant {getSortIcon("total_ttc" as any)}
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
              ) : filteredDeliveryNotes.length > 0 ? (
                filteredDeliveryNotes.map((dn) => (
                  <TableRow
                    key={dn.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">
                      {dn.delivery_note_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dn.customers?.name || "N/A"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(dn.delivery_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("px-2.5 py-0.5 text-xs font-medium border shadow-sm", getStatusBadgeStyle(dn.status))}
                      >
                        {dn.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dn.status === "LIVRE" && !dn.invoice_id && (
                        <Badge variant="outline" className={cn(
                          "font-normal text-[10px] px-2 py-0.5 border-0",
                          (dn as any).paymentStatus === "PAYE" && "bg-emerald-100 text-emerald-700",
                          (dn as any).paymentStatus === "PARTIELLEMENT_PAYE" && "bg-amber-100 text-amber-700",
                          (dn as any).paymentStatus === "NON_PAYE" && "bg-rose-100 text-rose-700"
                        )}>
                          {(dn as any).paymentStatus === "PAYE" ? "PAYÉ" :
                            (dn as any).paymentStatus === "PARTIELLEMENT_PAYE" ? "PARTIEL" : "NON PAYÉ"}
                        </Badge>
                      )}
                      {dn.invoice_id && (
                        <Badge variant="secondary" className="text-[10px] opacity-70">FACTURÉ</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {dn.total_ttc ? dn.total_ttc.toFixed(3) : "0.000"} <span className="text-xs text-muted-foreground font-sans">TND</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {dn.status === "LIVRE" && (
                          <>
                            <Link href={`/dashboard/invoices/new?fromDeliveryNote=${dn.id}`}>
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                <FileText className="h-3.5 w-3.5" />
                                Facturer
                              </Button>
                            </Link>
                            {/* Payment button removed to enforce Global Collections workflow */}
                          </>
                        )}
                        <DnActions dn={dn} onActionSuccess={() => fetchDns(selectedCompanyId!)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-[300px] text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Package className="h-12 w-12 text-muted-foreground/20" />
                      {searchTerm || statusFilter !== "all" ? (
                        <>
                          <h3 className="text-lg font-semibold">Aucun BL trouvé</h3>
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
                          <h3 className="text-lg font-semibold">Aucun Bon de Livraison</h3>
                          <p className="text-sm text-muted-foreground text-center mb-4">
                            Vous n'avez pas encore créé de bon de livraison pour cette entreprise.
                          </p>
                          <Link href={`/dashboard/delivery-notes/new?companyId=${selectedCompanyId}`}>
                            <Button>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Créer un BL
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
    </div >
  )
}
