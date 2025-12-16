"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
// NOUVEAU: Import des icônes manquantes
import {
  Building, LayoutDashboard, Users, Boxes, ChevronLeft, ChevronRight, FileText,
  Contact, Receipt, Truck, CornerUpLeft, Package, ShoppingCart,
  TrendingDown, // Pour Dépenses
} from "lucide-react"
import LogoutButton from "@/components/logout-button"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

interface DesktopSidebarProps {
  userEmail: string
}

// NOUVEAU: Structure thématique
const navSections = [
  {
    title: "Général",
    links: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/dashboard/companies", label: "Mon Entreprise", icon: Building },
    ],
  },
  {
    title: "Ventes",
    links: [
      { href: "/dashboard/customers", label: "Clients", icon: Contact },
      { href: "/dashboard/quotes", label: "Devis", icon: FileText },
      { href: "/dashboard/invoices", label: "Factures", icon: Receipt },
    ],
  },
  {
    title: "Achats",
    links: [
      { href: "/dashboard/suppliers", label: "Fournisseurs", icon: Users },
      { href: "/dashboard/purchase-orders", label: "Bons de Commande", icon: ShoppingCart },
    ],
  },
  {
    title: "Logistique",
    links: [
      { href: "/dashboard/stock", label: "Stock", icon: Boxes },
      { href: "/dashboard/delivery-notes", label: "Bons de Livraison", icon: Truck },
      { href: "/dashboard/returns", label: "Bons de Retour", icon: CornerUpLeft },
      { href: "/dashboard/stock-issues", label: "Bons de Sortie", icon: Package },
    ],
  },
  {
    title: "Finance",
    links: [
      { href: "/dashboard/expenses", label: "Dépenses & Échéances", icon: TrendingDown },
    ],
  },
]

export function DesktopSidebar({ userEmail }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "hidden md:flex flex-shrink-0 border-r bg-gradient-to-b from-sidebar to-sidebar/80 backdrop-blur-sm p-4 flex-col transition-all duration-300 relative print:hidden shadow-sm",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border-2 bg-background shadow-lg hover:shadow-xl transition-all hover:scale-110"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className="mb-8">
        <h2
          className={cn(
            "font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transition-all",
            collapsed ? "text-center text-base" : "text-2xl",
          )}
        >
          {collapsed ? "ERP" : "ERP Pro"}
        </h2>
        {!collapsed && <p className="text-xs text-muted-foreground mt-1">Gestion d'entreprise</p>}
      </div>

      {/* NOUVEAU: Logique d'affichage par section */}
      <nav className="flex flex-col space-y-1 flex-1 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navSections.map((section) => (
            <div key={section.title} className={!collapsed ? "space-y-2" : "space-y-1"}>
              {!collapsed && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4">
                  {section.title}
                </h3>
              )}
              {section.links.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href))
                return (
                  <Tooltip key={link.href}>
                    <TooltipTrigger asChild>
                      <Link href={link.href} passHref>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          className={cn(
                            "w-full transition-all",
                            collapsed ? "justify-center px-2" : "justify-start",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <link.icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
                          {!collapsed && link.label}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="font-medium">
                        <p>{link.label}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </TooltipProvider>
      </nav>

      <div className="mt-auto space-y-3 pt-4">
        {!collapsed && (
          <div className="p-3 rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 border border-sidebar-border/50">
            <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide mb-1">Connecté</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userEmail}</p>
          </div>
        )}
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  )
}