// components/expenses/expense-manager.tsx

"use client"

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { CompanySelector } from "@/components/company-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PlusCircle, Download, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ExpenseManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id);
  }, [userCompanies]);

  useEffect(() => {
    if (selectedCompanyId) fetchExpenses(selectedCompanyId);
    else setExpenses([]);
  }, [selectedCompanyId]);

  const fetchExpenses = async (companyId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    
    if (error) toast.error("Impossible de charger les dépenses.");
    else setExpenses(data || []);
    setIsLoading(false);
  };

  const filteredExpenses = useMemo(() => {
    if (!dateRange?.from) return expenses;
    const to = dateRange.to || dateRange.from;
    return expenses.filter(e => {
      const expenseDate = new Date(e.created_at);
      return expenseDate >= dateRange.from! && expenseDate <= to;
    });
  }, [expenses, dateRange]);

  const handleExport = () => {
    toast.info("La fonctionnalité d'exportation sera bientôt disponible.");
  };

  return (
    <div className="space-y-6">
      <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} />
      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Historique des Dépenses</CardTitle></div>
            <div className="flex gap-2">
              <Link href={`/dashboard/expenses/new?companyId=${selectedCompanyId}`}>
                <Button><PlusCircle className="h-4 w-4 mr-2"/>Ajouter</Button>
              </Link>
              <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2"/>Exporter</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bénéficiaire</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Pièce Jointe</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Chargement...</TableCell></TableRow>
                ) : filteredExpenses.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">{p.beneficiary}</TableCell>
                    <TableCell>{p.expense_categories?.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'PAYE' ? 'default' : 'destructive'}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon"><FileUp className="h-4 w-4"/></Button></a>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{p.total_ttc.toFixed(3)} TND</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
