import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { DesktopSidebar } from "@/components/desktop-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { CompanyProvider } from "@/components/providers/company-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // Fetch companies for the provider
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, logo_url, activity")
    .eq("user_id", user.id)

  return (
    <CompanyProvider initialCompanies={companies || []}>
      <div className="flex min-h-screen">
        <MobileSidebar userEmail={user.email || ""} />

        <DesktopSidebar userEmail={user.email || ""} />

        <main className="flex-1 p-4 md:p-6 w-full pt-20 md:pt-6">{children}</main>

        <Toaster richColors position="top-right" />
      </div>
    </CompanyProvider>
  )
}
