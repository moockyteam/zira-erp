// Remplacez le contenu de : app/dashboard/returns/new/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReturnVoucherForm } from "@/components/returns/return-voucher-form";

export default async function NewReturnPage({ 
  searchParams
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const companyId = resolvedSearchParams.companyId as string | undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect("/login"); }

  // --- LA CORRECTION EST ICI ---
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone_number, address, matricule_fiscal') // On demande bien TOUTES les infos
    .eq('company_id', companyId);

  const { data: items } = await supabase.from('items').select('id, name, reference').eq('company_id', companyId);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Créer un Bon de Retour</h1>
        <ReturnVoucherForm 
          companyId={companyId!}
          customers={customers || []}
          items={items || []}
        />
      </div>
    </div>
  );
}