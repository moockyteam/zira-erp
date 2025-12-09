// app/dashboard/stock-issues/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StockIssueManager } from "@/components/stock-issue-manager"
import { PackageX, TrendingDown, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

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

  const { data: stockIssues } = await supabase
    .from("stock_issue_vouchers")
    .select("id, created_at")
    .eq("user_id", user.id)

  const totalIssues = stockIssues?.length || 0
  const thisMonth =
    stockIssues?.filter((issue) => {
      const issueDate = new Date(issue.created_at)
      const now = new Date()
      return issueDate.getMonth() === now.getMonth() && issueDate.getFullYear() === now.getFullYear()
    }).length || 0

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Gestion des Bons de Sortie
              </h1>
              <p className="text-muted-foreground mt-1">Gérez vos sorties de stock et suivez vos mouvements</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Sorties</p>
                    <p className="text-3xl font-bold text-orange-600">{totalIssues}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <PackageX className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ce Mois</p>
                    <p className="text-3xl font-bold text-blue-600">{thisMonth}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Impact Stock</p>
                    <p className="text-3xl font-bold text-red-600">-{totalIssues * 5}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <StockIssueManager userCompanies={companies} />
      </div>
    </div>
  )
}
