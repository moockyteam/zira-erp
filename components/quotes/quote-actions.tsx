// Placez ce code dans : components/quotes/quote-actions.tsx

'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
// --- CORRECTION : Suppression des imports inutiles, ajout de Truck ---
import { Eye, Printer, MoreVertical, Send, CheckCircle, XCircle, FilePlus2, Truck } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { QuotePreview } from "./quote-preview"
// --- Les imports de PaymentDialog, InvoicePreviewDialog, HistoryDialog ont été supprimés car inutiles ici ---

type QuoteStatus = 'BROUILLON' | 'ENVOYE' | 'CONFIRME' | 'REFUSE';

interface QuoteActionsProps {
  quoteId: string;
  currentStatus: QuoteStatus;
  onStatusChange: (newStatus: QuoteStatus) => void;
}

export function QuoteActions({ quoteId, currentStatus, onStatusChange }: QuoteActionsProps) {
  const supabase = createClient()
  const [quoteData, setQuoteData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const fetchQuoteData = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('quotes')
      .select(`*, companies(*), customers(*), quote_lines(*, items(reference))`)
      .eq('id', quoteId)
      .single()
    setQuoteData(data)
    setIsLoading(false)
  }

  const handlePrint = () => {
    window.open(`/dashboard/quotes/print/${quoteId}?print=true`, '_blank');
  }

  const updateStatus = async (newStatus: 'ENVOYE' | 'CONFIRME' | 'REFUSE') => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quoteId);

    if (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Une erreur est survenue.");
    } else {
      onStatusChange(newStatus);
    }
    setIsUpdatingStatus(false);
  };

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchQuoteData() }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isUpdatingStatus}>
            {isUpdatingStatus ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DialogTrigger asChild>
            <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Aperçu</DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Imprimer / PDF</DropdownMenuItem>
          {currentStatus === 'BROUILLON' && <Link href={`/dashboard/quotes/${quoteId}`} passHref><DropdownMenuItem>Modifier</DropdownMenuItem></Link>}
          
          <DropdownMenuSeparator />
          
          {currentStatus === 'BROUILLON' && (
            <DropdownMenuItem onClick={() => updateStatus('ENVOYE')}>
              <Send className="h-4 w-4 mr-2" /> Marquer comme Envoyé
            </DropdownMenuItem>
          )}

          {currentStatus === 'ENVOYE' && (
            <>
              <DropdownMenuItem onClick={() => updateStatus('CONFIRME')}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Confirmer le devis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('REFUSE')}>
                <XCircle className="h-4 w-4 mr-2 text-red-600" /> Refuser le devis
              </DropdownMenuItem>
            </>
          )}

          {currentStatus === 'CONFIRME' && (
            <>
              <Link href={`/dashboard/invoices/new?fromQuote=${quoteId}`}>
                <DropdownMenuItem className="text-blue-600 font-semibold">
                  <FilePlus2 className="h-4 w-4 mr-2" />
                  Créer une Facture
                </DropdownMenuItem>
              </Link>
              <Link href={`/dashboard/delivery-notes/new?fromQuote=${quoteId}`}>
                <DropdownMenuItem>
                  <Truck className="h-4 w-4 mr-2" />
                  Créer un Bon de Livraison
                </DropdownMenuItem>
              </Link>
            </>
          )}

        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu du Devis : {quoteData?.quote_number}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-center p-8">Chargement...</p>}
          <QuotePreview quote={quoteData} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Lancer l'impression
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}