"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, ShoppingCart, CheckCircle, Clock, XCircle, FileText, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { PurchaseOrderActions } from "./po-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

type POStatus = "BROUILLON" | "ENVOYE" | "RECU" | "ANNULE"
type PurchaseOrder = {
  id: string
  po_number: string
  suppliers: { name: string } | null
  order_date: string
  total_ttc: number
  status: POStatus
}

type SortConfig = {
  key: keyof PurchaseOrder | "supplier_name"
  direction: "asc" | "desc"
}

export function PurchaseOrderList({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "order_date", direction: "desc" })

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPOs(selectedCompanyId)
    } else {
      setPurchaseOrders([])
    }
  }, [selectedCompanyId])

  const fetchPOs = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`id, po_number, suppliers ( name ), order_date, total_ttc, status`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur chargement BC:", error)
    } else {
      setPurchaseOrders(data as PurchaseOrder[])
    }
    setIsLoading(false)
  }

  const handleStatusChange = (poId: string, newStatus: POStatus) => {
    setPurchaseOrders(currentPOs =>
      currentPOs.map(po => (po.id === poId ? { ...po, status: newStatus } : po)),
    )
  }

  // Statistics
  const stats = useMemo(() => {
    const total = purchaseOrders.length
    const received = purchaseOrders.filter((po) => po.status === "RECU").length
    const pending = purchaseOrders.filter((po) => po.status === "BROUILLON" || po.status === "ENVOYE").length
    const cancelled = purchaseOrders.filter((po) => po.status === "ANNULE").length
    const totalAmount = purchaseOrders.reduce((sum, po) => sum + (po.total_ttc || 0), 0)

    return { total, received, pending, cancelled, totalAmount }
  }, [purchaseOrders])

  // Filtering & Sorting Logic
  const filteredPOs = useMemo(() => {
    let result = [...purchaseOrders]

    // 1. Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter((po) =>
        po.po_number.toLowerCase().includes(lowerTerm) ||
        (po.suppliers?.name || "").toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((po) => po.status === statusFilter)
    }

    // 3. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof PurchaseOrder]
      let bValue: any = b[sortConfig.key as keyof PurchaseOrder]

      if (sortConfig.key === "supplier_name") {
        aValue = a.suppliers?.name || ""
        bValue = b.suppliers?.name || ""
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [purchaseOrders, searchTerm, statusFilter, sortConfig])

  const requestSort = (key: keyof PurchaseOrder | "supplier_name") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof PurchaseOrder | "supplier_name") => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const getStatusBadgeStyle = (status: POStatus) => {
    switch (status) {
      case "BROUILLON": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
      case "ENVOYE": return "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
      case "RECU": return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      case "ANNULE": return "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
      default: return ""
    }
  }

  if (!selectedCompanyId) {
    return (
      <Card className="text-center py-12 border-dashed">
        <CardContent>
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
        title="Bons de Commande"
        description="Gérez vos commandes fournisseurs."
        icon={ShoppingCart}
      >
        <Link href={`/dashboard/purchase-orders/new?companyId=${selectedCompanyId}`} passHref>
          <Button size="lg" className="shadow-sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau Bon de Commande
          </Button>
        </Link>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Commandes"
          value={new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(stats.totalAmount)}
          icon={FileText}
          variant="info"
          subtitle={`${stats.total} commandes`}
        />
        <KpiCard
          title="En Attente"
          value={stats.pending}
          icon={Clock}
          variant="warning"
          subtitle="Brouillon ou envoyé"
        />
        <KpiCard
          title="Reçus"
          value={stats.received}
          icon={CheckCircle}
          variant="success"
          subtitle="Commandes réceptionnées"
        />
        <KpiCard
          title="Annulés"
          value={stats.cancelled}
          icon={XCircle}
          variant="danger"
          subtitle="Commandes annulées"
        />
      </div>

      {/* Filters & Table */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numéro ou fournisseur..."
        resultCount={filteredPOs.length}
        resultLabel={filteredPOs.length > 1 ? "commandes trouvées" : "commande trouvée"}
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
            <SelectItem value="RECU">Reçu</SelectItem>
            <SelectItem value="ANNULE">Annulé</SelectItem>
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
                  onClick={() => requestSort("po_number")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Numéro {getSortIcon("po_number")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("supplier_name")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fournisseur {getSortIcon("supplier_name")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-primary transition-colors h-11"
                  onClick={() => requestSort("order_date")}
                >
                  <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date {getSortIcon("order_date")}
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
                  className="cursor-pointer hover:text-primary transition-colors h-11 text-right"
                  onClick={() => requestSort("total_ttc")}
                >
                  <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground gap-1">
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
              ) : filteredPOs.length > 0 ? (
                filteredPOs.map((po) => (
                  <TableRow key={po.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">{po.po_number}</TableCell>
                    <TableCell className="text-muted-foreground">{po.suppliers?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(po.order_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("px-2.5 py-0.5 text-xs font-medium border shadow-sm", getStatusBadgeStyle(po.status))}
                      >
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {po.total_ttc.toFixed(3)} <span className="text-xs text-muted-foreground font-sans">TND</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <PurchaseOrderActions
                        poId={po.id}
                        currentStatus={po.status}
                        onStatusChange={handleStatusChange}
                        onActionSuccess={() => fetchPOs(selectedCompanyId!)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-[300px] text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground/20" />
                      {searchTerm || statusFilter !== "all" ? (
                        <>
                          <h3 className="text-lg font-semibold">Aucune commande trouvée</h3>
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
                          <h3 className="text-lg font-semibold">Aucune commande</h3>
                          <p className="text-sm text-muted-foreground text-center mb-4">
                            Vous n'avez pas encore passé de commande pour cette entreprise.
                          </p>
                          <Link href={`/dashboard/purchase-orders/new?companyId=${selectedCompanyId}`} passHref>
                            <Button>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Nouveau Bon de Commande
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
