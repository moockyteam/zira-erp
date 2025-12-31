// components/invoices/invoice-actions.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { toast } from "sonner" // NOUVEAU: Pour des notifications plus propres
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// NOUVEAU: Ajout de l'icône 'Archive'
import {
  MoreHorizontal,
  Edit,
  Send,
  DollarSign,
  Ban,
  Trash2,
  Printer,
  History,
  Truck,
  Archive,
  Globe,
} from "lucide-react"
import { PaymentDialog } from "./payment-dialog"
import { HistoryDialog } from "./history-dialog"
import { LANGUAGES } from "@/lib/translations"

type InvoiceStatus = "BROUILLON" | "ENVOYE" | "PAYEE" | "PARTIELLEMENT_PAYEE" | "ANNULEE"
type Invoice = {
  id: string
  status: InvoiceStatus
  invoice_number: string
  amount_due: number
}

interface InvoiceActionsProps {
  invoice: Invoice
  onActionSuccess: () => void
}

export function InvoiceActions({ invoice, onActionSuccess }: InvoiceActionsProps) {
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateStatus = async (newStatus: InvoiceStatus) => {
    // Logic spécial pour l'annulation
    if (newStatus === "ANNULEE") {
      if (!window.confirm("Êtes-vous sûr de vouloir annuler cette facture ? Cela remettra automatiquement les articles en stock.")) {
        return
      }
    }

    setIsUpdating(true)

    // 1. Mettre à jour le statut
    const { error: statusError } = await supabase.from("invoices").update({ status: newStatus }).eq("id", invoice.id)

    if (statusError) {
      toast.error("Erreur lors de la mise à jour: " + statusError.message)
      setIsUpdating(false)
      return
    }

    // 2. Si Annulation réussie, restaurer le stock
    if (newStatus === "ANNULEE") {
      const { error: stockError } = await supabase.rpc("restore_stock_from_invoice", { p_invoice_id: invoice.id })
      if (stockError) {
        toast.error("Statut mis à jour mais erreur lors du retour en stock : " + stockError.message)
      } else {
        toast.success("Facture annulée et stock restauré avec succès.")
      }
    } else {
      toast.success(`Facture marquée comme ${newStatus}.`)
    }

    onActionSuccess()
    setIsUpdating(false)
  }

  const handleDelete = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette facture brouillon ?")) {
      setIsUpdating(true)
      const { error } = await supabase.from("invoices").delete().eq("id", invoice.id)
      if (error) {
        toast.error("Erreur lors de la suppression: " + error.message)
      } else {
        toast.success("Facture supprimée.")
        onActionSuccess()
      }
      setIsUpdating(false)
    }
  }

  // NOUVEAU: La fonction pour appeler la déduction de stock
  const deductStock = async () => {
    if (!window.confirm("Confirmez-vous la déduction des quantités du stock ? Cette action est irréversible.")) {
      return
    }
    setIsUpdating(true)
    const { error } = await supabase.rpc("deduct_stock_from_invoice", { p_invoice_id: invoice.id })
    if (error) {
      toast.error("Erreur lors de la déduction du stock: " + error.message)
    } else {
      toast.success("Stock mis à jour avec succès.")
      onActionSuccess() // Pour rafraîchir l'historique et potentiellement d'autres données
    }
    setIsUpdating(false)
  }

  const handlePrint = () => {
    window.open(`/dashboard/invoices/print/${invoice.id}?print=true`, "_blank")
  }

  const handlePrintWithLanguage = (language: string) => {
    window.open(`/dashboard/invoices/print/${invoice.id}?print=true&lang=${language}`, "_blank")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating}>
          <span className="sr-only">Ouvrir le menu</span>
          {isUpdating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>

        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Télécharger en :</DropdownMenuLabel>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => handlePrintWithLanguage(lang.code)}>
            <Globe className="mr-2 h-4 w-4" /> {lang.flag} {lang.label}
          </DropdownMenuItem>
        ))}

        <HistoryDialog invoiceId={invoice.id} invoiceNumber={invoice.invoice_number}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <History className="mr-2 h-4 w-4" /> Voir l'historique
          </DropdownMenuItem>
        </HistoryDialog>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => {
          if (invoice.status === "ENVOYE" || invoice.status === "PAYEE" || invoice.status === "PARTIELLEMENT_PAYEE") {
            if (window.confirm("Attention : Modifier une facture finalisée peut causer des incohérences comptables. Voulez-vous continuer ?")) {
              window.location.href = `/dashboard/invoices/${invoice.id}`
            }
          } else {
            window.location.href = `/dashboard/invoices/${invoice.id}`
          }
        }}>
          <Edit className="mr-2 h-4 w-4" /> Modifier
        </DropdownMenuItem>

        {invoice.status === "BROUILLON" && (
          <>
            <DropdownMenuItem onClick={() => updateStatus("ENVOYE")}>
              <Send className="mr-2 h-4 w-4 text-blue-500" /> Marquer comme Envoyée
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </>
        )}

        {(invoice.status === "ENVOYE" || invoice.status === "PARTIELLEMENT_PAYEE" || invoice.status === "PAYEE") && (
          <>
            {/* NOUVEAU: Le bouton "Déduire du Stock" est maintenant ici */}
            <DropdownMenuItem onClick={deductStock}>
              <Archive className="mr-2 h-4 w-4 text-purple-500" /> Déduire du Stock
            </DropdownMenuItem>

            {/* <PaymentDialog
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              amountDue={invoice.amount_due}
              onPaymentSuccess={onActionSuccess}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <DollarSign className="mr-2 h-4 w-4 text-green-600" /> Enregistrer un paiement
              </DropdownMenuItem>
            </PaymentDialog> */}

            <Link href={`/dashboard/delivery-notes/new?fromInvoice=${invoice.id}`}>
              <DropdownMenuItem>
                <Truck className="mr-2 h-4 w-4" />
                Créer un Bon de Livraison
              </DropdownMenuItem>
            </Link>

            <DropdownMenuItem onClick={() => updateStatus("ANNULEE")}>
              <Ban className="mr-2 h-4 w-4 text-yellow-600" /> Annuler la facture
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
