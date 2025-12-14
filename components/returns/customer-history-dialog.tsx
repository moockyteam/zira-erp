// components/returns/customer-history-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { History } from "lucide-react"

type Doc = { document_type: string; document_number: string; document_date: string }

export function CustomerHistoryDialog({ customerId, onSelect }: { customerId: string; onSelect: (docNumber: string) => void }) {
  const supabase = createClient()
  const [docs, setDocs] = useState<Doc[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // CORRECTION: On fait les deux appels séparément
  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const [invoicesRes, deliveryNotesRes] = await Promise.all([
        supabase.from('invoices').select('invoice_number, invoice_date').eq('customer_id', customerId),
        supabase.from('delivery_notes').select('delivery_note_number, delivery_date').eq('customer_id', customerId)
      ])

      if (invoicesRes.error) throw invoicesRes.error
      if (deliveryNotesRes.error) throw deliveryNotesRes.error

      const invoices = (invoicesRes.data || []).map(inv => ({
        document_type: 'Facture',
        document_number: inv.invoice_number,
        document_date: inv.invoice_date,
      }))

      const deliveryNotes = (deliveryNotesRes.data || []).map(dn => ({
        document_type: 'Bon de Livraison',
        document_number: dn.delivery_note_number,
        document_date: dn.delivery_date,
      }))

      // On combine et on trie les résultats en JavaScript
      const combinedDocs = [...invoices, ...deliveryNotes]
      combinedDocs.sort((a, b) => new Date(b.document_date).getTime() - new Date(a.document_date).getTime())
      
      setDocs(combinedDocs)

    } catch (error: any) {
      toast.error("Impossible de charger l'historique.", { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchHistory() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Voir l'historique du client">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Historique des Documents du Client</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? <p className="text-center p-4">Chargement...</p> : docs.length === 0 ? (
            <p className="text-center text-muted-foreground p-4">Aucun document trouvé pour ce client.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map(doc => (
                <li key={doc.document_number} className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                  <div>
                    <span className="font-semibold">{doc.document_number}</span>
                    <span className="text-xs text-muted-foreground ml-2">({doc.document_type})</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => onSelect(doc.document_number)}>
                    Sélectionner
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}