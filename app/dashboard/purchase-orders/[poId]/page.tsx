// app/dashboard/purchase-orders/[poId]/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseOrderForm } from "@/components/purchase-orders/po-form";

// MODIFIÉ: Le type de 'params' est maintenant une Promesse
export default async function PurchaseOrderEditorPage({ params }: { params: Promise<{ poId: string }> }) {
  // MODIFIÉ: On utilise 'await' pour résoudre la promesse avant de déstructurer
  const { poId } = await params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase.from("companies").select("id, name").eq("user_id", user.id);
  if (!companies || companies.length === 0) {
    return <p className="p-8">Veuillez d'abord créer une entreprise.</p>;
  }

  const isNew = poId === "new";
  let poData = null;
  let companyIdForData = companies[0].id;

  if (!isNew) {
    const { data } = await supabase.from("purchase_orders").select("*, purchase_order_lines(*)").eq("id", poId).single();
    if (!data) redirect("/dashboard/purchase-orders");
    poData = data;
    companyIdForData = data.company_id;
  }

  const { data: suppliers } = await supabase.from("suppliers").select("id, name").eq("company_id", companyIdForData);
  const { data: items } = await supabase.from("items").select("id, name, reference").eq("company_id", companyIdForData).eq("is_archived", false);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          {isNew ? "Créer un Bon de Commande" : `Modifier le Bon de Commande`}
        </h1>
        <PurchaseOrderForm
          initialData={poData}
          companies={companies}
          suppliers={suppliers || []}
          items={items || []}
        />
      </div>
    </div>
  );
}
