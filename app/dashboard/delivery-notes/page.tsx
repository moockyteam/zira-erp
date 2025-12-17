// app/dashboard/delivery-notes/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeliveryNoteList } from "@/components/delivery-notes/delivery-note-list";

export default async function DeliveryNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('user_id', user.id);

  if (error) {
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DeliveryNoteList userCompanies={companies || []} />
      </div>
    </div>
  );
}
