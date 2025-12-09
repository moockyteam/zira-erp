import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardCompanySelector } from "@/components/dashboard/dashboard-company-selector";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { AlertCircle, FileText, Receipt, Package, Banknote, Hourglass, PlusCircle, TrendingUp, BarChart, Users, ShoppingBag, Info, XCircle } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { getPeriodDates } from "@/lib/utils";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { LowStockItems } from "@/components/dashboard/low-stock-items";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Note: Le composant Skeleton n'est plus utilisé pour le "chargement" initial dans cette version.
// import { Skeleton } from "@/components/ui/skeleton";

// Fonction utilitaire pour le formatage monétaire (inchangée)
const formatCurrency = (amount: number | null) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(amount || 0);
};

// Périodes (inchangées)
const periods = [
    { value: 'this_month', label: 'Ce mois-ci' }, { value: 'last_month', label: 'Mois dernier' },
    { value: 'this_year', label: 'Cette année' }, { value: 'last_year', label: 'Année dernière' },
];

const ITEMS_PER_PAGE = 5;

export default async function DashboardHomePage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect("/login"); }

  let companies: any[] | null = null;
  let companiesError: any = null;
  try {
    const { data, error } = await supabase.from('companies').select('id, name, logo_url').eq('user_id', user.id);
    if (error) throw error;
    companies = data;
  } catch (error) {
    console.error("Erreur lors de la récupération des entreprises :", error);
    companiesError = error;
  }

  const resolvedSearchParams = await searchParams;
  const selectedCompanyId = resolvedSearchParams.companyId as string || companies?.[0]?.id;
  const selectedPeriod = resolvedSearchParams.period as string || 'this_month';
  const currentPage = Number(resolvedSearchParams.page || '1');

  const { startDate, endDate } = getPeriodDates(selectedPeriod);
  const { startDate: yearStartDate, endDate: yearEndDate } = getPeriodDates('this_year');

  let dashboardData: any = null;
  let dashboardError: any = null;

  if (selectedCompanyId) {
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
        const [
            kpiRevenueData,
            allUnpaidInvoicesData,
            topProductsData,
            topCustomersData,
            lowStockItems,
            lowStockCount,
            recentPayments,
            annualRevenueChartData
        ] = await Promise.all([
            supabase.from('payments').select('amount').eq('invoices.company_id', selectedCompanyId).gte('payment_date', startDate).lte('payment_date', endDate),
            supabase.from('invoices_with_totals').select('amount_due, status, due_date').eq('company_id', selectedCompanyId).in('status', ['ENVOYE', 'PARTIELLEMENT_PAYEE']),
            supabase.rpc('get_top_products_by_revenue', { p_company_id: selectedCompanyId, p_start_date: startDate, p_end_date: endDate }),
            supabase.rpc('get_top_customers_by_revenue', { p_company_id: selectedCompanyId, p_start_date: startDate, p_end_date: endDate }),
            supabase.from('items').select('id, name, quantity_on_hand').eq('company_id', selectedCompanyId).lt('quantity_on_hand', 5).order('quantity_on_hand').range(from, to),
            supabase.from('items').select('*', { count: 'exact', head: true }).eq('company_id', selectedCompanyId).lt('quantity_on_hand', 5),
            supabase.from('payments').select('id, amount, payment_date, invoices(invoice_number, customers(name))').eq('invoices.company_id', selectedCompanyId).order('payment_date', { ascending: false }).limit(5),
            supabase.rpc('get_monthly_revenue', { p_company_id: selectedCompanyId, p_start_date: yearStartDate, p_end_date: yearEndDate })
        ]);

        dashboardData = {
            revenue: (kpiRevenueData.data || []).reduce((sum, p) => sum + p.amount, 0),
            revenueChartData: annualRevenueChartData.data || [],
            outstanding: (allUnpaidInvoicesData.data || []).reduce((sum, inv) => sum + inv.amount_due, 0),
            overdue: (allUnpaidInvoicesData.data || []).filter(inv => new Date(inv.due_date) < new Date()).length,
            topProducts: topProductsData.data || [],
            topCustomers: topCustomersData.data || [],
            lowStockItems: lowStockItems.data || [],
            totalLowStockItems: lowStockCount.count || 0,
            recentPayments: recentPayments.data || [],
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des données du tableau de bord :", error);
        dashboardError = error;
    }
  }

  // Les fonctions KpiCardSkeleton et TableSkeleton sont retirées car les états de chargement sont gérés différemment
  // dans un composant serveur (on attend les données avant le rendu, ou on affiche l'état vide/erreur).

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      {/* SECTION EN-TÊTE ET TITRE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
          <p className="text-muted-foreground">Une vue d'ensemble de votre activité en un clin d'œil.</p>
        </div>
      </div>
      
      {/* SÉLECTEUR D'ENTREPRISE (maintenant seul) */}
      <div className="md:max-w-lg"> {/* Ajout d'une largeur max pour une meilleure présentation seul */}
        {companiesError ? (
            <Card className="col-span-full border-red-300 bg-red-50 text-red-700">
                <CardContent className="flex items-center gap-2 p-4">
                    <XCircle className="h-5 w-5"/>
                    <p>Erreur lors du chargement des entreprises. Veuillez réessayer plus tard.</p>
                </CardContent>
            </Card>
        ) : (
            <DashboardCompanySelector companies={companies || []} selectedCompanyId={selectedCompanyId} />
        )}
      </div>

      {/* ÉTAT : AUCUNE ENTREPRISE SÉLECTIONNÉE OU CRÉÉE */}
      {!companies?.length && !companiesError ? (
        <Card className="mt-8 text-center py-12 border-dashed">
            <CardContent className="space-y-4">
                <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-semibold">Aucune entreprise trouvée.</p>
                <p className="text-muted-foreground">Veuillez créer votre première entreprise pour commencer à utiliser le tableau de bord.</p>
                <Link href="/dashboard/companies/new">
                    <Button><PlusCircle className="h-4 w-4 mr-2"/> Créer une entreprise</Button>
                </Link>
            </CardContent>
        </Card>
      ) : !selectedCompanyId ? (
        <Card className="mt-8 text-center py-12 border-dashed">
            <CardContent className="space-y-4">
                <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-semibold">Veuillez sélectionner une entreprise.</p>
                <p className="text-muted-foreground">Sélectionnez une entreprise dans le menu déroulant ci-dessus pour afficher ses données.</p>
            </CardContent>
        </Card>
      ) : dashboardError ? (
        // GESTION DES ERREURS LORS DE LA RÉCUPÉRATION DES DONNÉES DU TABLEAU DE BORD
        <Card className="mt-8 text-center py-12 border-red-300 bg-red-50 text-red-700">
            <CardContent className="space-y-4">
                <XCircle className="mx-auto h-12 w-12 text-red-500" />
                <p className="text-lg font-semibold">Oups ! Une erreur est survenue.</p>
                <p className="text-sm">Impossible de charger les données du tableau de bord pour le moment. Veuillez vérifier votre connexion ou réessayer.</p>
                <Button onClick={() => window.location.reload()} variant="destructive">
                    Recharger la page
                </Button>
            </CardContent>
        </Card>
      ) : (
        // AFFICHAGE DU TABLEAU DE BORD PRINCIPAL (les données sont disponibles à ce stade)
        <>
          {/* SÉLECTEUR DE PÉRIODE (maintenant au-dessus des KPIs, aligné à droite) */}
          <div className="flex justify-end mb-6"> {/* mb-6 pour un bon espacement avant les KPIs */}
            <PeriodSelector selectedCompanyId={selectedCompanyId} />
          </div>

          {/* CARTES KPI */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">CA Encaissé ({ (periods.find(p => p.value === selectedPeriod))?.label })</CardTitle>
                        <Banknote className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(dashboardData.revenue)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total à Recevoir</CardTitle>
                        <Hourglass className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(dashboardData.outstanding)}</div>
                        <p className="text-xs text-muted-foreground">Montant total des factures non réglées.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Factures en Retard</CardTitle>
                        <AlertCircle className="h-5 w-5 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{dashboardData.overdue}</div>
                        <p className="text-xs text-muted-foreground">{dashboardData.overdue === 0 ? "Aucune facture en retard." : "Factures dont la date d'échéance est dépassée."}</p>
                    </CardContent>
                </Card>
          </div>

          {/* PERFORMANCE DES VENTES */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><TrendingUp className="h-5 w-5 mr-2"/> Performance des Ventes</CardTitle>
              <CardDescription>Analyse du chiffre d'affaires pour la période sélectionnée : { (periods.find(p => p.value === selectedPeriod))?.label }.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview"><BarChart className="h-4 w-4 mr-2"/> Vue Globale (Année)</TabsTrigger>
                  <TabsTrigger value="products"><ShoppingBag className="h-4 w-4 mr-2"/> Par Produit</TabsTrigger>
                  <TabsTrigger value="customers"><Users className="h-4 w-4 mr-2"/> Par Client</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="pt-4">
                  {dashboardData.revenueChartData && dashboardData.revenueChartData.length > 0 ? (
                    <RevenueChart data={dashboardData.revenueChartData} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Info className="mx-auto h-8 w-8 mb-2" />
                        <p>Aucune donnée de vente pour cette période annuelle.</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="products" className="pt-4">
                  {dashboardData.topProducts && dashboardData.topProducts.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-center">Qté Vendue</TableHead><TableHead className="text-right">Revenu Généré</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {dashboardData.topProducts.map((p: any) => (<TableRow key={p.product_id}><TableCell>{p.product_name}</TableCell><TableCell className="text-center">{p.total_quantity_sold}</TableCell><TableCell className="text-right font-mono">{formatCurrency(p.total_revenue)}</TableCell></TableRow>))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Info className="mx-auto h-8 w-8 mb-2" />
                        <p>Aucun produit vendu pour cette période.</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="customers" className="pt-4">
                   {dashboardData.topCustomers && dashboardData.topCustomers.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Revenu Généré</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {dashboardData.topCustomers.map((c: any) => (<TableRow key={c.customer_id}><TableCell>{c.customer_name}</TableCell><TableCell className="text-right font-mono">{formatCurrency(c.total_revenue)}</TableCell></TableRow>))}
                      </TableBody>
                    </Table>
                   ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Info className="mx-auto h-8 w-8 mb-2" />
                        <p>Aucun client n'a généré de revenu pour cette période.</p>
                    </div>
                   )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* PAIEMENTS RÉCENTS */}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Receipt className="h-5 w-5 mr-2"/> Paiements Récents</CardTitle>
                <CardDescription>Les 5 derniers paiements enregistrés pour cette entreprise.</CardDescription>
            </CardHeader>
            <CardContent>
                {dashboardData.recentPayments && dashboardData.recentPayments.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Numéro de Facture</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dashboardData.recentPayments.map((payment: any) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{new Date(payment.payment_date).toLocaleDateString('fr-TN')}</TableCell>
                                    <TableCell>
                                        {/* Lien vers la facture pour une meilleure UX */}
                                        {payment.invoices?.invoice_number ? (
                                            <Link href={`/dashboard/invoices/${payment.invoices.id}`} className="hover:underline">
                                                {payment.invoices.invoice_number}
                                            </Link>
                                        ) : 'N/A'}
                                    </TableCell>
                                    <TableCell>{payment.invoices?.customers?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(payment.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Info className="mx-auto h-8 w-8 mb-2" />
                        <p>Aucun paiement récent enregistré pour cette période.</p>
                        <Link href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`}><Button variant="outline" className="mt-4"><PlusCircle className="h-4 w-4 mr-2"/> Enregistrer un paiement</Button></Link>
                    </div>
                )}
            </CardContent>
          </Card>

          {/* ARTICLES EN FAIBLE STOCK (Utilise le composant existant) */}
          <LowStockItems 
              items={dashboardData.lowStockItems} 
              totalItems={dashboardData.totalLowStockItems} 
              itemsPerPage={ITEMS_PER_PAGE} 
              currentPage={currentPage}
              selectedCompanyId={selectedCompanyId}
          />
        </>
      )}
    </div>
  )
}
