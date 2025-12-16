// components/purchase-orders/receipt-dialog.tsx

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Save, Loader2 } from "lucide-react"

type POLine = { 
  item_id: string | null; // L'item_id peut être null pour une description libre
  description: string; 
  quantity: number; 
}
type PO = { 
  id: string; 
  po_number: string;
  company_id: string; 
  supplier_id: string; 
  purchase_order_lines: POLine[] 
}

interface ReceiptDialogProps {
  purchaseOrder: PO | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ReceiptLine = {
  item_id: string | null;
  description: string;
  quantity_ordered: number;
  quantity_received: string;
}

export function ReceiptDialog({ purchaseOrder, isOpen, onOpenChange, onSuccess }: ReceiptDialogProps) {
  const supabase = createClient()
  const [lines, setLines] = useState<ReceiptLine[]>([])
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (purchaseOrder && purchaseOrder.purchase_order_lines) {
      const initialLines = purchaseOrder.purchase_order_lines.map(line => ({
        item_id: line.item_id,
        description: line.description,
        quantity_ordered: line.quantity,
        quantity_received: line.quantity.toString(),
      }))
      setLines(initialLines)
    }
  }, [purchaseOrder])

  const handleQuantityChange = (description: string, value: string) => {
    setLines(lines.map(line => line.description === description ? { ...line, quantity_received: value } : line))
  }

  const handleSave = async () => {
    if (!purchaseOrder) return
    setIsSaving(true)

    try {
      // Étape 1: Créer le Bon de Réception principal
      const { data: numberData } = await supabase.rpc('get_next_receipt_number', { p_company_id: purchaseOrder.company_id })
      const { data: newReceipt, error: receiptError } = await supabase.from("purchase_receipts").insert({
        company_id: purchaseOrder.company_id,
        supplier_id: purchaseOrder.supplier_id,
        purchase_order_id: purchaseOrder.id,
        receipt_number: numberData,
        receipt_date: receiptDate,
      }).select().single()
      if (receiptError) throw receiptError

      // Étape 2: Préparer et VALIDER les lignes à insérer
      const linesToInsert = lines
        .filter(line => parseFloat(line.quantity_received) > 0)
        .map(line => {
          // CORRECTION: On vérifie que item_id n'est pas null
          if (!line.item_id) {
            throw new Error(`L'article "${line.description}" n'est pas lié à un article du stock. Impossible de le réceptionner.`);
          }
          return {
            receipt_id: newReceipt.id,
            item_id: line.item_id,
            description: line.description,
            quantity_received: parseFloat(line.quantity_received),
          };
        });
      
      if (linesToInsert.length > 0) {
        const { error: linesError } = await supabase.from("purchase_receipt_lines").insert(linesToInsert)
        if (linesError) throw linesError
      }

      // Étape 3: Mettre à jour le stock via la fonction RPC
      const { error: rpcError } = await supabase.rpc('process_purchase_receipt', { p_receipt_id: newReceipt.id })
      if (rpcError) throw rpcError

      // Étape 4: Mettre à jour le statut du Bon de Commande d'origine
      const { error: poUpdateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'RECU' })
        .eq('id', purchaseOrder.id)
      if (poUpdateError) throw poUpdateError

      toast.success("Réception enregistrée, stock et statut mis à jour.")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error("Erreur lors de la réception:", { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Réceptionner la Marchandise</DialogTitle>
          <DialogDescription>Pour le Bon de Commande N° {purchaseOrder?.po_number}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label>Date de Réception</Label><Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} /></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="text-right">Qté Commandée</TableHead>
                <TableHead className="text-right w-32">Qté Reçue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => (
                <TableRow key={line.description}>
                  <TableCell>
                    {line.description}
                    {!line.item_id && <p className="text-xs text-destructive">(Cet article n'est pas lié au stock)</p>}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity_ordered}</TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={line.quantity_received}
                      onChange={e => handleQuantityChange(line.description, e.target.value)}
                      className="text-right"
                      // On désactive la saisie si l'article n'est pas lié au stock
                      disabled={!line.item_id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4"/>Valider la Réception
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}