// components/quotes/quote-actions.tsx

'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Printer, MoreVertical, Send, CheckCircle, XCircle, FilePlus2, Truck, Edit } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { toast } from "sonner"

type QuoteStatus = 'BROUILLON' | 'ENVOYE' | 'CONFIRME' | 'REFUSE';

interface QuoteActionsProps {
  quoteId: string;
  currentStatus: QuoteStatus;
  onStatusChange: (newStatus: QuoteStatus) => void;
}

export function QuoteActions({ quoteId, currentStatus, onStatusChange }: QuoteActionsProps) {
  const supabase = createClient()
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const handlePrint = () => {
    window.open(`/dashboard/quotes/print/${quoteId}?print=true`, '_blank');
  }

  const updateStatus = async (newStatus: 'ENVOYE' | 'CONFIRME' | 'REFUSE') => {
    setIsUpdatingStatus(true);
    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quoteId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du statut.")
    } else {
      toast.success(`Devis marqué comme ${newStatus.toLowerCase()}.`)
      onStatusChange(newStatus);
    }
    setIsUpdatingStatus(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isUpdatingStatus}>
          {isUpdatingStatus ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Imprimer / PDF</DropdownMenuItem>
        
        {currentStatus === 'BROUILLON' && (
          <Link href={`/dashboard/quotes/${quoteId}`} passHref>
            <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Modifier</DropdownMenuItem>
          </Link>
        )}
        
        <DropdownMenuSeparator />
        
        {currentStatus === 'BROUILLON' && (
          <DropdownMenuItem onClick={() => updateStatus('ENVOYE')}><Send className="h-4 w-4 mr-2" /> Marquer comme Envoyé</DropdownMenuItem>
        )}

        {currentStatus === 'ENVOYE' && (
          <>
            <DropdownMenuItem onClick={() => updateStatus('CONFIRME')}><CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Confirmer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus('REFUSE')}><XCircle className="h-4 w-4 mr-2 text-red-600" /> Refuser</DropdownMenuItem>
          </>
        )}

        {currentStatus === 'CONFIRME' && (
          <>
            <Link href={`/dashboard/invoices/new?fromQuote=${quoteId}`}><DropdownMenuItem className="text-blue-600 font-semibold"><FilePlus2 className="h-4 w-4 mr-2" />Créer une Facture</DropdownMenuItem></Link>
            <Link href={`/dashboard/delivery-notes/new?fromQuote=${quoteId}`}><DropdownMenuItem><Truck className="h-4 w-4 mr-2" />Créer un Bon de Livraison</DropdownMenuItem></Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}