// app/dashboard/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardDisplay } from "@/components/dashboard-display"; // Le nouveau composant client

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase.from("companies").select("id, name, logo_url").eq("user_id", user.id);
  if (!companies || companies.length === 0) {
    return <p className="p-8">Veuillez créer une entreprise pour voir le tableau de bord.</p>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <DashboardDisplay userCompanies={companies} />
      </div>
    </div>
  );
}