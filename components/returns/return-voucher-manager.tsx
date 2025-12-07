// Fichier : components/returns/return-voucher-manager.tsx

"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CompanySelector } from "@/components/company-selector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle } from "lucide-react";
import { ReturnVoucherActions } from "./return-voucher-actions";

// --- LA CORRECTION EST ICI ---
export function ReturnVoucherManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id); }, [userCompanies]);
  useEffect(() => { if (selectedCompanyId) fetchReturns(selectedCompanyId); else setReturns([]); }, [selectedCompanyId]);

  const fetchReturns = async (companyId: string) => {
    setIsLoading(true);
    const { data } = await supabase.from("return_vouchers").select(`*, customers(name)`).eq("company_id", companyId).order('created_at', { ascending: false });
    setReturns(data || []);
    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} />
      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Historique des Bons de Retour</CardTitle>
              <CardDescription>Liste de toutes les marchandises retournées.</CardDescription>
            </div>
            <Link href={`/dashboard/returns/new?companyId=${selectedCompanyId}`} passHref>
              <Button><PlusCircle className="h-4 w-4 mr-2" /> Nouveau Bon de Retour</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Numéro</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead><TableHead>Réf. Document</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5} className="text-center">Chargement...</TableCell></TableRow> :
                 returns.length > 0 ? returns.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.return_voucher_number}</TableCell>
                      <TableCell>{r.customers?.name}</TableCell>
                      <TableCell>{new Date(r.return_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{r.source_document_ref}</TableCell>
                      <TableCell>
                          <ReturnVoucherActions returnVoucher={r} />
                      </TableCell>
                    </TableRow>
                 )) : <TableRow><TableCell colSpan={5} className="text-center">Aucun bon de retour.</TableCell></TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}