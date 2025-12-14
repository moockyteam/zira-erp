//app/dashboard/returns/pages.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReturnVoucherManager } from "@/components/returns/return-voucher-manager"

export default async function ReturnsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data: companies } = await supabase.from("companies").select("id, name").eq("user_id", user.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-indigo-500/5 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Bons de Retour
          </h1>
          <p className="text-muted-foreground">Gérez les retours de marchandises de vos clients</p>
        </div>
        <ReturnVoucherManager userCompanies={companies || []} />
      </div>
    </div>
  )
}
