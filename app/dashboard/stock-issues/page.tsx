
// app/dashboard/stock-issues/page.tsx 
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StockIssueManager } from "@/components/stock-issue-manager"

export default async function StockIssuesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/")
  }

  const { data: companies, error } = await supabase.from("companies").select("id, name").eq("user_id", user.id)

  if (error) {
    console.error("Erreur lors de la récupération des entreprises:", error)
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestion des Bons de Sortie</h1>

        <StockIssueManager userCompanies={companies} />
      </div>
    </div>
  )
}
