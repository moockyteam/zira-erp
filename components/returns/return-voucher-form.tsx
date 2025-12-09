// Créez le dossier et le fichier : components/returns/return-voucher-actions.tsx

"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Eye, Printer } from "lucide-react"

export function ReturnVoucherActions({ returnVoucher }: { returnVoucher: any }) {
  
  const handlePrint = () => {
    window.open(`/dashboard/returns/print/${returnVoucher.id}?print=true`, '_blank');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* On ne crée pas de popup d'aperçu pour simplifier, on va direct à l'impression */}
        <DropdownMenuItem onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
