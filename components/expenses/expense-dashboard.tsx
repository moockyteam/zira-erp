"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { TrendingUp, DollarSign, Receipt, CalendarIcon, AlertCircle } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addDays, isAfter, isBefore } from "date-fns"
import { fr } from "date-fns/locale"

const COLORS = {
  TND: "#8884d8",
  USD: "#82ca9d",
  EUR: "#ffc658",
}

const CHART_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c", "#d0ed57", "#ffc0cb"]

interface ExpenseDashboardProps {
  companyId: string
}

export function ExpenseDashboard({ companyId }: ExpenseDashboardProps) {
  const supabase = createClient()
  const [period, setPeriod] = useState("this_month")
  const [expenses, setExpenses] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [recurring, setRecurring] = useState<any[]>([]) // AJOUT : État pour les récurrentes
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (companyId) fetchDashboardData()
  }, [companyId, period])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    const today = new Date()
    let startDate, endDate

    switch (period) {
      case "this_month":
        startDate = startOfMonth(today)
        endDate = endOfMonth(today)
        break
      case "last_month":
        startDate = startOfMonth(subMonths(today, 1))
        endDate = endOfMonth(subMonths(today, 1))
        break
      case "this_year":
        startDate = startOfYear(today)
        endDate = endOfYear(today)
        break
      default:
        startDate = startOfMonth(today)
        endDate = endOfMonth(today)
    }

    // 1. Dépenses réalisées
    const expensesPromise = supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .gte("payment_date", format(startDate, "yyyy-MM-dd"))
      .lte("payment_date", format(endDate, "yyyy-MM-dd"))

    // 2. Échéances (chèques/traites à venir)
    const schedulesPromise = supabase
      .from("expense_schedules")
      .select("*, expenses!inner(company_id, beneficiary)")
      .eq("expenses.company_id", companyId)
      .eq("status", "pending") // Seulement ce qui n'est pas payé
      .order("due_date", { ascending: true })

    // 3. AJOUT : Dépenses récurrentes actives (Engagements)
    const recurringPromise = supabase
      .from("recurring_expenses")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")

    const [expensesRes, schedulesRes, recurringRes] = await Promise.all([
      expensesPromise,
      schedulesPromise,
      recurringPromise,
    ])

    if (expensesRes.error) toast.error("Erreur chargement dépenses")

    setExpenses(expensesRes.data || [])
    setSchedules(schedulesRes.data || [])
    setRecurring(recurringRes.data || [])
    setIsLoading(false)
  }

  const stats = useMemo(() => {
    // 1. Stats existantes (Dépenses passées)
    const totalByCurrency = expenses.reduce(
      (acc, exp) => {
        const curr = exp.currency || "TND"
        if (!acc[curr]) acc[curr] = { ht: 0, tva: 0, ttc: 0, withholding: 0 }
        acc[curr].ht += Number(exp.total_ht) || 0
        acc[curr].tva += Number(exp.total_tva) || 0
        acc[curr].ttc += Number(exp.total_ttc) || 0
        if (exp.has_withholding_tax) {
          acc[curr].withholding += Number(exp.withholding_tax_amount) || 0
        }
        return acc
      },
      {} as Record<string, any>,
    )

    const byCategory = expenses.reduce(
      (acc, exp) => {
        const catName = exp.expense_categories?.name || "Non catégorisé"
        if (!acc[catName]) acc[catName] = 0
        acc[catName] += Number(exp.total_ttc) || 0
        return acc
      },
      {} as Record<string, number>,
    )

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({
      name,
      value: Number((value as number).toFixed(2)),
    }))

    // 2. NOUVEAU : Calcul des Engagements à Venir (30 prochains jours)
    const today = new Date()
    const next30Days = addDays(today, 30)

    // A. Échéances (Schedules) à venir
    const upcomingSchedules = schedules.filter(s => {
      const d = new Date(s.due_date)
      return isAfter(d, today) && isBefore(d, next30Days)
    })
    const schedulesTotal = upcomingSchedules.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)

    // B. Récurrentes (Recurring) à venir
    const upcomingRecurring = recurring.filter(r => {
      const d = new Date(r.next_execution_date)
      return isAfter(d, today) && isBefore(d, next30Days)
    })
    const recurringTotal = upcomingRecurring.reduce((sum, r) => sum + (Number(r.total_ttc || r.amount) || 0), 0)

    const totalCommitment = schedulesTotal + recurringTotal

    return {
      totalByCurrency,
      categoryData,
      paidCount: expenses.filter((e) => e.status === "PAYE").length,
      pendingCount: expenses.filter((e) => e.status === "EN_ATTENTE").length,
      totalExpenses: expenses.length,
      // Nouvelles données
      totalCommitment,
      upcomingSchedules,
      upcomingRecurring
    }
  }, [expenses, schedules, recurring])

  const formatCurrency = (value: number, currency = "TND") => {
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : ""
    const decimals = currency === "TND" ? 3 : 2
    return `${value.toFixed(decimals)} ${symbol || currency}`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Tableau de Bord Dépenses</h2>
          <p className="text-muted-foreground">Analyse complète de vos charges et paiements</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Ce mois</SelectItem>
            <SelectItem value="last_month">Mois dernier</SelectItem>
            <SelectItem value="this_year">Cette année</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* --- NOUVELLE CARTE : ENGAGEMENTS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total des dépenses (Réalisé) */}
        <Card className="md:col-span-1 border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Receipt className="h-4 w-4" />
              Total Dépenses (Période)
            </CardTitle>
          </CardHeader>
          <CardContent>
             {Object.keys(stats.totalByCurrency).length > 0 ? (
                Object.entries(stats.totalByCurrency).map(([curr, val]:any) => (
                    <div key={curr} className="mb-1">
                        <div className="text-2xl font-bold">{formatCurrency(val.ttc, curr)}</div>
                    </div>
                ))
             ) : <div className="text-2xl font-bold">0.000 TND</div>}
             <div className="text-xs text-muted-foreground">Dépenses enregistrées</div>
          </CardContent>
        </Card>

        {/* Engagements Futurs (Prévisionnel) */}
        <Card className="md:col-span-1 border-orange-200 bg-orange-50/20">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
               <AlertCircle className="h-4 w-4" />
               Engagements à venir (30j)
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalCommitment, 'TND')}</div>
             <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <div className="flex justify-between">
                    <span>Échéances:</span>
                    <span>{stats.upcomingSchedules.length} ({formatCurrency(stats.upcomingSchedules.reduce((a,b)=>a+Number(b.amount),0), 'TND')})</span>
                </div>
                <div className="flex justify-between">
                    <span>Récurrentes:</span>
                    <span>{stats.upcomingRecurring.length} ({formatCurrency(stats.upcomingRecurring.reduce((a,b)=>a+Number(b.total_ttc || b.amount),0), 'TND')})</span>
                </div>
             </div>
           </CardContent>
        </Card>

        {/* Stats Générales */}
        <Card className="md:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Nombre de Dépenses</CardTitle></CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalExpenses}</div>
                <div className="text-xs text-muted-foreground">
                    {stats.paidCount} payées • {stats.pendingCount} en attente
                </div>
            </CardContent>
        </Card>

        <Card className="md:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Catégorie</CardTitle></CardHeader>
            <CardContent>
                {stats.categoryData.length > 0 ? (
                    <>
                        <div className="text-lg font-bold truncate">{stats.categoryData.sort((a,b) => b.value - a.value)[0].name}</div>
                        <div className="text-xs text-muted-foreground">Principale source de dépense</div>
                    </>
                ) : <div className="text-muted-foreground">Aucune donnée</div>}
            </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Par Catégorie</TabsTrigger>
          <TabsTrigger value="commitments">Détail des Engagements Futurs</TabsTrigger>
          <TabsTrigger value="schedules">Échéancier Global</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Répartition par Catégorie</CardTitle></CardHeader>
            <CardContent className="h-80">
              {stats.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry) => `${entry.name}`}>
                      {stats.categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée à afficher</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commitments" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Détails des Dépenses à Venir (30 prochains jours)</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.totalCommitment === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Aucun engagement financier prévu pour les 30 prochains jours.</div>
                    ) : (
                        <div className="space-y-4">
                            {stats.upcomingRecurring.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Dépenses Récurrentes (Loyer, Salaires...)</h4>
                                    <div className="space-y-2">
                                        {stats.upcomingRecurring.map(r => (
                                            <div key={r.id} className="flex justify-between items-center p-2 border rounded bg-slate-50">
                                                <div>
                                                    <div className="font-medium">{r.title || r.beneficiary}</div>
                                                    <div className="text-xs text-muted-foreground">Prévu le {format(new Date(r.next_execution_date), 'dd/MM/yyyy')}</div>
                                                </div>
                                                <div className="font-bold">{formatCurrency(Number(r.total_ttc || r.amount))}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {stats.upcomingSchedules.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 mt-4">Échéances de Paiement (Chèques, Traites)</h4>
                                    <div className="space-y-2">
                                        {stats.upcomingSchedules.map(s => (
                                            <div key={s.id} className="flex justify-between items-center p-2 border rounded bg-slate-50">
                                                <div>
                                                    <div className="font-medium">{s.expenses?.beneficiary}</div>
                                                    <div className="text-xs text-muted-foreground">Échéance le {format(new Date(s.due_date), 'dd/MM/yyyy')} ({s.payment_method})</div>
                                                </div>
                                                <div className="font-bold">{formatCurrency(Number(s.amount))}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
           {/* Liste globale existante des échéances */}
           <Card>
            <CardHeader><CardTitle>Tous les paiements en attente</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{schedule.expenses?.beneficiary || schedule.beneficiary}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(schedule.due_date), "dd MMM yyyy", { locale: fr })} • {schedule.payment_method || "N/A"}
                        </div>
                      </div>
                      <div className="font-bold">{Number.parseFloat(schedule.amount).toFixed(3)} TND</div>
                    </div>
                  ))
                ) : <div className="text-center text-muted-foreground py-8">Aucune échéance à venir</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}