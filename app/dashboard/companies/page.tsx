//  app/dashboard/companies/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server" // Important : on utilise le client SERVEUR pour la sécurité
import { CompanyManager } from "@/components/company-manager"

// La page est une fonction "async" pour pouvoir utiliser "await"
export default async function CompaniesPage() {
  // 1. On crée une instance du client Supabase côté serveur
  const supabase = await createClient()

  // 2. On tente de récupérer les informations de l'utilisateur connecté
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 3. C'est ici que la sécurité opère :
  // Si la variable 'user' est null, cela signifie que personne n'est connecté.
  if (!user) {
    // On redirige immédiatement l'intrus vers la page de connexion.
    redirect("/login")
  }

  // 4. Si le code arrive jusqu'ici, c'est que l'utilisateur est bien authentifié.
  // On peut donc lui afficher la page en toute sécurité.
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Gestion des Entreprises</h1>

        {/* On affiche ici le composant interactif que nous avons codé à l'étape précédente */}
        <CompanyManager />
      </div>
    </div>
  )
}
