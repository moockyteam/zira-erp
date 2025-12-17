// app/dashboard/purchase-orders/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseOrderList } from "@/components/purchase-orders/po-list";

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id);

  if (error) {
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <PurchaseOrderList userCompanies={companies || []} />
      </div>
    </div>
  );
}
