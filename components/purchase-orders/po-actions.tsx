// components/purchase-orders/po-actions.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Printer, MoreVertical, Edit, CheckCircle, XCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import Link from "next/link"

type POStatus = 'BROUILLON' | 'ENVOYE' | 'RECU' | 'ANNULE';

interface POActionsProps {
  poId: string;
  currentStatus: POStatus;
  onStatusChange: (newStatus: POStatus) => void;
}

export function PurchaseOrderActions({ poId, currentStatus, onStatusChange }: POActionsProps) {
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const handlePrint = () => {
    window.open(`/dashboard/purchase-orders/print/${poId}?print=true`, '_blank');
  }

  const updateStatus = async (newStatus: POStatus) => {
    setIsUpdating(true)
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId)
    if (error) toast.error(error.message)
    else { toast.success("Statut mis à jour."); onStatusChange(newStatus) }
    setIsUpdating(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isUpdating}><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Imprimer / PDF</DropdownMenuItem>
        {currentStatus === 'BROUILLON' && (
          <Link href={`/dashboard/purchase-orders/${poId}`} passHref>
            <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Modifier</DropdownMenuItem>
          </Link>
        )}
        <DropdownMenuSeparator />
        {currentStatus === 'BROUILLON' && <DropdownMenuItem onClick={() => updateStatus('ENVOYE')}>Marquer comme Envoyé</DropdownMenuItem>}
        {currentStatus === 'ENVOYE' && <DropdownMenuItem onClick={() => updateStatus('RECU')}><CheckCircle className="h-4 w-4 mr-2"/>Marquer comme Reçu</DropdownMenuItem>}
        {currentStatus !== 'ANNULE' && <DropdownMenuItem onClick={() => updateStatus('ANNULE')} className="text-red-600"><XCircle className="h-4 w-4 mr-2"/>Annuler la commande</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}