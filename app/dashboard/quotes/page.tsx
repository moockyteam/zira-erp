//app/dashboard/quotes/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteList } from "@/components/quotes/quote-list"; // Le composant que nous créons juste après

export default async function QuotesPage() {
  // Vérification de ma part : 'await' est bien présent.
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Récupérer les entreprises de l'utilisateur
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('user_id', user.id);

  if (error) {
    console.error("Erreur lors de la récupération des entreprises:", error);
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <QuoteList userCompanies={companies} />
      </div>
    </div>
  );
}
