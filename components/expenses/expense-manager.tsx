"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { useCompany } from "@/components/providers/company-provider"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import {
  PlusCircle,
  FileUp,
  Calendar,
  RefreshCw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Wallet,
  Clock,
  CheckCircle2,
  Receipt
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringExpenseManager } from "./recurring-expense-manager"
import { ExpenseScheduleManager } from "./expense-schedule-manager"
import { ExpenseExportButton } from "./expense-export-button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

export function ExpenseManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  // States
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<any>()
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({ key: 'payment_date', direction: 'desc' })

  // Modals
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [selectedExpenseForSchedule, setSelectedExpenseForSchedule] = useState<any>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchData(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchData = async (id: string) => {
    setIsLoading(true)
    try {
      const [expRes, catRes] = await Promise.all([
        supabase.from("expenses").select("*, expense_categories(name)").eq("company_id", id).order("payment_date", { ascending: false }),
        supabase.from("expense_categories").select("*").or(`company_id.is.null,company_id.eq.${id}`).order("name")
      ])
      setExpenses(expRes.data || [])
      setCategories(catRes.data || [])
    } catch (e) {
      toast.error("Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter((e) => {
      if (dateRange?.from) {
        const d = new Date(e.payment_date)
        if (d < dateRange.from || (dateRange.to && d > dateRange.to)) return false
      }
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false
      if (categoryFilter !== "ALL" && e.category_id !== categoryFilter) return false
      if (searchTerm) {
        const s = searchTerm.toLowerCase()
        return e.beneficiary?.toLowerCase().includes(s) || e.reference?.toLowerCase().includes(s)
      }
      return true
    })

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = sortConfig.key === 'category_name' ? a.expense_categories?.name : a[sortConfig.key]
        const bVal = sortConfig.key === 'category_name' ? b.expense_categories?.name : b[sortConfig.key]
        return sortConfig.direction === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
      })
    }
    return filtered
  }, [expenses, dateRange, statusFilter, categoryFilter, searchTerm, sortConfig])

  // Stats computation
  const stats = useMemo(() => {
    const total = expenses.reduce((acc, curr) => acc + (curr.total_ttc || 0), 0)
    const pending = expenses.filter(e => e.status !== 'PAYE').reduce((acc, curr) => acc + (curr.total_ttc || 0), 0)
    const count = expenses.length
    return { total, pending, count }
  }, [expenses])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dépenses"
        description="Suivi des flux sortants et gestion fournisseurs."
        icon={Receipt}
      >
        <Button variant="outline" size="default" onClick={() => setShowRecurringDialog(true)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Récurrentes
        </Button>
        <ExpenseExportButton />
        <Link href={`/dashboard/expenses/new?companyId=${selectedCompanyId}`}>
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nouvelle Dépense
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Total Période"
          value={`${stats.total.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`}
          subtitle="Volume total TTC"
          icon={Wallet}
          variant="info"
        />
        <KpiCard
          title="En Attente"
          value={`${stats.pending.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} TND`}
          subtitle={`${expenses.filter(e => e.status !== 'PAYE').length} factures à régler`}
          icon={Clock}
          variant="warning"
        />
        <KpiCard
          title="Factures"
          value={stats.count}
          subtitle="Nombre total de transactions"
          icon={Receipt}
          variant="success"
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        searchPlaceholder="Rechercher un fournisseur, facture, référence..."
        onSearchChange={setSearchTerm}
        resultCount={filteredExpenses.length}
        showReset={statusFilter !== "ALL" || categoryFilter !== "ALL" || searchTerm !== "" || dateRange !== undefined}
        onReset={() => {
          setSearchTerm("");
          setStatusFilter("ALL");
          setCategoryFilter("ALL");
          setDateRange(undefined);
        }}
      >
        <DatePickerWithRange
          date={dateRange}
          setDate={setDateRange}
          className="h-9"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 bg-background">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            <SelectItem value="PAYE">Payé</SelectItem>
            <SelectItem value="EN_ATTENTE">En attente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="Toutes catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterToolbar>

      {/* Table Section */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <SortableHeader label="Date" id="payment_date" config={sortConfig} onSort={setSortConfig} className="pl-6" />
                <SortableHeader label="Bénéficiaire" id="beneficiary" config={sortConfig} onSort={setSortConfig} />
                <TableHead className="text-xs font-semibold uppercase text-slate-500">Catégorie</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-slate-500 text-center">Statut</TableHead>
                <SortableHeader label="Montant TTC" id="total_ttc" config={sortConfig} onSort={setSortConfig} align="text-right" />
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <TableSkeleton key={i} />)
              ) : filteredExpenses.length > 0 ? (
                filteredExpenses.map((p) => (
                  <TableRow key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <TableCell className="pl-6 py-4 border-none">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {new Date(p.payment_date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">{new Date(p.payment_date).getFullYear()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {p.beneficiary?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{p.beneficiary}</span>
                          <span className="text-xs text-slate-400 line-clamp-1">{p.reference || 'Sans référence'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.expense_categories?.name ? (
                        <Badge variant="secondary" className="font-medium text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-none">
                          {p.expense_categories.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-300 italic text-xs">Non classé</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Number(p.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 3 })}
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">TND</span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setSelectedExpenseForSchedule(p)}>
                            <Calendar className="h-4 w-4 mr-2" /> Échéancier
                          </DropdownMenuItem>
                          {p.attachment_url && (
                            <DropdownMenuItem onClick={() => window.open(p.attachment_url, '_blank')}>
                              <FileUp className="h-4 w-4 mr-2" /> Justificatif
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full">
                        <Receipt className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">Aucune dépense trouvée</p>
                      <Button variant="link" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }}>
                        Réinitialiser les filtres
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modals persistants */}
      <RecurringExpenseManager isOpen={showRecurringDialog} onOpenChange={setShowRecurringDialog} companyId={selectedCompanyId || ""} />
      {selectedExpenseForSchedule && (
        <ExpenseScheduleManager
          isOpen={!!selectedExpenseForSchedule}
          onOpenChange={(open) => !open && setSelectedExpenseForSchedule(null)}
          expense={selectedExpenseForSchedule}
          onSuccess={() => fetchData(selectedCompanyId!)}
        />
      )}
    </div>
  )
}

// --- Sous-composants pour plus de clarté ---

function StatusBadge({ status }: { status: string }) {
  if (status === "PAYE") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none shadow-none hover:bg-emerald-50">
        <CheckCircle2 className="h-3 w-3 mr-1" /> PAYÉ
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none shadow-none hover:bg-amber-50">
      <Clock className="h-3 w-3 mr-1" /> ATTENTE
    </Badge>
  )
}

function SortableHeader({ label, id, config, onSort, className, align = "text-left" }: any) {
  const isActive = config?.key === id
  return (
    <TableHead className={`${className} ${align}`}>
      <button
        onClick={() => onSort({ key: id, direction: config?.key === id && config.direction === 'asc' ? 'desc' : 'asc' })}
        className={`inline-flex items-center hover:text-foreground transition-colors ${isActive ? 'text-blue-600 font-bold' : 'text-slate-500'}`}
      >
        {label}
        {isActive ? (
          config.direction === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
        ) : <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
      </button>
    </TableHead>
  )
}

function TableSkeleton() {
  return (
    <TableRow>
      <TableCell className="pl-6"><Skeleton className="h-4 w-12" /></TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-32" /></div></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
    </TableRow>
  )
}