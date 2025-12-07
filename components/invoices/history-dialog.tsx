// Créez ce nouveau fichier : components/invoices/history-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"

// Le type pour un événement de l'historique
type HistoryEvent = {
  id: string;
  created_at: string;
  event_type: string;
  description: string;
}

interface HistoryDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  children: React.ReactNode; // Pour le bouton déclencheur
}

export function HistoryDialog({ invoiceId, invoiceNumber, children }: HistoryDialogProps) {
  const supabase = createClient()
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fonction pour charger l'historique quand la popup s'ouvre
  const fetchHistory = async () => {
    setIsLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('invoice_history')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }) // Les plus récents en premier

    if (error) {
      console.error("Erreur chargement historique:", error)
      setError("Impossible de charger l'historique.")
    } else {
      setHistory(data)
    }
    setIsLoading(false)
  }
  
  const getEventTypeVariant = (eventType: string) => {
    switch (eventType) {
      case 'CREATION': return 'secondary'
      case 'ENVOI': return 'default'
      case 'PAIEMENT': return 'success'
      case 'ANNULATION': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchHistory() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Historique de la facture {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Chronologie des événements pour cette facture.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-96 overflow-y-auto">
          {isLoading && <p className="text-center">Chargement...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
          
          {!isLoading && history.length > 0 && (
            <div className="relative pl-6">
              {/* Ligne de chronologie verticale */}
              <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200"></div>

              {history.map((event) => (
                <div key={event.id} className="relative mb-6">
                  {/* Point sur la ligne de chronologie */}
                  <div className="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full bg-primary"></div>
                  
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                     <Badge variant={getEventTypeVariant(event.event_type)}>{event.event_type}</Badge>
                     <p className="text-sm">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && history.length === 0 && !error && (
            <p className="text-center text-muted-foreground">Aucun événement enregistré pour cette facture.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}