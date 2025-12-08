// Remplacez le contenu de : app/dashboard/page.tsx

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CompanySelector } from "@/components/company-selector";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AlertCircle, FileText, Receipt, Package, Banknote, Hourglass, ShoppingCart } from "lucide-react";

const formatCurrency = (amount: number | null) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(amount || 0);
};

// --- CORRECTION DANS LA SIGNATURE ---
export default async function DashboardHomePage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('user_id', user.id);
  
  // --- CORRECTION AVEC 'await' ---
  const resolvedSearchParams = await searchParams;
  const selectedCompanyId = resolvedSearchParams.companyId as string || companies?.[0]?.id;

  let dashboardData = null;
  if (selectedCompanyId) {
    const [
      kpiData,
      recentInvoices,
      recentQuotes,
      lowStockItems
    ] = await Promise.all([
      supabase.from('invoices_with_totals').select('total_ttc, amount_due, status, due_date').eq('company_id', selectedCompanyId),
      supabase.from('invoices').select('id, invoice_number, total_ttc, status, customers(name)').eq('company_id', selectedCompanyId).order('created_at', { ascending: false }).limit(5),
      supabase.from('quotes').select('id, quote_number, total_ttc, status, customers(name), prospect_name').eq('company_id', selectedCompanyId).order('created_at', { ascending: false }).limit(5),
      supabase.from('items').select('id, name, quantity_on_hand').eq('company_id', selectedCompanyId).lt('quantity_on_hand', 5).order('quantity_on_hand', { ascending: true })
    ]);

    const invoices = kpiData.data || [];
    const revenue = invoices.filter(inv => inv.status === 'PAYEE').reduce((sum, inv) => sum + inv.total_ttc, 0);
    const outstanding = invoices.filter(inv => inv.status === 'ENVOYE' || inv.status === 'PARTIELLEMENT_PAYEE').reduce((sum, inv) => sum + inv.amount_due, 0);
    const overdue = invoices.filter(inv => (inv.status === 'ENVOYE' || inv.status === 'PARTIELLEMENT_PAYEE') && new Date(inv.due_date) < new Date()).length;
    
    dashboardData = {
      revenue,
      outstanding,
      overdue,
      recentInvoices: recentInvoices.data,
      recentQuotes: recentQuotes.data,
      lowStockItems: lowStockItems.data
    }
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Tableau de Bord</h1>
      
      <CompanySelector 
        companies={companies || []} 
        selectedCompanyId={selectedCompanyId} 
      />

      {!selectedCompanyId ? (
        <Card className="mt-8 text-center py-12">
          <CardContent><p className="text-muted-foreground">Veuillez sélectionner une entreprise pour afficher les données.</p></CardContent>
        </Card>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Chiffre d'affaires (Payé)</CardTitle><Banknote className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(dashboardData?.revenue)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Montant à recevoir</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(dashboardData?.outstanding)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Factures en Retard</CardTitle><AlertCircle className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{dashboardData?.overdue}</div></CardContent></Card>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><Receipt className="h-5 w-5 mr-2"/> Factures Récentes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Numéro</TableHead><TableHead>Client</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dashboardData?.recentInvoices?.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell><Link href={`/dashboard/invoices/print/${inv.id}`} className="font-medium hover:underline">{inv.invoice_number}</Link></TableCell>
                        <TableCell>{inv.customers?.name}</TableCell>
                        <TableCell><Badge>{inv.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center"><FileText className="h-5 w-5 mr-2"/> Devis Récents</CardTitle></CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader><TableRow><TableHead>Numéro</TableHead><TableHead>Client/Prospect</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dashboardData?.recentQuotes?.map((q: any) => (
                      <TableRow key={q.id}>
                        <TableCell><Link href={`/dashboard/quotes/${q.id}`} className="font-medium hover:underline">{q.quote_number}</Link></TableCell>
                        <TableCell>{q.customers?.name || q.prospect_name}</TableCell>
                        <TableCell><Badge>{q.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          {dashboardData?.lowStockItems && dashboardData.lowStockItems.length > 0 && (
            <Card className="border-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center text-yellow-600"><Package className="h-5 w-5 mr-2"/> Articles en Stock Bas</CardTitle>
                <CardDescription>Ces articles ont une quantité inférieure à 5. Pensez à réapprovisionner.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                   <TableHeader><TableRow><TableHead>Article</TableHead><TableHead className="text-right">Quantité Restante</TableHead></TableRow></TableHeader>
                   <TableBody>
                      {dashboardData.lowStockItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right font-bold text-yellow-700">{item.quantity_on_hand}</TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  )
}