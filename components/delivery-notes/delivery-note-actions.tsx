// components/delivery-notes/delivery-note-actions.tsx

"use client"

import { useState } from "react"
import Link from "next/link";
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
// LA CORRECTION EST ICI
import { MoreHorizontal, Truck, Ban, Eye, Printer, Edit, Archive, CheckCircle } from "lucide-react"
import { DeliveryNotePreviewDialog } from "./delivery-note-preview-dialog";

export function DnActions({ dn, onActionSuccess }: { dn: any, onActionSuccess: () => void }) {
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateStatus = async (newStatus: string) => {
    if (newStatus === 'LIVRE') {
      if (!window.confirm("Confirmez-vous la livraison ? Cette action déduira les articles du stock.")) {
        return;
      }
    }

    setIsUpdating(true)
    
    if (newStatus === 'LIVRE') {
      const { error: deductError } = await supabase.rpc('deduct_stock_from_delivery_note', { p_dn_id: dn.id })
      if (deductError) {
        toast.error("Erreur lors de la déduction du stock: " + deductError.message)
        setIsUpdating(false)
        return
      }
      toast.success("Stock mis à jour avec succès.")
    }

    const { error } = await supabase.from('delivery_notes').update({ status: newStatus }).eq('id', dn.id)
    if (error) {
      toast.error("Erreur lors de la mise à jour du statut: " + error.message)
    } else {
      toast.success(`Bon de livraison marqué comme ${newStatus}.`)
      onActionSuccess()
    }
    setIsUpdating(false)
  }

  const handlePrint = () => {
    window.open(`/dashboard/delivery-notes/print/${dn.id}?print=true`, '_blank');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating}>
          <span className="sr-only">Ouvrir menu</span>
          {isUpdating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        
        <DeliveryNotePreviewDialog dnId={dn.id}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Eye className="mr-2 h-4 w-4" /> Aperçu
          </DropdownMenuItem>
        </DeliveryNotePreviewDialog>

        <DropdownMenuItem onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />

        {dn.status === 'BROUILLON' && (
            <>
                <Link href={`/dashboard/delivery-notes/${dn.id}`} passHref>
                    <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" /> Modifier
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => updateStatus('LIVRE')}>
                    <Truck className="mr-2 h-4 w-4 text-green-500"/> Marquer comme Livré & Sortir du Stock
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => updateStatus('ANNULE')} className="text-red-600">
                    <Ban className="mr-2 h-4 w-4"/> Annuler
                </DropdownMenuItem>
            </>
        )}
        
        {dn.status === 'LIVRE' && (
            <DropdownMenuItem disabled>
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Déjà livré
            </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}