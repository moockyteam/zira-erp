"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoutButtonProps {
  collapsed?: boolean
}

export default function LogoutButton({ collapsed = false }: LogoutButtonProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <Button variant="outline" className={cn("w-full", collapsed ? "px-2" : "")} onClick={handleLogout}>
      <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
      {!collapsed && "Déconnexion"}
    </Button>
  )
}
