// app/dashboard/expenses/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpenseManager } from "@/components/expenses/expense-manager";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase.from("companies").select("id, name, logo_url").eq("user_id", user.id);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <ExpenseManager userCompanies={companies || []} />
      </div>
    </div>
  );
}