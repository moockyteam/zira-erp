// Fichier : components/returns/return-voucher-form.tsx

"use client"

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle, Trash2, Loader2, AlertCircle } from "lucide-react";

type ReturnLine = { local_id: string; item_id: string; quantity: string; reason: string };

export function ReturnVoucherForm({ companyId, customers, items }: { companyId: string, customers: any[], items: any[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [customerId, setCustomerId] = useState('');
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sourceDocRef, setSourceDocRef] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [lines, setLines] = useState<ReturnLine[]>([{ local_id: crypto.randomUUID(), item_id: '', quantity: '1', reason: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === customerId);
  }, [customerId, customers]);

  const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: '', quantity: '1', reason: '' }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));
  const updateLine = (index: number, field: keyof ReturnLine, value: string) => { const newLines = [...lines]; newLines[index][field] = value; setLines(newLines); };

  const handleSave = async () => {
    if (!customerId || lines.some(l => !l.item_id || !l.quantity)) { setError("Client et articles sont obligatoires."); return; }
    
    setIsLoading(true); setError(null);
    try {
      const prefix = `BR-${new Date().getFullYear()}-`;
      const { data: lastReturn } = await supabase
        .from('return_vouchers')
        .select('return_voucher_number')
        .eq('company_id', companyId)
        .like('return_voucher_number', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      let nextNum = 1;
      if (lastReturn) {
          nextNum = parseInt(lastReturn.return_voucher_number.split('-').pop() || '0') + 1;
      }
      const newVoucherNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

      const { data: newReturn, error: returnError } = await supabase.from('return_vouchers').insert({
        company_id: companyId, customer_id: customerId, return_voucher_number: newVoucherNumber, return_date: returnDate,
        source_document_ref: sourceDocRef, driver_name: driverName, vehicle_registration: vehicleReg,
      }).select('id').single();

      if (returnError) throw returnError;

      const linesPayload = lines.map(line => ({
        return_voucher_id: newReturn.id, item_id: line.item_id, quantity: parseFloat(line.quantity), reason: line.reason
      }));
      
      const { error: linesError } = await supabase.from('return_voucher_lines').insert(linesPayload);
      if (linesError) throw linesError;

      router.push('/dashboard/returns');
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setIsLoading(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informations Générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client..." /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date du Retour *</Label>
              <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
          </div>

          {/* --- BLOC D'INFORMATIONS CLIENT CORRIGÉ --- */}
          {selectedCustomer && (
            <div className="mt-4 p-4 border rounded-md bg-muted text-sm space-y-1">
              <p><span className="font-semibold">Adresse:</span> {selectedCustomer.address || 'N/A'}</p>
              <p><span className="font-semibold">Téléphone:</span> {selectedCustomer.phone_number || 'N/A'}</p>
              <p><span className="font-semibold">Matricule Fiscal:</span> {selectedCustomer.matricule_fiscal || 'N/A'}</p>
            </div>
          )}

          <div className="space-y-2 pt-4">
            <Label>Référence Facture / BL d'origine (Optionnel)</Label>
            <Input value={sourceDocRef} onChange={e => setSourceDocRef(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Articles Retournés</CardTitle></CardHeader>
        <CardContent>
          {lines.map((line, index) => (
            <div key={line.local_id} className="grid grid-cols-12 gap-2 mb-2 items-center">
              <div className="col-span-5"><Select value={line.item_id} onValueChange={v => updateLine(index, 'item_id', v)}><SelectTrigger><SelectValue placeholder="Article..." /></SelectTrigger><SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="col-span-2"><Input type="number" value={line.quantity} onChange={e => updateLine(index, 'quantity', e.target.value)} /></div>
              <div className="col-span-4"><Input value={line.reason} onChange={e => updateLine(index, 'reason', e.target.value)} placeholder="Raison du retour..." /></div>
              <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLine} className="mt-4"><PlusCircle className="h-4 w-4 mr-2" /> Ajouter</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Informations de Transport</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2"><Label>Chauffeur</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Véhicule</Label><Input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} /></div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex justify-end pt-4"><Button onClick={handleSave} disabled={isLoading} size="lg">{isLoading ? "Sauvegarde..." : "Enregistrer le Bon de Retour"}</Button></div>
    </div>
  );
}