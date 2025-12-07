// app/dashboard/stock/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StockManager } from "@/components/stock-manager" // Le composant que nous allons créer

export default async function StockPage() {
  const supabase = await createClient()

  // 1. Sécuriser la page
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // 2. Récupérer les entreprises de l'utilisateur pour le menu déroulant
  const { data: companies, error } = await supabase.from("companies").select("id, name").eq("user_id", user.id)

  if (error) {
    console.error("Erreur lors de la récupération des entreprises:", error)
    return <p className="p-8">Erreur: Impossible de charger vos entreprises.</p>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestion de l'Inventaire</h1>

        {/* On passe la liste des entreprises au composant client */}
        <StockManager userCompanies={companies} />
      </div>
    </div>
  )
}
