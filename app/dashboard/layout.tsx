import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { DesktopSidebar } from "@/components/desktop-sidebar"
import { Toaster } from "@/components/ui/sonner" // <-- 1. IMPORTEZ LE COMPOSANT ICI

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

  return (
    <div className="flex min-h-screen">
      <MobileSidebar userEmail={user.email || ""} />

      <DesktopSidebar userEmail={user.email || ""} />

      <main className="flex-1 p-4 md:p-6 w-full pt-20 md:pt-6">{children}</main>

      <Toaster richColors position="top-right" /> {/* <-- 2. AJOUTEZ CETTE LIGNE JUSTE AVANT LA FIN DE LA DIV PRINCIPALE */}
    </div>
  )
}
