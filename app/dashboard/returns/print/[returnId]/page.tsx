// app/dashboard/returns/print/[returnId]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReturnVoucherPreview } from "@/components/returns/return-voucher-preview";
import { PrintTrigger } from "@/components/print-trigger";

export default async function PrintReturnPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ returnId: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { returnId } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  
  // --- LA CORRECTION EST ICI ---
  // On demande les bonnes colonnes pour la table 'customers'
  const { data: returnVoucher, error } = await supabase
    .from('return_vouchers')
    .select(`
      *,
      companies(*),
      customers(
        name, 
        street, 
        delegation, 
        governorate, 
        country, 
        phone_number, 
        matricule_fiscal
      ),
      return_voucher_lines(*, items(name, reference))
    `)
    .eq('id', returnId)
    .single();

  if (error || !returnVoucher) {
    console.error("Erreur Supabase ou BR non trouvé lors de l'impression:", { error });
    return notFound();
  }

  const shouldPrint = resolvedSearchParams.print === 'true';

  return (
    <>
      <ReturnVoucherPreview returnVoucher={returnVoucher} />
      {shouldPrint && <PrintTrigger />}
    </>
  );
}