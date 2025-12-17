// Placez ce code dans : components/invoices/invoice-preview-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InvoicePreview } from "./invoice-preview"
import { Eye } from "lucide-react"

interface InvoicePreviewDialogProps {
  invoiceId: string;
  children: React.ReactNode;
}

export function InvoicePreviewDialog({ invoiceId, children }: InvoicePreviewDialogProps) {
  const supabase = createClient()
  const [invoiceData, setInvoiceData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // On ne charge les données que lorsque l'utilisateur clique pour ouvrir la popup
  const fetchInvoiceData = async () => {
    setIsLoading(true)
    // C'est une requête complexe qui récupère la facture ET toutes ses données liées
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        companies(*),
        customers(*),
        invoice_lines(*)
      `)
      .eq('id', invoiceId)
      .single()
    
    if (error) {
      console.error("Erreur chargement facture pour aperçu:", error)
      alert("Impossible de charger les données de la facture.")
    } else {
      setInvoiceData(data)
    }
    setIsLoading(false)
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchInvoiceData() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu de la Facture : {invoiceData?.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-center p-8">Chargement de l'aperçu...</p>}
          {!isLoading && !invoiceData && <p className="text-center p-8 text-red-500">Données non trouvées.</p>}
          <InvoicePreview invoice={invoiceData} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
