// components/supplier-manager.tsx

"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { CompanySelector } from "@/components/company-selector";
import { SupplierPaymentDialog } from "@/components/payments/supplier-payment-dialog"; // NOUVEAU

export function SupplierManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [supplierToPay, setSupplierToPay] = useState<any | null>(null);

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id);
  }, [userCompanies]);

  useEffect(() => {
    if (selectedCompanyId) fetchSuppliers(selectedCompanyId);
    else setSuppliers([]);
  }, [selectedCompanyId]);

  const fetchSuppliers = async (companyId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.from("suppliers_with_totals").select("*").eq("company_id", companyId);
    if (error) toast.error("Impossible de charger les fournisseurs.");
    else setSuppliers(data || []);
    setIsLoading(false);
  };

  const openPaymentDialog = (supplier: any) => {
    setSupplierToPay(supplier);
    setIsPaymentOpen(true);
  };

  return (
    <>
      <div className="space-y-8">
        <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} />
        {selectedCompanyId && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Solde Dû</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.contact_person}</TableCell>
                  <TableCell className="text-right font-mono">{s.balance.toFixed(3)} TND</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => openPaymentDialog(s)}>
                      <DollarSign className="h-4 w-4 mr-2"/> Payer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <SupplierPaymentDialog
        isOpen={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        supplier={supplierToPay}
        companyId={selectedCompanyId}
        onSuccess={() => fetchSuppliers(selectedCompanyId!)}
      />
    </>
  );
}
