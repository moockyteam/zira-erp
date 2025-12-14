// components/returns/return-voucher-actions.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Printer, Edit, CheckCircle, UserCheck } from "lucide-react"
import Link from "next/link"

export function ReturnVoucherActions({ returnVoucher, onEdit, onActionSuccess }: any) {
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)
  
  const handlePrint = () => {
    window.open(`/dashboard/returns/print/${returnVoucher.id}?print=true`, '_blank');
  }

  const handleValidateReturn = async () => {
    if (!window.confirm("Confirmez-vous ce retour ? Les articles seront réintégrés au stock.")) return
    setIsUpdating(true)
    const { error: rpcError } = await supabase.rpc('restock_from_return_voucher', { p_return_id: returnVoucher.id })
    if (rpcError) { toast.error(rpcError.message); setIsUpdating(false); return }
    
    const { error: updateError } = await supabase.from("return_vouchers").update({ status: 'RETOURNE' }).eq("id", returnVoucher.id)
    if (updateError) toast.error(updateError.message)
    else {
      toast.success("Retour validé et stock mis à jour.", {
        action: {
          label: "Ajuster Solde Client",
          onClick: () => window.open('/dashboard/customers', '_blank'), // Ouvre la page client dans un nouvel onglet
        },
      })
      onActionSuccess()
    }
    setIsUpdating(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isUpdating}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimer / PDF</DropdownMenuItem>
        {returnVoucher.status === 'BROUILLON' && (
          <>
            <DropdownMenuItem onClick={onEdit}><Edit className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
            <DropdownMenuItem onClick={handleValidateReturn}><CheckCircle className="mr-2 h-4 w-4 text-green-500"/> Valider & Réintégrer Stock</DropdownMenuItem>
          </>
        )}
        {returnVoucher.status === 'RETOURNE' && (
          <Link href="/dashboard/customers" target="_blank">
            <DropdownMenuItem><UserCheck className="mr-2 h-4 w-4 text-blue-500"/> Gérer Solde Client</DropdownMenuItem>
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}