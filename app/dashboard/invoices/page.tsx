//  app/dashboard/invoices/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceList } from "@/components/invoices/invoice-list"; // <-- Le composant que nous créerons ensuite

export default async function InvoicesPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Récupérer les entreprises de l'utilisateur pour le sélecteur
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, logo_url') // On prend le logo pour le CompanySelector
    .eq('user_id', user.id);

  if (error) {
    console.error("Erreur lors de la récupération des entreprises:", error);
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Le composant côté client qui contiendra la logique d'affichage */}
        <InvoiceList userCompanies={companies || []} />
      </div>
    </div>
  );
}
