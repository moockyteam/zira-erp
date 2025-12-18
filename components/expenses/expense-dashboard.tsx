"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { TrendingUp, DollarSign, Receipt, CalendarIcon } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns"
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
  const [categories, setCategories] = useState<any[]>([])
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

    const expensesPromise = supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .gte("payment_date", format(startDate, "yyyy-MM-dd"))
      .lte("payment_date", format(endDate, "yyyy-MM-dd"))

    const schedulesPromise = supabase
      .from("expense_schedules")
      .select("*, expenses!inner(company_id)")
      .eq("expenses.company_id", companyId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(10)
      .then((res) => res)
      .catch(() => ({ data: [], error: null }))

    const categoriesPromise = supabase
      .from("expense_categories")
      .select("*")
      .or(`company_id.is.null,company_id.eq.${companyId}`)

    const [expensesRes, schedulesRes, categoriesRes] = await Promise.all([
      expensesPromise,
      schedulesPromise,
      categoriesPromise,
    ])

    if (expensesRes.error) toast.error("Erreur chargement dépenses")
    // if (schedulesRes.error) toast.error("Erreur chargement échéances")

    setExpenses(expensesRes.data || [])
    setSchedules(schedulesRes.data || [])
    setCategories(categoriesRes.data || [])
    setIsLoading(false)
  }

  const stats = useMemo(() => {
    const totalByCurrency = expenses.reduce(
      (acc, exp) => {
        const curr = exp.currency || "TND"
        if (!acc[curr]) acc[curr] = { ht: 0, tva: 0, ttc: 0, withholding: 0 }
        acc[curr].ht += Number.parseFloat(exp.total_ht) || 0
        acc[curr].tva += Number.parseFloat(exp.total_tva) || 0
        acc[curr].ttc += Number.parseFloat(exp.total_ttc) || 0
        if (exp.has_withholding_tax) {
          acc[curr].withholding += Number.parseFloat(exp.withholding_tax_amount) || 0
        }
        return acc
      },
      {} as Record<string, any>,
    )

    const byCategory = expenses.reduce(
      (acc, exp) => {
        const catName = exp.expense_categories?.name || "Non catégorisé"
        if (!acc[catName]) acc[catName] = 0
        acc[catName] += Number.parseFloat(exp.total_ttc) || 0
        return acc
      },
      {} as Record<string, number>,
    )

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({
      name,
      value: Number.parseFloat(value.toFixed(2)),
    }))

    const paidCount = expenses.filter((e) => e.status === "PAYE").length
    const pendingCount = expenses.filter((e) => e.status === "EN_ATTENTE").length

    return {
      totalByCurrency,
      categoryData,
      paidCount,
      pendingCount,
      totalExpenses: expenses.length,
    }
  }, [expenses])

  const formatCurrency = (value: number, currency = "TND") => {
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : ""
    const decimals = currency === "TND" ? 3 : 2
    return `${value.toFixed(decimals)} ${symbol || currency}`
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec filtre de période */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Tableau de Bord Dépenses</h2>
          <p className="text-muted-foreground">Analyse complète de vos charges et paiements</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Ce mois</SelectItem>
            <SelectItem value="last_month">Mois dernier</SelectItem>
            <SelectItem value="this_year">Cette année</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs par devise */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats.totalByCurrency).map(([currency, data]: [string, any]) => (
          <Card key={currency}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: COLORS[currency as keyof typeof COLORS] }} />
                Dépenses en {currency}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatCurrency(data.ttc, currency)}</div>
                <div className="text-xs text-muted-foreground">
                  HT: {formatCurrency(data.ht, currency)} | TVA: {formatCurrency(data.tva, currency)}
                </div>
                {data.withholding > 0 && (
                  <div className="text-xs text-orange-600 font-medium">
                    Retenue à la source: {formatCurrency(data.withholding, currency)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-500" />
              Total Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExpenses}</div>
            <div className="text-xs text-muted-foreground">
              {stats.paidCount} payées | {stats.pendingCount} en attente
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-purple-500" />
              Échéances à Venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <div className="text-xs text-muted-foreground">Dans les 30 prochains jours</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Catégories Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categoryData.length}</div>
            <div className="text-xs text-muted-foreground">Répartition par type</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Par Catégorie</TabsTrigger>
          <TabsTrigger value="schedules">Échéances</TabsTrigger>
          <TabsTrigger value="withholding">Retenues</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Répartition par Catégorie</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {stats.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${entry.value.toFixed(2)}`}
                    >
                      {stats.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune donnée à afficher
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prochaines Échéances de Paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{schedule.beneficiary}</div>
                        <div className="text-sm text-muted-foreground">
                          {schedule.category_name || "Non catégorisé"} • {schedule.payment_method || "N/A"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{Number.parseFloat(schedule.amount).toFixed(3)} TND</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(schedule.due_date), "dd MMM yyyy", { locale: fr })}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-4">
                        {schedule.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">Aucune échéance à venir</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withholding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Retenues à la Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.totalByCurrency).map(
                  ([currency, data]: [string, any]) =>
                    data.withholding > 0 && (
                      <div key={currency} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{currency}</span>
                          <span className="text-xl font-bold text-orange-600">
                            {formatCurrency(data.withholding, currency)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Montant retenu pour déclaration fiscale
                        </div>
                      </div>
                    ),
                )}
                {Object.values(stats.totalByCurrency).every((data: any) => data.withholding === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    Aucune retenue à la source pour cette période
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
