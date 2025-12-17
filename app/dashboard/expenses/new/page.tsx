// app/dashboard/expenses/new/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function NewExpensePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // On pré-charge les données nécessaires pour le formulaire
  const { data: companies } = await supabase.from("companies").select("id, name").eq("user_id", user.id);
  
  // Note: les catégories seront chargées côté client pour être dynamiques
  
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Enregistrer une Dépense</h1>
          <p className="text-muted-foreground">Saisissez les détails de votre charge, achat ou paiement.</p>
        </div>
        <ExpenseForm companies={companies || []} />
      </div>
    </div>
  );
}
