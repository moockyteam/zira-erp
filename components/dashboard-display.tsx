"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from "date-fns"
import {
  TrendingUp,
  Receipt,
  Truck,
  ArrowDownRight,
  Wallet,
  AlertTriangle,
  Calculator,
  FileText,
  CalendarRange
} from "lucide-react"

const dateRanges = [
  { value: "this_month", label: "Ce mois" },
  { value: "this_week", label: "Cette semaine" },
  { value: "this_quarter", label: "Ce trimestre" },
  { value: "this_year", label: "Cette année" },
]

export function DashboardDisplay({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const selectedCompanyId = userCompanies?.[0]?.id

  const [data, setData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState("this_month")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      // ... existing fetch logic
      if (!selectedCompanyId) return
      setIsLoading(true)

      const today = new Date()
      let startDate, endDate
      switch (period) {
        case "this_week":
          startDate = startOfWeek(today, { weekStartsOn: 1 })
          endDate = endOfWeek(today, { weekStartsOn: 1 })
          break
        case "this_quarter":
          startDate = startOfQuarter(today)
          endDate = endOfQuarter(today)
          break
        case "this_year":
          startDate = startOfYear(today)
          endDate = endOfYear(today)
          break
        default:
          startDate = startOfMonth(today)
          endDate = endOfMonth(today)
      }

      const { data, error } = await supabase.rpc("get_modular_dashboard_analytics", {
        p_company_id: selectedCompanyId,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      })

      if (error) {
        console.error("Dashboard Analytics RPC Error:", JSON.stringify(error, null, 2))
        // Attempt to show toast if message exists
        if (error.message) {
          console.error("RPC Error Message:", error.message)
        }
      } else {
        setData(data)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [selectedCompanyId, period, supabase])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
    }).format(value || 0)
  }

  const vatCollected = data?.sales?.vat_collected || 0
  const vatPaid = data?.expenses?.vat_paid || 0
  const netVat = vatCollected - vatPaid

  const evolutionData = data?.evolution || []

  if (!isMounted) {
    return <Skeleton className="h-[800px] w-full" />
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
          <p className="text-muted-foreground">
            Aperçu global pour <span className="font-semibold text-foreground">{userCompanies.find(c => c.id === selectedCompanyId)?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <CalendarRange className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-[400px] w-full" /> : (
        <div className="space-y-6">

          {/* 1. KEY INDICATORS ROW */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* CA Facturé */}
            <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">CA Facturé (HT)</CardTitle>
                <Receipt className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(data?.sales?.turnover_ht)}
                </div>
                <p className="text-xs text-emerald-600/80 mt-1">
                  {data?.sales?.count} factures sur la période
                </p>
              </CardContent>
            </Card>

            {/* CA Livraison (BL) */}
            <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">CA Livraison (HT)</CardTitle>
                <Truck className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(data?.delivery?.turnover_ht)}
                </div>
                <p className="text-xs text-blue-600/80 mt-1">
                  {data?.delivery?.count} BL émis sur la période
                </p>
              </CardContent>
            </Card>

            {/* Dépenses */}
            <Card className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-background border-rose-100 dark:border-rose-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">Dépenses (HT)</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {formatCurrency(data?.expenses?.total_ht)}
                </div>
                <div className="flex justify-between items-center text-xs text-rose-600/80 mt-1">
                  <span>{data?.expenses?.count} dépenses</span>
                  <span className="opacity-75">TTC: {formatCurrency(data?.expenses?.total_ttc)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Paiements Reçus */}
            <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Paiements Reçus</CardTitle>
                <Wallet className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {formatCurrency(data?.sales?.total_paid)}
                </div>
                <p className="text-xs text-amber-600/80 mt-1">
                  Total encaissé sur la période
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 2. MAIN CHARTS SECTION */}
          <div className="grid gap-4 md:grid-cols-7">
            {/* Evolution Activity Chart */}
            <Card className="col-span-1 md:col-span-4 lg:col-span-5">
              <CardHeader>
                <CardTitle>Comparatif Facturation vs Livraison</CardTitle>
                <CardDescription>Analysez l'écart entre ce qui est facturé et ce qui est livré.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={evolutionData}>
                    <defs>
                      <linearGradient id="colorTurnoverInvoice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTurnoverDn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend verticalAlign="top" height={36} />
                    <Area type="monotone" dataKey="turnover_invoice" name="Facturé (HT)" stroke="#10b981" fillOpacity={1} fill="url(#colorTurnoverInvoice)" />
                    <Area type="monotone" dataKey="turnover_dn" name="Livré (HT)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTurnoverDn)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fiscal & Stock Status Column */}
            <div className="col-span-1 md:col-span-3 lg:col-span-2 space-y-4">
              {/* FISCAL CARD */}
              <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-purple-600" />
                    Fiscalité & TVA
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVA Collectée (Ventes)</span>
                      <span className="font-semibold text-emerald-600">+{formatCurrency(vatCollected)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVA Payée (Achats)</span>
                      <span className="font-semibold text-rose-600">-{formatCurrency(vatPaid)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>TVA Net à Payer</span>
                      <span className={netVat > 0 ? "text-purple-600" : "text-emerald-600"}>
                        {formatCurrency(netVat)}
                      </span>
                    </div>
                  </div>

                  {data?.sales?.fodec_collected > 0 && (
                    <div className="pt-2 border-t border-dashed space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">FODEC Collecté</span>
                        <span>{formatCurrency(data?.sales?.fodec_collected)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* DEVIS STATS */}
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Devis en Cours
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Volume</span>
                    <span className="font-bold">{data?.quotes?.count_pending} devis</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Montant Potentiel</span>
                    <span className="font-bold text-blue-600">{formatCurrency(data?.quotes?.total_pending)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Alertes Stock */}
              <Card className="border-l-4 border-l-amber-500 shadow-sm">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Alertes Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Articles en rupture</span>
                    <span className="font-bold text-amber-600 text-lg">{data?.stock?.low_stock_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Valeur Stock</span>
                    <span className="font-bold">{formatCurrency(data?.stock?.stock_value || 0)}</span>
                  </div>
                </CardContent>
              </Card>


            </div>
          </div>
        </div>
      )}
    </div>
  )
}
