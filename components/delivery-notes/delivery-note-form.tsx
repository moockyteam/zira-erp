"use client"

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Loader2, AlertCircle, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types (identiques à la facture)
type Company = { id: string; name: string; is_subject_to_fodec: boolean | null };
type Customer = { id: string; name: string; address: string | null }; // Mettez à jour le type Customer pour inclure l'adresse
type Item = { id: string; name: string; sale_price: number | null; reference: string | null; quantity_on_hand: number };
type DnLine = {
  local_id: string; item_id: string | null; description: string; quantity: number;
  unit_price_ht: number; remise_percentage: number; tva_rate: number;
};
const TVA_RATES = [19, 13, 7, 0];
const FODEC_RATE = 0.01;

export function DeliveryNoteForm({ initialData, initialDataSource, companies, customers, items }: {
  initialData: any | null; initialDataSource: { type: 'quote' | 'invoice', data: any } | null;
  companies: Company[]; customers: Customer[]; items: Item[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const isNew = !initialData;

  // États
  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || '');
  const [customerId, setCustomerId] = useState(initialData?.customer_id || '');
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(initialData?.delivery_address || ''); // NOUVEL ÉTAT
  const [deliveryDate, setDeliveryDate] = useState(initialData?.delivery_date || format(new Date(), 'yyyy-MM-dd'));
  const [lines, setLines] = useState<DnLine[]>(initialData?.delivery_note_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [{ local_id: crypto.randomUUID(), item_id: null, description: '', quantity: 1, unit_price_ht: 0, remise_percentage: 0, tva_rate: 19 }]);
  const [escomptePercentage, setEscomptePercentage] = useState(initialData?.escompte_percentage || 0);
  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp || false);
  const [driverName, setDriverName] = useState(initialData?.driver_name || '');
  const [vehicleRegistration, setVehicleRegistration] = useState(initialData?.vehicle_registration || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [sourceDoc, setSourceDoc] = useState({ quote_id: initialData?.quote_id || null, invoice_id: initialData?.invoice_id || null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCompany = useMemo(() => companies.find(c => c.id === companyId), [companyId, companies]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customerId, customers]);
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany]);

  // Pré-remplissage
  useEffect(() => {
    if (initialDataSource && isNew) {
      const { data } = initialDataSource;
      setCompanyId(data.company_id);
      setCustomerId(data.customer_id || '');
      // On récupère l'adresse depuis les données du client associé à la facture/devis
      const customerForAddress = customers.find(c => c.id === data.customer_id);
      setDeliveryAddress(customerForAddress?.address || ''); // Pré-rempli avec l'adresse du client
      setDriverName(data.driver_name || '');
      setVehicleRegistration(data.vehicle_registration || '');
      setEscomptePercentage(data.escompte_percentage || 0);
      setHasStamp(data.has_stamp || false);
      const sourceLines = type === 'quote' ? data.quote_lines : data.invoice_lines;
      const newLines = sourceLines.map((line: any) => ({
        local_id: crypto.randomUUID(), item_id: line.item_id, description: line.description, quantity: line.quantity,
        unit_price_ht: line.unit_price_ht, remise_percentage: line.remise_percentage || 0, tva_rate: line.tva_rate,
      }));
      setLines(newLines);
      if (type === 'quote') setSourceDoc({ quote_id: data.id, invoice_id: null });
      if (type === 'invoice') setSourceDoc({ quote_id: data.quote_id || null, invoice_id: data.id });
    }
  }, [initialDataSource, isNew, customers]);

  // NOUVEAU useEffect pour mettre à jour l'adresse si on change de client
  useEffect(() => {
    // Si on n'est pas en train de pré-remplir depuis une source
    // et que le client sélectionné a une adresse, on met à jour le champ.
    if (!initialDataSource && selectedCustomer) {
      setDeliveryAddress(selectedCustomer.address || '');
    }
  }, [selectedCustomer, initialDataSource]);

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price_ht), 0);
    const total_remise = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price_ht * (line.remise_percentage / 100)), 0);
    const total_ht_net = total_ht_brut - total_remise;
    const total_escompte = total_ht_net * (escomptePercentage / 100);
    const net_commercial = total_ht_net - total_escompte;
    const total_fodec = isFodecApplicable ? net_commercial * FODEC_RATE : 0;
    const base_tva = net_commercial + total_fodec;
    const tva_details = TVA_RATES.map(rate => {
        const base = lines.filter(line => line.tva_rate === rate).reduce((sum, line) => sum + (line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)), 0);
        const base_with_fodec_share = base + (isFodecApplicable ? base * FODEC_RATE : 0);
        const amount = base_with_fodec_share * (rate / 100);
        return { rate, base: base_with_fodec_share, amount };
    });
    const total_tva = tva_details.reduce((sum, detail) => sum + detail.amount, 0);
    const timbre = hasStamp ? 1 : 0;
    const total_ttc = base_tva + total_tva + timbre;
    return { total_ht_net, total_remise, total_escompte, net_commercial, total_fodec, base_tva, tva_details, total_tva, timbre, total_ttc };
  }, [lines, escomptePercentage, isFodecApplicable, hasStamp]);

  const handleLineChange = useCallback((index: number, field: keyof DnLine, value: any) => { const newLines = [...lines]; newLines[index][field] = value; setLines(newLines); }, [lines]);
  const handleItemSelect = useCallback((index: number, itemId: string) => { const item = items.find(i => i.id === itemId); if(item){ const newLines = [...lines]; newLines[index] = {...newLines[index], item_id: itemId, description: `${item.reference ? `[${item.reference}] ` : ''}${item.name}`}; setLines(newLines); }}, [lines, items]);
  const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: null, description: '', quantity: 1, unit_price_ht: 0, remise_percentage: 0, tva_rate: 19 }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!companyId || !customerId) { setError("Veuillez sélectionner une entreprise et un client."); return; }
    if (lines.length === 0 || lines.every(l => !l.description.trim())) { setError("Le BL doit contenir au moins une ligne."); return; }
    
    setIsLoading(true); setError(null);
    try {
      if (isNew) {
        const { data: numberData, error: numberError } = await supabase.functions.invoke('get-next-delivery-note-number', { body: JSON.stringify({ companyId }), headers: { 'Content-Type': 'application/json' }});
        if (numberError) throw new Error("Impossible de générer le numéro de BL. " + numberError.message);

        const dnPayload = {
          company_id: companyId, customer_id: customerId, ...sourceDoc,
          delivery_note_number: numberData.delivery_note_number, delivery_date: deliveryDate,
          delivery_address: deliveryAddress, // ON AJOUTE L'ADRESSE
          driver_name: driverName || null, vehicle_registration: vehicleRegistration || null, notes: notes || null,
          status: 'BROUILLON',
          total_ht: totals.total_ht_net, total_remise: totals.total_remise, escompte_percentage: escomptePercentage,
          total_escompte: totals.total_escompte, total_fodec: totals.total_fodec, total_tva: totals.total_tva,
          has_stamp: hasStamp, total_ttc: totals.total_ttc
        };

        const { data: newDn, error: dnError } = await supabase.from('delivery_notes').insert(dnPayload).select('id').single();
        if (dnError) throw new Error("Erreur lors de la création du BL. " + dnError.message);

        const linesPayload = lines.map(line => ({ 
            delivery_note_id: newDn.id, item_id: line.item_id, description: line.description,
            quantity: line.quantity, unit_price_ht: line.unit_price_ht, 
            remise_percentage: line.remise_percentage, tva_rate: line.tva_rate
        }));
        const { error: linesError } = await supabase.from('delivery_note_lines').insert(linesPayload);
        if (linesError) throw new Error("Erreur lors de l'ajout des lignes au BL. " + linesError.message);
        
        router.push('/dashboard/delivery-notes');
        router.refresh();
      }
    } catch (e: any) { setError(e.message); } finally { setIsLoading(false); }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informations Générales du Bon de Livraison</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-1.5">
              <Label>Client</Label>
              <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}><PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between font-normal">{selectedCustomer ? selectedCustomer.name : "Rechercher un client..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Taper pour rechercher..." /><CommandList><CommandEmpty>Aucun client trouvé.</CommandEmpty><CommandGroup>{customers.map((c) => (<CommandItem key={c.id} value={c.name} onSelect={() => {setCustomerId(c.id); setOpenCustomerPopover(false);}}><Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />{c.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover>
          </div>
          <div className="space-y-1.5">
              <Label htmlFor="deliveryAddress">Adresse de Livraison</Label>
              <Textarea 
                id="deliveryAddress" 
                value={deliveryAddress} 
                onChange={e => setDeliveryAddress(e.target.value)} 
                placeholder="Saisir l'adresse de livraison si différente de l'adresse du client..."
                rows={3}
              />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliveryDate">Date de Livraison / Expédition</Label>
            <Input id="deliveryDate" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Articles à Livrer</CardTitle></CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[35%]">Description / Article</TableHead>
                            <TableHead className="text-right">Qté</TableHead>
                            <TableHead className="text-right">Prix U. HT</TableHead>
                            <TableHead className="text-right">Remise %</TableHead>
                            <TableHead className="text-right">TVA %</TableHead>
                            <TableHead className="text-right">Total HT</TableHead>
                            <TableHead className="text-right">Total TTC</TableHead>
                            <TableHead className="text-center">Act</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line, index) => {
                            const lineTotalHT = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100);
                            const lineTotalTTC = lineTotalHT * (1 + (line.tva_rate / 100));
                            return (
                                <TableRow key={line.local_id}>
                                    <TableCell className="align-top">
                                        <Command><CommandInput placeholder="Saisir ou rechercher..." value={line.description} onValueChange={(v) => handleLineChange(index, 'description', v)} className='border rounded-md' /><CommandList><CommandEmpty>Aucun article trouvé.</CommandEmpty><CommandGroup>{items.filter(i => i.name.toLowerCase().includes(line.description.toLowerCase())).slice(0, 5).map(i => (<CommandItem key={i.id} onSelect={() => handleItemSelect(index, i.id)}>{i.name} <span className="text-xs text-muted-foreground ml-2">(Stock: {i.quantity_on_hand})</span></CommandItem>))}</CommandGroup></CommandList></Command>
                                    </TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.quantity} onChange={e => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.unit_price_ht} onChange={e => handleLineChange(index, 'unit_price_ht', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.remise_percentage} onChange={e => handleLineChange(index, 'remise_percentage', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top">
                                        <Select value={String(line.tva_rate)} onValueChange={v => handleLineChange(index, 'tva_rate', parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TVA_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>
                                    </TableCell>
                                    <TableCell className="align-top font-mono text-right pt-4">{lineTotalHT.toFixed(3)}</TableCell>
                                    <TableCell className="align-top font-mono font-semibold text-right pt-4">{lineTotalTTC.toFixed(3)}</TableCell>
                                    <TableCell className="align-top text-center"><Button variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="p-2 border-t mt-2"><Button variant="outline" size="sm" onClick={addLine}><PlusCircle className="h-4 w-4 mr-2" /> Ajouter une ligne</Button></div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
             <Card>
                <CardHeader><CardTitle>Détails de Transport & Notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><Label htmlFor="driver_name">Nom du chauffeur</Label><Input id="driver_name" value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
                        <div><Label htmlFor="vehicle_registration">Matricule du véhicule</Label><Input id="vehicle_registration" value={vehicleRegistration} onChange={e => setVehicleRegistration(e.target.value)} /></div>
                    </div>
                    <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Détails, conditions de livraison..."/></div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>Récapitulatif TVA</CardTitle></CardHeader>
                <CardContent><Table><TableHeader><TableRow><TableHead>Taux</TableHead><TableHead>Base HT</TableHead><TableHead>Montant TVA</TableHead></TableRow></TableHeader><TableBody>{totals.tva_details.filter(d => d.base > 0).map(d => (<TableRow key={d.rate}><TableCell>{d.rate}%</TableCell><TableCell className="font-mono">{d.base.toFixed(3)}</TableCell><TableCell className="font-mono">{d.amount.toFixed(3)}</TableCell></TableRow>))}</TableBody></Table></CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-4">
             <Card>
                <CardHeader><CardTitle>Totaux</CardTitle></CardHeader>
                <CardContent className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total HT Net</span><span>{totals.total_ht_net.toFixed(3)}</span></div>
                    <div className="flex justify-between items-center"><Label htmlFor="escompte">Escompte (%)</Label><Input id="escompte" type="number" className="w-24 h-8 text-right" value={escomptePercentage} onChange={e => setEscomptePercentage(parseFloat(e.target.value) || 0)} /></div>
                    {isFodecApplicable && <div className="flex justify-between text-blue-600"><span className="font-medium">FODEC (1%)</span><span>+ {totals.total_fodec.toFixed(3)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Total TVA</span><span>+ {totals.total_tva.toFixed(3)}</span></div>
                    <div className="flex justify-between items-center"><Label htmlFor="stamp-switch" className="flex items-center gap-2 cursor-pointer"><Switch id="stamp-switch" checked={hasStamp} onCheckedChange={setHasStamp} /> Timbre Fiscal</Label><span>+ {totals.timbre.toFixed(3)}</span></div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total TTC</span><span>{totals.total_ttc.toFixed(3)} TND</span></div>
                </CardContent>
             </Card>
        </div>
      </div>
      
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex justify-end pt-4"><Button onClick={handleSave} disabled={isLoading} size="lg">{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sauvegarde...</> : "Enregistrer le BL"}</Button></div>
    </div>
  );
}