// components/invoices/invoice-list.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Receipt, Clock, CheckCircle2, AlertCircle, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { InvoiceActions } from "./invoice-actions"
import { InvoiceExportButton } from "./invoice-export-button"
import { useCompany } from "@/components/providers/company-provider"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

type CompanyForList = { id: string; name: string; logo_url: string | null }
type InvoiceStatus = "BROUILLON" | "ENVOYE" | "PAYEE" | "PARTIELLEMENT_PAYEE" | "ANNULEE"

type Invoice = {
  id: string
  invoice_number: string
  customers: { name: string } | null
  invoice_date: string
  due_date: string
  total_ttc: number
  status: InvoiceStatus
  total_paid: number
  amount_due: number
  currency: string
  customer_id: string
  company_id: string
}

export function InvoiceList({ userCompanies }: { userCompanies: CompanyForList[] }) { // Keep prop
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { selectedCompany } = useCompany() // Use context

  // const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null) // Remove local state
  const selectedCompanyId = selectedCompany?.id

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    byCurrency: {} as Record<string, { total: number; paid: number; pending: number }>,
  })

  useEffect(() => {
    const customerIdFromUrl = searchParams.get("customerId")
    if (customerIdFromUrl) {
      // Ici, vous pourriez pré-filtrer la liste si vous le souhaitez,
      // ou simplement afficher la page normalement.
      // Pour l'instant, on ne fait rien de plus, mais le lien fonctionnera.
    }
  }, [searchParams])
  // Remove prop sync effect
  /*
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])
  */

  // Filters & Sort State
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sortConfig, setSortConfig] = useState<{ key: keyof Invoice | "customer_name"; direction: "asc" | "desc" } | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchInvoices(selectedCompanyId)
    } else {
      setInvoices([])
    }
  }, [selectedCompanyId])

  const fetchInvoices = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("invoices_with_totals")
      .select(
        `id, invoice_number, customers ( name ), invoice_date, due_date, total_ttc, status, total_paid, amount_due, currency, customer_id, company_id`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur lors du chargement des factures:", error)
    } else {
      // Fix: Supabase returns arrays for joined tables, we need to handle that
      const typedData = (data || []).map((inv: any) => ({
        ...inv,
        customers: Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
      })) as Invoice[]

      setInvoices(typedData)

      const totalsByCurrency: Record<string, { total: number; paid: number; pending: number }> = {}

      typedData.forEach((inv) => {
        const curr = inv.currency || "TND"
        if (!totalsByCurrency[curr]) {
          totalsByCurrency[curr] = { total: 0, paid: 0, pending: 0 }
        }
        totalsByCurrency[curr].total += inv.total_ttc
        if (inv.status === "PAYEE") {
          totalsByCurrency[curr].paid += inv.total_ttc
        }
        if (inv.status === "ENVOYE" || inv.status === "PARTIELLEMENT_PAYEE") {
          totalsByCurrency[curr].pending += inv.amount_due
        }
      })

      const overdueCount = typedData.filter(
        (inv) =>
          (inv.status === "ENVOYE" || inv.status === "PARTIELLEMENT_PAYEE") && new Date(inv.due_date) < new Date(),
      ).length

      setStats({ total: 0, paid: 0, pending: 0, overdue: overdueCount, byCurrency: totalsByCurrency })
    }

    setIsLoading(false)
  }

  // Filter & Sort Logic
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter

    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    if (!sortConfig) return 0

    const { key, direction } = sortConfig
    let aValue: any = a[key as keyof Invoice]
    let bValue: any = b[key as keyof Invoice]

    // Handle special cases
    if (key === "customer_name") {
      aValue = a.customers?.name || ""
      bValue = b.customers?.name || ""
    }

    if (key === "total_ttc") {
      aValue = Number(aValue)
      bValue = Number(bValue)
    }

    if (aValue < bValue) return direction === "asc" ? -1 : 1
    if (aValue > bValue) return direction === "asc" ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Invoice | "customer_name") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />
    return sortConfig.direction === "asc" ? <ChevronUp className="ml-2 h-3 w-3 text-primary" /> : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const getStatusVariant = (status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case "BROUILLON":
        return "secondary"
      case "ENVOYE":
        return "default"
      case "PARTIELLEMENT_PAYEE":
        return "outline"
      case "PAYEE":
        return "success"
      case "ANNULEE":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        description="Gérez vos facturations et suivez les paiements."
        icon={Receipt}
      >
        {selectedCompanyId && (
          <>
            <InvoiceExportButton
              companyId={selectedCompanyId}
              search={searchTerm}
              status={statusFilter}
            />
            <Link href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`} passHref>
              <Button size="default">
                <PlusCircle className="h-4 w-4 mr-2" />
                Créer une facture
              </Button>
            </Link>
          </>
        )}
      </PageHeader>

      {selectedCompanyId && invoices.length > 0 && (
        <>
          <FilterToolbar
            searchValue={searchTerm}
            searchPlaceholder="Rechercher par n° de facture ou client..."
            onSearchChange={setSearchTerm}
            resultCount={filteredInvoices.length}
            showReset={searchTerm !== "" || statusFilter !== "ALL"}
            onReset={() => { setSearchTerm(""); setStatusFilter("ALL"); }}
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="BROUILLON">Brouillon</SelectItem>
                <SelectItem value="ENVOYE">Envoyé</SelectItem>
                <SelectItem value="PAYEE">Payée</SelectItem>
                <SelectItem value="PARTIELLEMENT_PAYEE">Partiellement Payée</SelectItem>
                <SelectItem value="ANNULEE">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </FilterToolbar>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Facturé"
              value={Object.entries(stats.byCurrency).length > 0
                ? Object.entries(stats.byCurrency).map(([curr, amounts]) =>
                  `${amounts.total.toFixed(curr === "TND" ? 3 : 2)} ${curr}`
                ).join(" / ")
                : "-"
              }
              icon={Receipt}
            />
            <KpiCard
              title="Payé"
              value={Object.entries(stats.byCurrency).length > 0
                ? Object.entries(stats.byCurrency).map(([curr, amounts]) =>
                  `${amounts.paid.toFixed(curr === "TND" ? 3 : 2)} ${curr}`
                ).join(" / ")
                : "-"
              }
              icon={CheckCircle2}
              variant="success"
            />
            <KpiCard
              title="En Attente"
              value={Object.entries(stats.byCurrency).length > 0
                ? Object.entries(stats.byCurrency).map(([curr, amounts]) =>
                  `${amounts.pending.toFixed(curr === "TND" ? 3 : 2)} ${curr}`
                ).join(" / ")
                : "-"
              }
              icon={Clock}
              variant="warning"
            />
            <KpiCard
              title="En Retard"
              value={`${stats.overdue} factures`}
              icon={AlertCircle}
              variant="danger"
            />
          </div>
        </>
      )}

      {!selectedCompanyId && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise dans la barre latérale.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (

        <Card className="shadow-none border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b bg-muted/40">
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground pl-6 cursor-pointer hover:text-foreground" onClick={() => requestSort("invoice_number")}>
                    <div className="flex items-center">Numéro {getSortIcon("invoice_number")}</div>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => requestSort("customer_name")}>
                    <div className="flex items-center">Client {getSortIcon("customer_name")}</div>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => requestSort("invoice_date")}>
                    <div className="flex items-center">Date {getSortIcon("invoice_date")}</div>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => requestSort("due_date")}>
                    <div className="flex items-center">Échéance {getSortIcon("due_date")}</div>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => requestSort("status")}>
                    <div className="flex items-center">Statut {getSortIcon("status")}</div>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-end text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => requestSort("total_ttc")}>
                    <div className="flex items-center justify-end">Montant {getSortIcon("total_ttc")}</div>
                  </TableHead>
                  <TableHead className="h-10 w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex justify-center items-center text-muted-foreground text-sm">Chargement...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium pl-6 text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">{invoice.customers?.name || "Client inconnu"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(invoice.invoice_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(invoice.due_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "font-normal text-[11px] px-2 py-0.5 border-0",
                          invoice.status === "PAYEE" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                          invoice.status === "ENVOYE" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          (invoice.status === "BROUILLON" || invoice.status === "ANNULEE") && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
                          invoice.status === "PARTIELLEMENT_PAYEE" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {invoice.total_ttc.toFixed((invoice.currency || "TND") === "TND" ? 3 : 2)} <span className="text-[10px] text-muted-foreground">{invoice.currency || "TND"}</span>
                      </TableCell>
                      <TableCell>
                        <InvoiceActions invoice={invoice} onActionSuccess={() => fetchInvoices(selectedCompanyId!)} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p className="text-sm">Aucune facture trouvée</p>
                        <Button variant="link" className="text-xs h-auto p-0" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }}>Réinitialiser les filtres</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
