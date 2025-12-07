// Remplacez le contenu de : app/dashboard/returns/print/[returnId]/page.tsx

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
  const { data: returnVoucher, error } = await supabase
    .from('return_vouchers')
    .select(`
      *,
      companies(*),
      customers(name, address, phone_number, matricule_fiscal),
      return_voucher_lines(*, items(name, reference))
    `)
    .eq('id', returnId)
    .single();

  if (error || !returnVoucher) {
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