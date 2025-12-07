// components/mobile-sidebar.tsx

"use client"

import { useState, useEffect } from "react" // <-- J'ai ajouté useEffect
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Building, LayoutDashboard, Users, Boxes, Menu, FileText, Contact } from "lucide-react"
import LogoutButton from "@/components/logout-button"

interface MobileSidebarProps {
  userEmail: string
}

export function MobileSidebar({ userEmail }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false) // <-- J'ai ajouté cet état

  // Ce hook s'assure que le code à l'intérieur ne s'exécute que sur le client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // On ne rend rien sur le serveur ou avant que le composant soit "monté" sur le client
  if (!isMounted) {
    return null
  }

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b p-4 flex items-center justify-between print:hidden">
      <h2 className="text-xl font-bold">Compta-App</h2>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 flex flex-col p-4">
          <div className="mb-8">
            <h2 className="text-xl font-bold">Compta-App</h2>
          </div>

          <nav className="flex flex-col space-y-2 flex-1">
            <Link href="/dashboard" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Tableau de bord
              </Button>
            </Link>
            <Link href="/dashboard/companies" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <Building className="mr-2 h-4 w-4" />
                Entreprises
              </Button>
            </Link>
            <Link href="/dashboard/suppliers" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Users className="mr-2 h-4 w-4" />
                Fournisseurs
              </Button>
            </Link>
            <Link href="/dashboard/stock" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Boxes className="mr-2 h-4 w-4" />
                Stock
              </Button>
            </Link>
             <Link href="/dashboard/quotes" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <FileText className="mr-2 h-4 w-4" />
                Devis
              </Button>
            </Link>
            <Link href="/dashboard/stock-issues" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <FileText className="mr-2 h-4 w-4" />
                Bon de sortie
              </Button>
            </Link>
            <Link href="/dashboard/customers" passHref onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Contact className="mr-2 h-4 w-4" />
                Clients
              </Button>
            </Link>
          </nav>

          <div className="mt-auto">
            <div className="p-2 rounded-lg bg-muted mb-2">
              <p className="text-sm font-medium">Connecté en tant que</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}