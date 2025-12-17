// components/purchase-orders/po-actions.tsx

"use client"

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, CheckCircle, XCircle, Printer, ArrowDownToLine, DollarSign } from "lucide-react";
import Link from "next/link";
import { ReceiptDialog } from "./receipt-dialog";
import { PoPaymentManager } from "./po-payment-manager";

export function PurchaseOrderActions({ poId, currentStatus, onActionSuccess }: any) {
  const supabase = createClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [poData, setPoData] = useState(null);

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success(`Statut mis à jour.`);
      onActionSuccess();
    }
    setIsUpdating(false);
  };

  const handlePrint = () => {
    window.open(`/dashboard/purchase-orders/print/${poId}?print=true`, '_blank');
  };

  const openDialog = async (dialogType: 'receipt' | 'payment') => {
    const { data } = await supabase.from("purchase_orders").select("*, purchase_order_lines(*, items(name))").eq("id", poId).single();
    setPoData(data);
    if (dialogType === 'receipt') setIsReceiptOpen(true);
    if (dialogType === 'payment') setIsPaymentOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isUpdating}><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Imprimer / PDF</DropdownMenuItem>
          {currentStatus === 'BROUILLON' && (
            <Link href={`/dashboard/purchase-orders/${poId}`} passHref>
              <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Modifier</DropdownMenuItem>
            </Link>
          )}
          <DropdownMenuSeparator />
          {currentStatus === 'BROUILLON' && <DropdownMenuItem onClick={() => updateStatus('ENVOYE')}>Marquer Envoyé</DropdownMenuItem>}
          
          {currentStatus === 'ENVOYE' && (
            <DropdownMenuItem onClick={() => openDialog('receipt')}>
              <ArrowDownToLine className="h-4 w-4 mr-2"/>Réceptionner
            </DropdownMenuItem>
          )}

          {(currentStatus === 'ENVOYE' || currentStatus === 'RECU') && (
            <DropdownMenuItem onClick={() => openDialog('payment')}>
              <DollarSign className="h-4 w-4 mr-2 text-green-500"/>Gérer les Paiements
            </DropdownMenuItem>
          )}

          {currentStatus === 'ENVOYE' && <DropdownMenuItem onClick={() => updateStatus('RECU')}><CheckCircle className="h-4 w-4 mr-2"/>Forcer le statut "Reçu"</DropdownMenuItem>}
          {currentStatus !== 'ANNULE' && <DropdownMenuItem onClick={() => updateStatus('ANNULE')} className="text-red-600"><XCircle className="h-4 w-4 mr-2"/>Annuler la commande</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReceiptDialog
        purchaseOrder={poData}
        isOpen={isReceiptOpen}
        onOpenChange={setIsReceiptOpen}
        onSuccess={onActionSuccess}
      />
      <PoPaymentManager
        purchaseOrder={poData}
        isOpen={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        onSuccess={onActionSuccess}
      />
    </>
  );
}
