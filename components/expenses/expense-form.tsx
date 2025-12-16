"use client"

import { useState, useEffect, useMemo } from "react"; // LA CORRECTION EST ICI
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryCreator } from "@/components/category-creator";
import { Loader2, Save } from "lucide-react";

const TVA_RATES = [19, 13, 7, 0];
const WITHHOLDING_TAX_RATE = 0.015;

export function ExpenseForm({ companies }: { companies: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [companyId, setCompanyId] = useState(searchParams.get("companyId") || companies[0]?.id);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [categoryId, setCategoryId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [tvaBases, setTvaBases] = useState<{ [key: number]: string }>({});
  const [totalAmount, setTotalAmount] = useState("");
  const [hasWithholdingTax, setHasWithholdingTax] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Virement");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDeferredPayment = paymentMethod === 'Chèque' || paymentMethod === 'Traite';

  const { totalHT, totalTVA, totalTTC, withholdingAmount, netToPay, tvaDetails } = useMemo(() => {
    let ht = 0, tva = 0;
    let details: any[] = [];

    if (isVatApplicable) {
      TVA_RATES.forEach(rate => {
        const base = parseFloat(tvaBases[rate]) || 0;
        if (base > 0) {
          const amount = base * (rate / 100);
          ht += base;
          tva += amount;
          details.push({ rate, base, amount });
        }
      });
    } else {
      ht = parseFloat(totalAmount) || 0;
    }

    const ttc = ht + tva;
    const withholding = hasWithholdingTax ? ht * WITHHOLDING_TAX_RATE : 0;
    const net = ttc - withholding;

    return { totalHT: ht, totalTVA: tva, totalTTC: ttc, withholdingAmount: withholding, netToPay: net, tvaDetails: details };
  }, [isVatApplicable, tvaBases, totalAmount, hasWithholdingTax]);

  const fetchCategories = async () => {
    if (companyId) {
      const { data } = await supabase.from("expense_categories").select("*").eq("company_id", companyId);
      setCategories(data || []);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [companyId]);

  const handleSave = async () => {
    setIsSaving(true);
    let attachment_url = null;
    if (attachmentFile) {
      const filePath = `${companyId}/${uuidv4()}`;
      const { error: uploadError } = await supabase.storage.from('expense_attachments').upload(filePath, attachmentFile);
      if (uploadError) { toast.error("Erreur d'upload: " + uploadError.message); setIsSaving(false); return; }
      attachment_url = supabase.storage.from('expense_attachments').getPublicUrl(filePath).data.publicUrl;
    }

    const payload = {
      company_id: companyId, category_id: categoryId || null, beneficiary,
      total_ht: totalHT, total_tva: totalTVA, total_ttc: totalTTC,
      tva_details: isVatApplicable ? tvaDetails : null,
      has_withholding_tax: hasWithholdingTax, withholding_tax_amount: withholdingAmount,
      payment_date: isDeferredPayment ? format(new Date(), "yyyy-MM-dd") : paymentDate, 
      due_date: isDeferredPayment ? dueDate : null,
      payment_method: paymentMethod, reference, status: isDeferredPayment ? 'EN_ATTENTE' : 'PAYE',
      attachment_url, notes,
    };
    const { error } = await supabase.from("expenses").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Dépense enregistrée."); router.push('/dashboard/expenses'); router.refresh(); }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Informations Générales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Catégorie de Dépense</Label>
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choisir..."/></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <CategoryCreator companyId={companyId} tableName="expense_categories" onCategoryCreated={fetchCategories} />
            </div>
          </div>
          <div className="space-y-2"><Label>Bénéficiaire</Label><Input value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="Nom du fournisseur, Trésor Public..."/></div>
          <div className="space-y-2"><Label>Date de la Dépense</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>2. Détail des Montants</CardTitle>
            <div className="flex items-center space-x-2"><Label>Dépense soumise à TVA</Label><Switch checked={isVatApplicable} onCheckedChange={setIsVatApplicable} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {!isVatApplicable ? (
            <div><Label>Montant Total (TTC)</Label><Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} /></div>
          ) : (
            <div className="space-y-2 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium text-sm">Saisir les bases HT par taux de TVA</h4>
              {TVA_RATES.map(rate => (
                <div key={rate} className="grid grid-cols-3 items-center gap-4">
                  <Label>Base HT ({rate}%)</Label>
                  <Input type="number" className="col-span-2" value={tvaBases[rate] || ''} onChange={e => setTvaBases(prev => ({ ...prev, [rate]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Options Fiscales & Paiement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label>Appliquer Retenue à la Source (1.5% sur HT)</Label>
            <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
          </div>
          <div>
            <Label className="font-semibold">Modalités de Paiement</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Traite">Traite</SelectItem>
                </SelectContent>
              </Select>
              {isDeferredPayment ? (
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              ) : (
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              )}
              {isDeferredPayment && <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° Chèque/Traite"/>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Justificatifs & Notes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Pièce Jointe (Facture, Reçu...)</Label><Input type="file" onChange={e => setAttachmentFile(e.target.files ? e.target.files[0] : null)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card className="sticky bottom-0">
        <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <div className="flex justify-between"><span>Total HT</span><span>{totalHT.toFixed(3)}</span></div>
          <div className="flex justify-between"><span>Total TVA</span><span>{totalTVA.toFixed(3)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total TTC</span><span>{totalTTC.toFixed(3)}</span></div>
          {hasWithholdingTax && (
            <>
              <div className="flex justify-between text-red-500"><span>Retenue à la Source</span><span>- {withholdingAmount.toFixed(3)}</span></div>
              <div className="flex justify-between font-bold text-lg text-emerald-600"><span>NET À PAYER</span><span>{netToPay.toFixed(3)} TND</span></div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer la Dépense
        </Button>
      </div>
    </div>
  );
}