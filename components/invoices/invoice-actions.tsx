// components/invoices/invoice-actions.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// --- MODIFIÉ: 'Eye' a été supprimé des imports ---
import { MoreHorizontal, Edit, Send, DollarSign, Ban, Trash2, Printer, History, Truck } from "lucide-react"
import { PaymentDialog } from "./payment-dialog"
// --- MODIFIÉ: 'InvoicePreviewDialog' a été supprimé des imports ---
import { HistoryDialog } from "./history-dialog"

type InvoiceStatus = 'BROUILLON' | 'ENVOYE' | 'PAYEE' | 'PARTIELLEMENT_PAYEE' | 'ANNULEE';
type Invoice = {
  id: string;
  status: InvoiceStatus;
  invoice_number: string;
  amount_due: number;
}

interface InvoiceActionsProps {
  invoice: Invoice;
  onActionSuccess: () => void;
}

export function InvoiceActions({ invoice, onActionSuccess }: InvoiceActionsProps) {
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateStatus = async (newStatus: InvoiceStatus) => {
    setIsUpdating(true)
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id)
    if (error) {
      alert("Erreur lors de la mise à jour du statut: " + error.message)
    } else {
      onActionSuccess()
    }
    setIsUpdating(false)
  }

  const handleDelete = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette facture brouillon ?")) {
      setIsUpdating(true)
      const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
      if (error) {
        alert("Erreur lors de la suppression: " + error.message)
      } else {
        onActionSuccess()
      }
      setIsUpdating(false)
    }
  }

  const handlePrint = () => {
    window.open(`/dashboard/invoices/print/${invoice.id}?print=true`, '_blank');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating}>
          <span className="sr-only">Ouvrir le menu</span>
          {isUpdating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        
        {/* --- SUPPRIMÉ: Le bloc <InvoicePreviewDialog> a été entièrement retiré --- */}

        <DropdownMenuItem onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
        </DropdownMenuItem>
        
        <HistoryDialog 
            invoiceId={invoice.id} 
            invoiceNumber={invoice.invoice_number}
        >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <History className="mr-2 h-4 w-4" /> Voir l'historique
            </DropdownMenuItem>
        </HistoryDialog>

        <DropdownMenuSeparator />

        {invoice.status === 'BROUILLON' && (
          <>
            <Link href={`/dashboard/invoices/${invoice.id}`}>
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" /> Modifier
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem onClick={() => updateStatus('ENVOYE')}>
              <Send className="mr-2 h-4 w-4 text-blue-500" /> Marquer comme Envoyée
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </>
        )}

        {(invoice.status === 'ENVOYE' || invoice.status === 'PARTIELLEMENT_PAYEE') && (
          <>
            <PaymentDialog
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              amountDue={invoice.amount_due}
              onPaymentSuccess={onActionSuccess} // Corrigé pour correspondre à la prop
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <DollarSign className="mr-2 h-4 w-4 text-green-600" /> Enregistrer un paiement
              </DropdownMenuItem>
            </PaymentDialog>
            
            <Link href={`/dashboard/delivery-notes/new?fromInvoice=${invoice.id}`}>
              <DropdownMenuItem>
                <Truck className="mr-2 h-4 w-4" />
                Créer un Bon de Livraison
              </DropdownMenuItem>
            </Link>
            
            <DropdownMenuItem onClick={() => updateStatus('ANNULEE')}>
              <Ban className="mr-2 h-4 w-4 text-yellow-600" /> Annuler la facture
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}