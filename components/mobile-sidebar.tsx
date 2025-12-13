"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Building,
  LayoutDashboard,
  Users,
  Boxes,
  Menu,
  FileText,
  Contact,
  Receipt,
  Truck,
  CornerUpLeft,
  Package,
  ShoppingCart,
} from "lucide-react"
import LogoutButton from "@/components/logout-button"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface MobileSidebarProps {
  userEmail: string
}

const navLinks = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/companies", label: "Entreprises", icon: Building },
  { href: "/dashboard/customers", label: "Clients", icon: Contact },
  { href: "/dashboard/suppliers", label: "Fournisseurs", icon: Users },
  { href: "/dashboard/purchase-orders", label: "Bons de Commande", icon: ShoppingCart },
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/quotes", label: "Devis", icon: FileText },
  { href: "/dashboard/invoices", label: "Factures", icon: Receipt },
  { href: "/dashboard/delivery-notes", label: "Bons de Livraison", icon: Truck },
  { href: "/dashboard/returns", label: "Bons de Retour", icon: CornerUpLeft },
  { href: "/dashboard/stock-issues", label: "Bons de Sortie", icon: Package },
]

export function MobileSidebar({ userEmail }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-sidebar to-sidebar/90 backdrop-blur-md border-b border-sidebar-border shadow-sm p-4 flex items-center justify-between print:hidden">
      <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        ERP Pro
      </h2>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="hover:bg-sidebar-accent">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 flex flex-col p-4 bg-gradient-to-b from-sidebar to-sidebar/80">
          <div className="mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ERP Pro
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Gestion d'entreprise</p>
          </div>

          <nav className="flex flex-col space-y-1 flex-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href))

              return (
                <Link key={link.href} href={link.href} passHref onClick={() => setOpen(false)}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <link.icon className="mr-3 h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 border border-sidebar-border/50">
              <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide mb-1">Connecté</p>
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userEmail}</p>
            </div>
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
