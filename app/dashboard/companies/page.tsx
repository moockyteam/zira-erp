import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompanyProfileManager } from "@/components/company-profile-manager"
import { CompanyManager } from "@/components/company-manager"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompaniesPage(props: {
  searchParams: SearchParams
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const mode = searchParams.mode

  if (mode === 'create') {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <CompanyManager defaultOpen={true} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <CompanyProfileManager />
      </div>
    </div>
  )
}
