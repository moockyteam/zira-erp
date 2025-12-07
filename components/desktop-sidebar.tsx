// Remplacez le contenu de : components/desktop-sidebar.tsx

"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
// --- NOUVEAUX IMPORTS ---
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Building, LayoutDashboard, Users, Boxes, ChevronLeft, ChevronRight, 
  FileText, Contact, Receipt, Truck, CornerUpLeft 
} from "lucide-react"
// --- FIN NOUVEAUX IMPORTS ---
import LogoutButton from "@/components/logout-button"
import { cn } from "@/lib/utils"

interface DesktopSidebarProps {
  userEmail: string
}

const navLinks = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/companies", label: "Entreprises", icon: Building },
  { href: "/dashboard/customers", label: "Clients", icon: Contact },
  { href: "/dashboard/suppliers", label: "Fournisseurs", icon: Users },
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/quotes", label: "Devis", icon: FileText },
  { href: "/dashboard/invoices", label: "Factures", icon: Receipt }, // <-- NOUVEAU
  { href: "/dashboard/delivery-notes", label: "Bons de Livraison", icon: Truck }, // <-- NOUVEAU
  { href: "/dashboard/returns", label: "Bons de Retour", icon: CornerUpLeft }, // <-- NOUVEAU
  { href: "/dashboard/stock-issues", label: "Bons de Sortie", icon: FileText },
]

export function DesktopSidebar({ userEmail }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "hidden md:flex flex-shrink-0 border-r bg-muted/40 p-4 flex-col transition-all duration-300 relative print:hidden",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <Button
        variant="ghost" size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background shadow-md"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className="mb-8">
        <h2 className={cn("text-xl font-bold transition-all", collapsed && "text-center text-base")}>
          {collapsed ? "ERP" : "ERP-APP"}
        </h2>
      </div>

      <nav className="flex flex-col space-y-2">
        <TooltipProvider delayDuration={0}>
          {navLinks.map((link) => (
            <Tooltip key={link.href}>
              <TooltipTrigger asChild>
                <Link href={link.href} passHref>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full text-muted-foreground hover:text-foreground",
                      collapsed ? "justify-center px-2" : "justify-start",
                    )}
                  >
                    <link.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
                    {!collapsed && link.label}
                  </Button>
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>{link.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      <div className="mt-auto">
        {!collapsed && (
          <div className="p-2 rounded-lg bg-background mb-2">
            <p className="text-sm font-medium">Connecté en tant que</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        )}
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  )
}