// components/dashboard-display.tsx

"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompanySelector } from "@/components/company-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

const dateRanges = [
  { label: "Ce mois-ci", value: "this_month" },
  { label: "Cette semaine", value: "this_week" },
  { label: "Ce trimestre", value: "this_quarter" },
  { label: "Cette année", value: "this_year" },
];

const formatCurrency = (value: number) => `${(value || 0).toFixed(2)} TND`;

export function DashboardDisplay({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");

  useEffect(() => {
    if (userCompanies && userCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id);
    }
  }, [userCompanies, selectedCompanyId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedCompanyId) return;
      setIsLoading(true);
      
      const today = new Date();
      let startDate, endDate;
      switch (period) {
        case 'this_week': startDate = startOfWeek(today); endDate = endOfWeek(today); break;
        case 'this_quarter': startDate = startOfQuarter(today); endDate = endOfQuarter(today); break;
        case 'this_year': startDate = startOfYear(today); endDate = endOfYear(today); break;
        default: startDate = startOfMonth(today); endDate = endOfMonth(today);
      }

      const { data, error } = await supabase.rpc('get_modular_dashboard_analytics', {
        p_company_id: selectedCompanyId,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
      });

      if (error) console.error("Erreur RPC:", error);
      setData(data);
      setIsLoading(false);
    };
    fetchData();
  }, [selectedCompanyId, period, supabase]);

  const evolutionData = data?.evolution?.map((d: any) => ({
    ...d,
    month: new Date(d.month + '-02').toLocaleString('fr-FR', { month: 'short' }),
  })) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1"><CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} /></div>
        <div className="w-full md:w-48"><Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{dateRanges.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <Card>
            <CardHeader><CardTitle>Évolution de l'Activité (Année en cours)</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionData}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="invoices" name="Factures" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivery_notes" name="BL Valorisé" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Analyse des Factures & Fiscalité</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Facturé (HT)</span><span className="font-semibold">{formatCurrency(data.invoices?.total_ht)}</span></div>
                <div className="flex justify-between"><span>Encaissé</span><span className="font-semibold">{formatCurrency(data.invoices?.total_paid)}</span></div>
                <div className="pt-2 border-t">
                  <p className="font-medium">Détail TVA</p>
                  {data.invoices?.tax_details?.tva_by_rate?.map((t: any) => (
                    <div key={t.tva_rate} className="flex justify-between text-xs ml-4">
                      <span>Base {t.tva_rate}%</span>
                      <span>{formatCurrency(t.base)} | TVA: {formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between"><span>FODEC</span><span className="font-semibold">{formatCurrency(data.invoices?.tax_details?.total_fodec)}</span></div>
                <div className="flex justify-between"><span>Timbres</span><span className="font-semibold">{data.invoices?.tax_details?.total_stamps}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Analyse des Devis</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Montant Devisé</span><span className="font-semibold">{formatCurrency(data.quotes?.total_quoted)}</span></div>
                <div className="flex justify-between"><span>Montant Confirmé</span><span className="font-semibold">{formatCurrency(data.quotes?.total_confirmed)}</span></div>
                <div className="flex justify-between"><span>Taux de Conversion</span><span className="font-semibold text-lg text-emerald-600">
                  {data.quotes?.total_quoted > 0 ? ((data.quotes?.total_confirmed / data.quotes?.total_quoted) * 100).toFixed(1) : 0}%
                </span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Analyse des BL & Retours</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Livré (Valorisé)</span><span className="font-semibold">{formatCurrency(data.delivery_notes?.total_valued)}</span></div>
                <div className="flex justify-between"><span>Nombre de BL</span><span className="font-semibold">{data.delivery_notes?.count_created}</span></div>
                <div className="flex justify-between pt-2 border-t"><span>Bons de Retour</span><span className="font-semibold">{data.returns?.count_created}</span></div>
                <div className="flex justify-between"><span>Articles Retournés</span><span className="font-semibold">{data.returns?.items_returned}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Analyse Achats & Stock</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Commandé</span><span className="font-semibold">{formatCurrency(data.purchases?.total_ordered)}</span></div>
                <div className="flex justify-between"><span>Valeur du Stock</span><span className="font-semibold">{formatCurrency(data.stock?.stock_value)}</span></div>
                <div className="flex justify-between"><span>Articles en Alerte</span><span className="font-semibold text-destructive">{data.stock?.low_stock_items}</span></div>
                <div className="flex justify-between pt-2 border-t"><span>Nouveaux Clients</span><span className="font-semibold">{data.clients?.new_clients}</span></div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}