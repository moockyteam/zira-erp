// Créez le dossier et le fichier : app/dashboard/returns/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReturnVoucherManager } from "@/components/returns/return-voucher-manager";

export default async function ReturnsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestion des Bons de Retour</h1>
        <ReturnVoucherManager userCompanies={companies || []} />
      </div>
    </div>
  );
}