// components/delivery-notes/delivery-note-preview-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DeliveryNotePreview } from "./delivery-note-preview"

interface DnPreviewDialogProps {
  dnId: string;
  children: React.ReactNode;
}

export function DeliveryNotePreviewDialog({ dnId, children }: DnPreviewDialogProps) {
  const supabase = createClient()
  const [dnData, setDnData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchDnData = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(`*, companies(*), customers(*), delivery_note_lines(*)`)
      .eq('id', dnId)
      .single()
    
    if (error) {
      console.error("Erreur chargement BL pour aperçu:", error)
      alert("Impossible de charger les données du BL.")
    } else {
      setDnData(data)
    }
    setIsLoading(false)
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchDnData() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu du Bon de Livraison : {dnData?.delivery_note_number}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-center p-8">Chargement...</p>}
          {/* L'aperçu du BL a sa propre logique d'impression et de masquage de prix */}
          <DeliveryNotePreview deliveryNote={dnData} />
        </div>
      </DialogContent>
    </Dialog>
  )
}