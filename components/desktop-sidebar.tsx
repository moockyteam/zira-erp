"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Building, LayoutDashboard, Users, Boxes, ChevronLeft, ChevronRight, FileText,
  Contact, Receipt, Truck, CornerUpLeft, Package, ShoppingCart,
  TrendingDown, Briefcase, Check, ChevronsUpDown, PlusCircle, Banknote
} from "lucide-react"
import LogoutButton from "@/components/logout-button"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import { useCompany } from "@/components/providers/company-provider"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DesktopSidebarProps {
  userEmail: string
}

export function DesktopSidebar({ userEmail }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { companies, selectedCompany, setSelectedCompany } = useCompany()
  const [openCombobox, setOpenCombobox] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Dynamic Navigation Sections
  const navSections = [
    {
      title: "Général",
      links: [
        { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/dashboard/companies", label: "Mon Entreprise", icon: Building },
      ],
    },
    {
      title: "Offre",
      links: [
        { href: "/dashboard/services", label: "Mes Services", icon: Briefcase },
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
        { href: "/dashboard/payments", label: "Encaissements", icon: Banknote },
        { href: "/dashboard/expenses", label: "Dépenses & Échéances", icon: TrendingDown },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        "hidden md:flex flex-shrink-0 border-r border-sidebar-border bg-gradient-to-b from-sidebar to-sidebar/95 p-4 flex-col transition-all duration-300 sticky top-0 h-screen z-30 print:hidden",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border-2 bg-background shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* COMPANY SELECTOR */}
      <div className="mb-6">
        {!collapsed && mounted ? (
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between h-14 px-3 border-sidebar-border bg-sidebar/50 hover:bg-sidebar-accent/50"
              >
                {selectedCompany ? (
                  <div className="flex items-center gap-3 truncate text-left">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      {selectedCompany.logo_url ? <img src={selectedCompany.logo_url} className="h-full w-full object-cover rounded-lg" /> : <Building className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="truncate font-semibold text-sm">{selectedCompany.name}</span>
                      <span className="truncate text-xs text-muted-foreground font-normal">Entreprise active</span>
                    </div>
                  </div>
                ) : "Choisir entreprise..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Rechercher..." />
                <CommandList>
                  <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
                  <CommandGroup heading="Mes Entreprises">
                    {companies.map((company) => (
                      <CommandItem
                        key={company.id}
                        value={company.name}
                        onSelect={() => {
                          setSelectedCompany(company)
                          setOpenCombobox(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCompany?.id === company.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {company.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    <Link href="/dashboard/companies" onClick={() => setOpenCombobox(false)}>
                      <CommandItem className="cursor-pointer">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer une entreprise
                      </CommandItem>
                    </Link>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex justify-center">
            {!collapsed ? (
              <div className="w-full h-10 border rounded-md flex items-center px-3 bg-muted/20">
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center cursor-pointer" title={selectedCompany?.name}>
                {selectedCompany?.logo_url ? <img src={selectedCompany.logo_url} className="h-full w-full object-cover rounded-lg" /> : <Building className="h-5 w-5 text-primary" />}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex flex-col space-y-1 flex-1 overflow-y-auto scrollbar-hide -mx-2 px-2">
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
                            "w-full transition-all mb-1 font-medium",
                            collapsed ? "justify-center px-2 h-11 w-11 mx-auto rounded-xl" : "justify-start px-4 h-11 rounded-xl",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/95 scale-105"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground/80 hover:text-sidebar-foreground",
                          )}
                        >
                          <link.icon className={cn("h-[18px] w-[18px]", !collapsed && "mr-3")} />
                          {!collapsed && <span className="text-[14px]">{link.label}</span>}
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

      <div className="mt-auto space-y-3 pt-4 border-t">
        {!collapsed && (
          <div className="p-3 rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 border border-sidebar-border/50">
            <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide mb-1">Connecté</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate" title={userEmail}>{userEmail}</p>
          </div>
        )}
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  )
}

