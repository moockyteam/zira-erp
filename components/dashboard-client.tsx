// components/dashboard-client.tsx

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Package, Users } from "lucide-react";

const formatValue = (value: number) => `${value.toFixed(2)} TND`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function DashboardClient({ data }: { data: any }) {
  if (!data) return <p>Aucune donnée à afficher pour cette période.</p>;

  const { kpis, monthly_sales, category_sales, top_products, top_clients, tax_details } = data;

  const formattedMonthlySales = monthly_sales?.map((d: any) => ({
    ...d,
    month: new Date(d.month + '-02').toLocaleString('default', { month: 'short' }),
  })) || [];

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Ventes (TTC)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatValue(kpis.total_revenue)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Montant Encaissé</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatValue(kpis.total_paid)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Valeur du Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatValue(kpis.stock_value)}</p></CardContent></Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ventes Mensuelles (Année en cours)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedMonthlySales}>
                <XAxis dataKey="month" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip formatter={(value: number) => formatValue(value)} />
                <Bar dataKey="revenue" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ventes par Catégorie</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={category_sales} dataKey="revenue" nameKey="category_name" cx="50%" cy="50%" outerRadius={80} label>
                  {category_sales?.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatValue(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Classements et Détails */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Top 5 Produits</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {top_products?.map((p: any, i: number) => <li key={i} className="flex justify-between"><span>{p.product_name}</span><span className="font-semibold">{formatValue(p.revenue)}</span></li>)}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top 5 Clients</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {top_clients?.map((c: any, i: number) => <li key={i} className="flex justify-between"><span>{c.client_name}</span><span className="font-semibold">{formatValue(c.revenue)}</span></li>)}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Détail Fiscal</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total TVA</span><span className="font-semibold">{formatValue(tax_details.total_tva)}</span></div>
            <div className="flex justify-between"><span>Total FODEC</span><span className="font-semibold">{formatValue(tax_details.total_fodec)}</span></div>
            <div className="flex justify-between"><span>Timbres</span><span className="font-semibold">{formatValue(tax_details.total_stamps)}</span></div>
            <div className="pt-2 border-t">
              {tax_details.tva_by_rate?.map((t: any) => <div key={t.tva_rate} className="flex justify-between text-xs"><span>Base {t.tva_rate}%</span><span>{formatValue(t.base)}</span></div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}