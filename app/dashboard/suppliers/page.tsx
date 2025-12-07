// Placez ce code dans le fichier : app/dashboard/suppliers/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SupplierManager } from "@/components/supplier-manager" // Le composant que nous allons créer juste après

export default async function SuppliersPage() {
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
    // Gérer l'erreur, peut-être afficher un message
    return <p>Impossible de charger les entreprises.</p>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestion des Fournisseurs</h1>

        {/* On passe la liste des entreprises au composant client */}
        <SupplierManager userCompanies={companies} />
      </div>
    </div>
  )
}
