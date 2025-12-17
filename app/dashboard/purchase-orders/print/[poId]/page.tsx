// app/dashboard/purchase-orders/print/[poId]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PurchaseOrderPreview } from "@/components/purchase-orders/po-preview";

// MODIFIÉ: Les types de 'params' et 'searchParams' sont maintenant des Promesses
export default async function PrintPOPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ poId: string }>, 
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  // MODIFIÉ: On utilise 'await' pour résoudre les promesses
  const { poId } = await params;
  const resolvedSearchParams = await searchParams;
  
  const supabase = await createClient();
  
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(`*, companies(*), suppliers(*), purchase_order_lines(*, items(reference))`)
    .eq('id', poId)
    .single();

  if (error || !po) {
    return notFound();
  }

  // On utilise la version résolue des searchParams
  const shouldPrint = resolvedSearchParams.print === 'true';

  return (
    <>
      <PurchaseOrderPreview po={po} />
      {shouldPrint && (
        <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
      )}
    </>
  );
}
