"use client"

import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DashboardCompanySelector } from "@/components/dashboard/dashboard-company-selector"
import { redirect } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import {
  AlertCircle,
  FileText,
  Receipt,
  Package,
  Banknote,
  Hourglass,
  PlusCircle,
  TrendingUp,
  BarChart3,
  Users,
  ShoppingBag,
  Info,
  XCircle,
  FileCheck,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  RotateCcw,
  Calendar,
} from "lucide-react"
import { PeriodSelector } from "@/components/dashboard/period-selector"
import { getPeriodDates } from "@/lib/utils"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoicesStatusChart } from "@/components/dashboard/invoices-status-chart"

const formatCurrency = (amount: number | null) => {
  return new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND" }).format(amount || 0)
}

const periods = [
  { value: "this_month", label: "Ce mois-ci" },
  { value: "last_month", label: "Mois dernier" },
  { value: "this_year", label: "Cette année" },
  { value: "last_year", label: "Année dernière" },
]

const ITEMS_PER_PAGE = 5

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  let companies: any[] | null = null
  let companiesError: any = null
  try {
    const { data, error } = await supabase.from("companies").select("id, name, logo_url").eq("user_id", user.id)
    if (error) throw error
    companies = data
  } catch (error) {
    console.error("Erreur lors de la récupération des entreprises :", error)
    companiesError = error
  }

  const resolvedSearchParams = await searchParams
  const selectedCompanyId = (resolvedSearchParams.companyId as string) || companies?.[0]?.id
  const selectedPeriod = (resolvedSearchParams.period as string) || "this_month"
  const currentPage = Number(resolvedSearchParams.page || "1")

  const { startDate, endDate } = getPeriodDates(selectedPeriod)
  const { startDate: yearStartDate, endDate: yearEndDate } = getPeriodDates("this_year")
  const { startDate: lastPeriodStart, endDate: lastPeriodEnd } = getPeriodDates(
    selectedPeriod === "this_month" ? "last_month" : selectedPeriod === "this_year" ? "last_year" : "last_month",
  )

  let dashboardData: any = null
  let dashboardError: any = null

  if (selectedCompanyId) {
    const from = (currentPage - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    try {
      const [
        kpiRevenueData,
        lastPeriodRevenueData,
        allInvoicesData,
        allUnpaidInvoicesData,
        topProductsData,
        topCustomersData,
        lowStockItems,
        lowStockCount,
        recentPayments,
        annualRevenueChartData,
        quotesData,
        deliveryNotesData,
        returnsData,
        invoicesStatusData,
        stockMovements,
      ] = await Promise.all([
        supabase
          .from("payments")
          .select("amount")
          .eq("invoices.company_id", selectedCompanyId)
          .gte("payment_date", startDate)
          .lte("payment_date", endDate),
        supabase
          .from("payments")
          .select("amount")
          .eq("invoices.company_id", selectedCompanyId)
          .gte("payment_date", lastPeriodStart)
          .lte("payment_date", lastPeriodEnd),
        supabase
          .from("invoices_with_totals")
          .select("total, status")
          .eq("company_id", selectedCompanyId)
          .gte("invoice_date", startDate)
          .lte("invoice_date", endDate),
        supabase
          .from("invoices_with_totals")
          .select("amount_due, status, due_date")
          .eq("company_id", selectedCompanyId)
          .in("status", ["ENVOYE", "PARTIELLEMENT_PAYEE"]),
        supabase.rpc("get_top_products_by_revenue", {
          p_company_id: selectedCompanyId,
          p_start_date: startDate,
          p_end_date: endDate,
        }),
        supabase.rpc("get_top_customers_by_revenue", {
          p_company_id: selectedCompanyId,
          p_start_date: startDate,
          p_end_date: endDate,
        }),
        supabase
          .from("items")
          .select("id, name, quantity_on_hand")
          .eq("company_id", selectedCompanyId)
          .lt("quantity_on_hand", 5)
          .order("quantity_on_hand")
          .range(from, to),
        supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("company_id", selectedCompanyId)
          .lt("quantity_on_hand", 5),
        supabase
          .from("payments")
          .select("id, amount, payment_date, invoices(invoice_number, customers(name))")
          .eq("invoices.company_id", selectedCompanyId)
          .order("payment_date", { ascending: false })
          .limit(5),
        supabase.rpc("get_monthly_revenue", {
          p_company_id: selectedCompanyId,
          p_start_date: yearStartDate,
          p_end_date: yearEndDate,
        }),
        supabase
          .from("quotes")
          .select("status")
          .eq("company_id", selectedCompanyId)
          .gte("quote_date", startDate)
          .lte("quote_date", endDate),
        supabase
          .from("delivery_notes")
          .select("status")
          .eq("company_id", selectedCompanyId)
          .gte("delivery_date", startDate)
          .lte("delivery_date", endDate),
        supabase
          .from("return_vouchers")
          .select("*")
          .eq("company_id", selectedCompanyId)
          .gte("return_date", startDate)
          .lte("return_date", endDate),
        supabase
          .from("invoices")
          .select("status")
          .eq("company_id", selectedCompanyId)
          .gte("invoice_date", startDate)
          .lte("invoice_date", endDate),
        supabase.from("items").select("quantity_on_hand").eq("company_id", selectedCompanyId),
      ])

      const revenue = (kpiRevenueData.data || []).reduce((sum, p) => sum + p.amount, 0)
      const lastPeriodRevenue = (lastPeriodRevenueData.data || []).reduce((sum, p) => sum + p.amount, 0)
      const revenueChange = lastPeriodRevenue > 0 ? ((revenue - lastPeriodRevenue) / lastPeriodRevenue) * 100 : 0

      const totalInvoiced = (allInvoicesData.data || []).reduce((sum, inv) => sum + inv.total, 0)

      const quotesStats = {
        total: quotesData.data?.length || 0,
        pending: quotesData.data?.filter((q: any) => q.status === "EN_ATTENTE").length || 0,
        confirmed: quotesData.data?.filter((q: any) => q.status === "CONFIRME").length || 0,
        rejected: quotesData.data?.filter((q: any) => q.status === "REFUSE").length || 0,
      }

      const deliveryStats = {
        total: deliveryNotesData.data?.length || 0,
        draft: deliveryNotesData.data?.filter((d: any) => d.status === "BROUILLON").length || 0,
        delivered: deliveryNotesData.data?.filter((d: any) => d.status === "LIVRE").length || 0,
        cancelled: deliveryNotesData.data?.filter((d: any) => d.status === "ANNULE").length || 0,
      }

      const returnsStats = {
        total: returnsData.data?.length || 0,
        items: returnsData.data?.reduce((sum: number, r: any) => sum + (r.items?.length || 0), 0) || 0,
      }

      const invoicesStatus = {
        draft: invoicesStatusData.data?.filter((i: any) => i.status === "BROUILLON").length || 0,
        sent: invoicesStatusData.data?.filter((i: any) => i.status === "ENVOYE").length || 0,
        paid: invoicesStatusData.data?.filter((i: any) => i.status === "PAYEE").length || 0,
        partial: invoicesStatusData.data?.filter((i: any) => i.status === "PARTIELLEMENT_PAYEE").length || 0,
        cancelled: invoicesStatusData.data?.filter((i: any) => i.status === "ANNULEE").length || 0,
      }

      const totalStock = (stockMovements.data || []).reduce((sum, item) => sum + item.quantity_on_hand, 0)

      dashboardData = {
        revenue,
        revenueChange,
        totalInvoiced,
        revenueChartData: annualRevenueChartData.data || [],
        outstanding: (allUnpaidInvoicesData.data || []).reduce((sum, inv) => sum + inv.amount_due, 0),
        overdue: (allUnpaidInvoicesData.data || []).filter((inv) => new Date(inv.due_date) < new Date()).length,
        topProducts: topProductsData.data || [],
        topCustomers: topCustomersData.data || [],
        lowStockItems: lowStockItems.data || [],
        totalLowStockItems: lowStockCount.count || 0,
        recentPayments: recentPayments.data || [],
        quotesStats,
        deliveryStats,
        returnsStats,
        invoicesStatus,
        totalStock,
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données du tableau de bord :", error)
      dashboardError = error
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Tableau de Bord</h1>
          <p className="text-indigo-100 text-lg">Vue d'ensemble complète de votre activité commerciale</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 max-w-md">
          {companiesError ? (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="flex items-center gap-2 p-4 text-red-700">
                <XCircle className="h-5 w-5" />
                <p>Erreur lors du chargement des entreprises.</p>
              </CardContent>
            </Card>
          ) : (
            <DashboardCompanySelector companies={companies || []} selectedCompanyId={selectedCompanyId} />
          )}
        </div>
        {selectedCompanyId && <PeriodSelector selectedCompanyId={selectedCompanyId} />}
      </div>

      {!companies?.length && !companiesError ? (
        <Card className="mt-8 text-center py-12 border-dashed">
          <CardContent className="space-y-4">
            <Info className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Aucune entreprise trouvée.</p>
            <p className="text-muted-foreground">Créez votre première entreprise pour commencer.</p>
            <Link href="/dashboard/companies/new">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" /> Créer une entreprise
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !selectedCompanyId ? (
        <Card className="mt-8 text-center py-12 border-dashed">
          <CardContent className="space-y-4">
            <Info className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Veuillez sélectionner une entreprise.</p>
          </CardContent>
        </Card>
      ) : dashboardError ? (
        <Card className="mt-8 text-center py-12 border-red-300 bg-red-50">
          <CardContent className="space-y-4">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <p className="text-lg font-semibold text-red-700">Erreur de chargement des données</p>
            <Button onClick={() => window.location.reload()} variant="destructive">
              Recharger
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">CA Encaissé</CardTitle>
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{formatCurrency(dashboardData.revenue)}</div>
                <div className="flex items-center mt-2 text-sm">
                  {dashboardData.revenueChange >= 0 ? (
                    <>
                      <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
                      <span className="text-emerald-600 font-medium">+{dashboardData.revenueChange.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-600 font-medium">{dashboardData.revenueChange.toFixed(1)}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-1">vs période précédente</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Facturé</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{formatCurrency(dashboardData.totalInvoiced)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {periods.find((p) => p.value === selectedPeriod)?.label}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">À Recevoir</CardTitle>
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Hourglass className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{formatCurrency(dashboardData.outstanding)}</div>
                <p className="text-xs text-muted-foreground mt-2">Montant des factures impayées</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">En Retard</CardTitle>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{dashboardData.overdue}</div>
                <p className="text-xs text-muted-foreground mt-2">Factures échues</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-sm font-medium">Devis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-purple-600">{dashboardData.quotesStats.total}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-amber-100 rounded">
                    <div className="font-bold text-amber-700">{dashboardData.quotesStats.pending}</div>
                    <div className="text-amber-600">En attente</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-100 rounded">
                    <div className="font-bold text-emerald-700">{dashboardData.quotesStats.confirmed}</div>
                    <div className="text-emerald-600">Confirmés</div>
                  </div>
                  <div className="text-center p-2 bg-red-100 rounded">
                    <div className="font-bold text-red-700">{dashboardData.quotesStats.rejected}</div>
                    <div className="text-red-600">Refusés</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-sm font-medium">Factures</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-blue-600">
                  {dashboardData.invoicesStatus.draft +
                    dashboardData.invoicesStatus.sent +
                    dashboardData.invoicesStatus.paid +
                    dashboardData.invoicesStatus.partial}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-emerald-100 rounded">
                    <div className="font-bold text-emerald-700">{dashboardData.invoicesStatus.paid}</div>
                    <div className="text-emerald-600">Payées</div>
                  </div>
                  <div className="text-center p-2 bg-amber-100 rounded">
                    <div className="font-bold text-amber-700">
                      {dashboardData.invoicesStatus.sent + dashboardData.invoicesStatus.partial}
                    </div>
                    <div className="text-amber-600">Impayées</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-sm font-medium">Bons de Livraison</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-indigo-600">{dashboardData.deliveryStats.total}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-emerald-100 rounded">
                    <div className="font-bold text-emerald-700">{dashboardData.deliveryStats.delivered}</div>
                    <div className="text-emerald-600">Livrés</div>
                  </div>
                  <div className="text-center p-2 bg-gray-100 rounded">
                    <div className="font-bold text-gray-700">{dashboardData.deliveryStats.draft}</div>
                    <div className="text-gray-600">Brouillon</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-sm font-medium">Retours & Stock</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-orange-600">{dashboardData.returnsStats.total}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-orange-100 rounded">
                    <div className="font-bold text-orange-700">{dashboardData.returnsStats.items}</div>
                    <div className="text-orange-600">Articles retournés</div>
                  </div>
                  <div className="text-center p-2 bg-blue-100 rounded">
                    <div className="font-bold text-blue-700">{dashboardData.totalStock}</div>
                    <div className="text-blue-600">Stock total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-t-4 border-t-indigo-500">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-indigo-600" />
                <div>
                  <CardTitle className="text-xl">Analyses & Performances</CardTitle>
                  <CardDescription>Vue détaillée de vos indicateurs clés</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="revenue" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-2">
                  <TabsTrigger value="revenue" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Chiffre d'Affaires</span>
                    <span className="sm:hidden">CA</span>
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    <span className="hidden sm:inline">Produits</span>
                    <span className="sm:hidden">Produits</span>
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Clients</span>
                    <span className="sm:hidden">Clients</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Factures</span>
                    <span className="sm:hidden">Factures</span>
                  </TabsTrigger>
                  <TabsTrigger value="stock" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Stock</span>
                    <span className="sm:hidden">Stock</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="revenue" className="space-y-4">
                  <div className="border-l-4 border-l-indigo-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Évolution du CA Annuel</h3>
                    <p className="text-sm text-muted-foreground mb-4">Revenus mensuels pour l'année en cours</p>
                  </div>
                  {dashboardData.revenueChartData && dashboardData.revenueChartData.length > 0 ? (
                    <RevenueChart data={dashboardData.revenueChartData} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Info className="mx-auto h-8 w-8 mb-2" />
                      <p>Aucune donnée de vente disponible</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products" className="space-y-4">
                  <div className="border-l-4 border-l-emerald-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Top Produits</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Classement par revenu généré - {periods.find((p) => p.value === selectedPeriod)?.label}
                    </p>
                  </div>
                  {dashboardData.topProducts && dashboardData.topProducts.length > 0 ? (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-emerald-50">
                            <TableHead className="font-semibold">Produit</TableHead>
                            <TableHead className="text-center font-semibold">Quantité Vendue</TableHead>
                            <TableHead className="text-right font-semibold">Revenu Généré</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.topProducts.map((p: any, idx: number) => (
                            <TableRow key={p.product_id} className="hover:bg-emerald-50/50 transition-colors">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  {p.product_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                  {p.total_quantity_sold}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-emerald-600">
                                {formatCurrency(p.total_revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingBag className="mx-auto h-8 w-8 mb-2" />
                      <p>Aucun produit vendu pour cette période</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="customers" className="space-y-4">
                  <div className="border-l-4 border-l-purple-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Top Clients</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Classement par revenu généré - {periods.find((p) => p.value === selectedPeriod)?.label}
                    </p>
                  </div>
                  {dashboardData.topCustomers && dashboardData.topCustomers.length > 0 ? (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-purple-50">
                            <TableHead className="font-semibold">Client</TableHead>
                            <TableHead className="text-right font-semibold">Revenu Généré</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.topCustomers.map((c: any, idx: number) => (
                            <TableRow key={c.customer_id} className="hover:bg-purple-50/50 transition-colors">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  {c.customer_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-purple-600">
                                {formatCurrency(c.total_revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="mx-auto h-8 w-8 mb-2" />
                      <p>Aucun client n'a généré de revenu pour cette période</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="space-y-4">
                  <div className="border-l-4 border-l-blue-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">Répartition des Factures</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Distribution par statut - {periods.find((p) => p.value === selectedPeriod)?.label}
                    </p>
                  </div>
                  <InvoicesStatusChart data={dashboardData.invoicesStatus} />
                </TabsContent>

                <TabsContent value="stock" className="space-y-4">
                  <div className="border-l-4 border-l-amber-500 pl-4">
                    <h3 className="font-semibold text-lg mb-2">État du Stock</h3>
                    <p className="text-sm text-muted-foreground mb-4">Articles nécessitant un réapprovisionnement</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <Card className="border-2 border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-blue-600">{dashboardData.totalStock}</div>
                          <p className="text-sm text-blue-700 mt-1">Total Stock</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-amber-200 bg-amber-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-amber-600">{dashboardData.totalLowStockItems}</div>
                          <p className="text-sm text-amber-700 mt-1">Stock Bas</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-orange-200 bg-orange-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <RotateCcw className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-orange-600">{dashboardData.returnsStats.items}</div>
                          <p className="text-sm text-orange-700 mt-1">Articles Retournés</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  {dashboardData.lowStockItems && dashboardData.lowStockItems.length > 0 && (
                    <div className="rounded-lg border-2 border-amber-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="font-semibold">Article</TableHead>
                            <TableHead className="text-right font-semibold">Stock Restant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.lowStockItems.map((item: any) => (
                            <TableRow key={item.id} className="hover:bg-amber-50/50">
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                                  {item.quantity_on_hand}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-emerald-500">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                <div>
                  <CardTitle>Paiements Récents</CardTitle>
                  <CardDescription>Les 5 derniers encaissements</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {dashboardData.recentPayments && dashboardData.recentPayments.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Facture</TableHead>
                        <TableHead className="font-semibold">Client</TableHead>
                        <TableHead className="text-right font-semibold">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recentPayments.map((payment: any) => (
                        <TableRow key={payment.id} className="hover:bg-emerald-50/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(payment.payment_date).toLocaleDateString("fr-TN")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/invoices/${payment.invoices?.id || "#"}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {payment.invoices?.invoice_number || "N/A"}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">{payment.invoices?.customers?.name || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-mono font-bold">
                              {formatCurrency(payment.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="mx-auto h-8 w-8 mb-2" />
                  <p>Aucun paiement récent</p>
                  <Link href={`/dashboard/invoices?companyId=${selectedCompanyId}`}>
                    <Button variant="outline" className="mt-4 bg-transparent">
                      <FileText className="h-4 w-4 mr-2" /> Voir les factures
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
