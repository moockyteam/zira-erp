import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardHomePage() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Tableau de Bord</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Chiffre d'affaires (à venir)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold">0 €</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Factures en attente (à venir)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenue sur votre application de gestion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm md:text-base">
              Utilisez le menu de navigation {/* Updated text for mobile */}
              <span className="md:hidden">en haut</span>
              <span className="hidden md:inline">sur la gauche</span> pour gérer vos entreprises, fournisseurs, stocks
              et documents commerciaux.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
