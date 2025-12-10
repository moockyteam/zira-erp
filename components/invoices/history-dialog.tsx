///components/invoices/history-dialog:TSX
"use client"

import type React from "react"

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
import { History, Calendar, Clock } from "lucide-react"

// Le type pour un événement de l'historique
type HistoryEvent = {
  id: string
  created_at: string
  event_type: string
  description: string
}

interface HistoryDialogProps {
  invoiceId: string
  invoiceNumber: string
  children: React.ReactNode // Pour le bouton déclencheur
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
      .from("invoice_history")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }) // Les plus récents en premier

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
      case "CREATION":
        return "secondary"
      case "ENVOI":
        return "default"
      case "PAIEMENT":
        return "success"
      case "ANNULATION":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "CREATION":
        return "bg-blue-500"
      case "ENVOI":
        return "bg-purple-500"
      case "PAIEMENT":
        return "bg-emerald-500"
      case "ANNULATION":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) fetchHistory()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <History className="h-5 w-5 text-white" />
            </div>
            Historique de la facture {invoiceNumber}
          </DialogTitle>
          <DialogDescription className="text-base">
            Chronologie complète des événements et actions sur cette facture
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2 -mr-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="ml-3 text-muted-foreground">Chargement de l'historique...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!isLoading && history.length > 0 && (
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 h-full w-1 bg-gradient-to-b from-indigo-500 via-purple-500 to-emerald-500 rounded-full opacity-20"></div>

              {history.map((event, index) => (
                <div key={event.id} className="relative mb-6 last:mb-0">
                  <div
                    className={`absolute left-[-9px] top-2 h-5 w-5 rounded-full ${getEventTypeColor(event.event_type)} ring-4 ring-background shadow-lg`}
                  ></div>

                  <div className="ml-6 bg-gradient-to-br from-background to-muted/30 rounded-xl border-2 border-border p-4 hover:shadow-lg transition-all duration-200 hover:border-primary/50">
                    {/* Date and time header */}
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium">
                          {new Date(event.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">
                          {new Date(event.created_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Event type and description */}
                    <div className="flex items-start gap-3">
                      <Badge
                        variant={getEventTypeVariant(event.event_type)}
                        className="font-semibold text-xs px-3 py-1 shadow-sm"
                      >
                        {event.event_type}
                      </Badge>
                      <p className="text-base text-foreground flex-1 leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && history.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">Aucun événement enregistré</p>
              <p className="text-sm text-muted-foreground mt-1">L'historique de cette facture est vide</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
