"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Package, Truck, XCircle, ArrowUpDown, ChevronUp, ChevronDown, FileText, CreditCard } from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { DnActions } from "./delivery-note-actions"
import { SearchInput } from "@/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DeliveryNotePaymentDialog } from "@/components/delivery-notes/delivery-note-payment-dialog"

type Dn = {
  id: string
  delivery_note_number: string
  customer_id: string
  customers: { name: string } | null
  delivery_date: string
  status: "BROUILLON" | "LIVRE" | "ANNULE"
  total_ttc?: number
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

  const fetchDns = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("delivery_notes")
      .select(`id, delivery_note_number, customer_id, customers(name), delivery_date, status, total_ttc`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur chargement BL:", error)
    } else {
      // Map the data to handle Supabase returning arrays for joined relations
      const formattedData = (data as any[]).map(item => ({
        ...item,
        customers: Array.isArray(item.customers) && item.customers.length > 0
          ? item.customers[0]
          : item.customers
      }))
      setDeliveryNotes(formattedData as Dn[])
    }
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

    // 3. Sorting
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
  }, [deliveryNotes, searchTerm, statusFilter, sortConfig])

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

  const getStatusVariant = (status: Dn["status"]): "default" | "destructive" | "success" | "secondary" | "outline" => {
    // We'll use custom classes primarily, but keeping this for fallback
    return "outline"
  }

  const getStatusBadgeStyle = (status: Dn["status"]) => {
    switch (status) {
      case "BROUILLON": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
      case "LIVRE": return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      case "ANNULE": return "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
      default: return ""
    }
  }

  return (
    <div className="space-y-8">
      {!selectedCompanyId && (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">Aucune entreprise sélectionnée</h3>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise dans la barre latérale.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Bons de Livraison</h1>
              <p className="text-muted-foreground mt-1">Créez et suivez vos livraisons clients.</p>
            </div>
            <Link href={`/dashboard/delivery-notes/new?companyId=${selectedCompanyId}`} passHref>
              <Button size="lg" className="shadow-sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nouveau BL
              </Button>
            </Link>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-600/70 mb-1">Total</p>
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600/70 mb-1">Brouillons</p>
              <div className="text-2xl font-bold text-amber-700">{stats.draft}</div>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600/70 mb-1">Livrés</p>
              <div className="text-2xl font-bold text-emerald-700">{stats.delivered}</div>
            </div>

            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100/50">
              <p className="text-xs font-medium uppercase tracking-wider text-red-600/70 mb-1">Annulés</p>
              <div className="text-2xl font-bold text-red-700">{stats.cancelled}</div>
            </div>
          </div>

          {/* Filters & Table */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center sm:h-10">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <SearchInput
                  placeholder="Rechercher par numéro ou client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClear={() => setSearchTerm("")}
                  className="w-full sm:w-[300px]"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="LIVRE">Livré</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
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
                        Statut {getSortIcon("status")}
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
                      <TableCell colSpan={5} className="h-24 text-center">
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
                        <TableCell className="text-right font-mono font-medium">
                          {dn.total_ttc ? dn.total_ttc.toFixed(3) : "0.000"} <span className="text-xs text-muted-foreground font-sans">TND</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {dn.status === "LIVRE" && (

                              <DeliveryNotePaymentDialog
                                deliveryNoteId={dn.id}
                                deliveryNoteReference={dn.delivery_note_number}
                                amountDue={dn.total_ttc || 0}
                                customerId={dn.customer_id}
                                onPaymentSuccess={() => fetchDns(selectedCompanyId!)}
                              >
                                <Button size="sm" variant="outline" className="h-8 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Payer
                                </Button>
                              </DeliveryNotePaymentDialog>
                            )}
                            <DnActions dn={dn} onActionSuccess={() => fetchDns(selectedCompanyId!)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-[300px] text-center">
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}
