// components/purchase-orders/po-payment-manager.tsx

"use client"

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, Loader2, Wand2 } from "lucide-react";

export function PoPaymentManager({ isOpen, onOpenChange, purchaseOrder, onSuccess }: any) {
  const supabase = createClient();
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // États pour le mode Manuel
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Chèque");
  const [reference, setReference] = useState("");

  // États pour le Générateur Automatique
  const [genTotalAmount, setGenTotalAmount] = useState("");
  const [genCount, setGenCount] = useState("3");
  const [genStartDate, setGenStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [genInterval, setGenInterval] = useState("30");

  useEffect(() => {
    if (isOpen && purchaseOrder?.id) {
      fetchPayments();
    }
  }, [isOpen, purchaseOrder]);

  const fetchPayments = async () => {
    if (!purchaseOrder?.id) return;
    setIsLoading(true);
    // CORRECTION: On lit depuis la table 'expenses'
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("purchase_order_id", purchaseOrder.id)
      .order('due_date', { ascending: true });
      
    if (error) toast.error("Impossible de charger les paiements : " + error.message);
    setPayments(data || []);
    setIsLoading(false);
  };

  // CORRECTION: Le montant est dans 'total_ttc' maintenant
  const totalPaidOrPending = payments.reduce((sum, p) => sum + parseFloat(p.total_ttc), 0);
  const amountDue = (purchaseOrder?.total_ttc || 0) - totalPaidOrPending;

  // Fonction pour enregistrer une dépense (remplace savePayment)
  const saveExpense = async (payload: any) => {
    return await supabase.from("expenses").insert(payload);
  };

  const handleAddManual = async () => {
    setIsSaving(true);
    const total_ttc = parseFloat(amount);
    const payload = {
      company_id: purchaseOrder.company_id,
      supplier_id: purchaseOrder.supplier_id,
      purchase_order_id: purchaseOrder.id,
      beneficiary: (await supabase.from('suppliers').select('name').eq('id', purchaseOrder.supplier_id).single()).data?.name || 'N/A',
      total_ht: 0, // Simplifié pour le paiement, le détail est sur le BC
      total_tva: 0,
      total_ttc: total_ttc,
      payment_date: paymentDate,
      due_date: (paymentMethod === 'Chèque' || paymentMethod === 'Traite') ? dueDate : null,
      payment_method: paymentMethod,
      reference: reference,
      status: (paymentMethod === 'Chèque' || paymentMethod === 'Traite') ? 'EN_ATTENTE' : 'PAYE',
      notes: `Paiement pour BC ${purchaseOrder.po_number}`,
    };
    const { error } = await saveExpense(payload);
    if (error) toast.error(error.message);
    else { toast.success("Paiement ajouté."); setAmount(""); setReference(""); fetchPayments(); }
    setIsSaving(false);
  };

  const handleGenerateAuto = async () => {
    const totalToGen = parseFloat(genTotalAmount) || amountDue;
    const count = parseInt(genCount);
    const interval = parseInt(genInterval);
    
    if (totalToGen <= 0 || count <= 0) {
      toast.error("Veuillez saisir des paramètres valides.");
      return;
    }

    setIsSaving(true);
    const partAmount = Math.floor((totalToGen / count) * 1000) / 1000;
    const lastPartAmount = parseFloat((totalToGen - (partAmount * (count - 1))).toFixed(3));

    try {
      for (let i = 0; i < count; i++) {
        const currentPartAmount = (i === count - 1) ? lastPartAmount : partAmount;
        const currentDueDate = format(addDays(new Date(genStartDate), i * interval), "yyyy-MM-dd");
        
        const payload = {
          company_id: purchaseOrder.company_id,
          supplier_id: purchaseOrder.supplier_id,
          purchase_order_id: purchaseOrder.id,
          beneficiary: (await supabase.from('suppliers').select('name').eq('id', purchaseOrder.supplier_id).single()).data?.name || 'N/A',
          total_ht: 0,
          total_tva: 0,
          total_ttc: currentPartAmount,
          payment_date: format(new Date(), "yyyy-MM-dd"),
          due_date: currentDueDate,
          payment_method: "Chèque",
          reference: `Échéance ${i+1}/${count}`,
          status: 'EN_ATTENTE',
          notes: `Paiement pour BC ${purchaseOrder.po_number}`,
        };
        const { error } = await saveExpense(payload);
        if (error) throw error;
      }
      toast.success(`${count} échéances générées avec succès.`);
      fetchPayments();
    } catch (error: any) {
      toast.error("Erreur lors de la génération: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (window.confirm("Supprimer ?")) {
      await supabase.from("expenses").delete().eq("id", paymentId);
      fetchPayments();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestion des Échéances - BC {purchaseOrder?.po_number}</DialogTitle>
          <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-muted rounded-lg border">
            <div className="text-center"><p className="text-xs text-muted-foreground uppercase">Total</p><p className="font-bold">{purchaseOrder?.total_ttc.toFixed(3)}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground uppercase">Planifié/Payé</p><p className="font-bold text-emerald-600">{totalPaidOrPending.toFixed(3)}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground uppercase">Reste</p><p className="font-bold text-destructive">{amountDue.toFixed(3)}</p></div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="list" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Liste ({payments.length})</TabsTrigger>
            <TabsTrigger value="manual">Saisie Manuelle</TabsTrigger>
            <TabsTrigger value="auto" className="text-indigo-600 font-bold"><Wand2 className="h-4 w-4 mr-2"/>Générateur Auto</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.due_date || p.payment_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>
                    <TableCell className="text-xs">{p.reference}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{parseFloat(p.total_ttc).toFixed(3)}</TableCell>
                    <TableCell><Badge variant={p.status === 'EN_ATTENTE' ? 'outline' : 'success'}>{p.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDeletePayment(p.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 py-4 border p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Montant (TTC)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={amountDue.toFixed(3)}/></div>
              <div className="space-y-2"><Label>Méthode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                    <SelectItem value="Traite">Traite</SelectItem>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date d'échéance / Paiement</Label><Input type="date" value={dueDate || paymentDate} onChange={e => (paymentMethod === 'Chèque' || paymentMethod === 'Traite') ? setDueDate(e.target.value) : setPaymentDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Référence</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° Chèque, etc."/></div>
            </div>
            <Button onClick={handleAddManual} disabled={isSaving} className="w-full">Ajouter cette échéance</Button>
          </TabsContent>

          <TabsContent value="auto" className="space-y-4 py-4 border-2 border-indigo-100 p-4 rounded-lg bg-indigo-50/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Montant Total à diviser</Label><Input type="number" value={genTotalAmount} onChange={e => setGenTotalAmount(e.target.value)} placeholder={amountDue.toFixed(3)}/></div>
              <div className="space-y-2"><Label>Nombre d'échéances</Label><Input type="number" value={genCount} onChange={e => setGenCount(e.target.value)} /></div>
              <div className="space-y-2"><Label>Date de la 1ère échéance</Label><Input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Intervalle entre échéances (jours)</Label><Input type="number" value={genInterval} onChange={e => setGenInterval(e.target.value)} /></div>
            </div>
            <div className="bg-white p-3 rounded border text-sm text-indigo-700">
              💡 Cela va créer <strong>{genCount || 0}</strong> paiements de <strong>{genTotalAmount && genCount ? (parseFloat(genTotalAmount) / parseInt(genCount)).toFixed(3) : 0} TND</strong> en mode Chèque.
            </div>
            <Button onClick={handleGenerateAuto} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
              Générer l'échéancier automatiquement
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => { onSuccess(); onOpenChange(false); }}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}