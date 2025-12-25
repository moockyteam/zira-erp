//  app/dashboard/companies/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompanyProfileManager } from "@/components/company-profile-manager" // <-- UPDATED IMPORT

export default async function CompaniesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Removed Static Title to let the component handle the header */}
        <CompanyProfileManager />
      </div>
    </div>
  )
}
