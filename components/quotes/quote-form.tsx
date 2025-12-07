// components/quotes/quote-form.tsx 
"use client"

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// UI Components
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

// Icons
import { PlusCircle, Trash2, Loader2, AlertCircle, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPES (mis à jour pour correspondre aux factures) ---
type Company = { id: string; name: string; is_subject_to_fodec: boolean | null };
type Customer = { id: string; name: string; };
type Item = { id: string; name: string; sale_price: number | null; reference: string | null; };

// Type pour les lignes, incluant la remise
type QuoteLine = {
  local_id: string;
  id?: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  remise_percentage: number; 
  tva_rate: number;
};

// --- CONSTANTES ---
const TVA_RATES = [19, 13, 7, 0];
const FODEC_RATE = 0.01; // 1%

interface QuoteFormProps {
  initialData: any | null;
  companies: Company[];
  customers: Customer[];
  items: Item[];
  defaultTerms: string | null;
}

/**
 * @description En-tête du formulaire avec les informations générales alignées
 */
function QuoteFormHeader({ companyId, setCompanyId, customerId, setCustomerId, prospectName, setProspectName, quoteDate, setQuoteDate, companies, customers, isNew }) {
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

  return (
    <div className="p-4 bg-slate-50 border rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Entreprise */}
        <div className="space-y-1.5">
          <Label htmlFor="company">Entreprise</Label>
          <Select value={companyId} onValueChange={setCompanyId} disabled={!isNew}>
            <SelectTrigger id="company"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Client / Prospect (Combobox) */}
        <div className="space-y-1.5">
          <Label>Client / Prospect</Label>
          <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={openCustomerPopover} className="w-full justify-between font-normal">
                {selectedCustomer ? selectedCustomer.name : (prospectName || "Rechercher ou saisir un nom...")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Rechercher un client..." onValueChange={(search) => !selectedCustomer && setProspectName(search)} />
                <CommandList>
                  <CommandEmpty>Aucun client trouvé. Le nom saisi sera utilisé pour un nouveau prospect.</CommandEmpty>
                  <CommandGroup>
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.name}
                        onSelect={() => {
                          setCustomerId(customer.id);
                          setProspectName('');
                          setOpenCustomerPopover(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")} />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Date du devis */}
        <div className="space-y-1.5">
          <Label htmlFor="quoteDate">Date du devis</Label>
          <Input id="quoteDate" type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
        </div>
        {/* Placeholder pour une future date de validité */}
        <div className="space-y-1.5">
            {/* <Label htmlFor="validityDate">Date de validité</Label>
            <Input id="validityDate" type="date" /> */}
        </div>
      </div>
    </div>
  );
}


export function QuoteForm({ initialData, companies, customers, items, defaultTerms }: QuoteFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isNew = !initialData;

  // --- ÉTATS DU FORMULAIRE (mis à jour) ---
  const [companyId, setCompanyId] = useState(initialData?.company_id || searchParams.get('companyId') || companies[0]?.id || '');
  const [customerId, setCustomerId] = useState(initialData?.customer_id || '');
  const [prospectName, setProspectName] = useState(initialData?.prospect_name || ''); // On garde le prospect pour les devis
  const [quoteDate, setQuoteDate] = useState(initialData?.quote_date || new Date().toISOString().split('T')[0]);
  
  // L'état initial des lignes inclut maintenant la remise
  const [lines, setLines] = useState<QuoteLine[]>(initialData?.quote_lines?.map((l:any) => ({ ...l, local_id: crypto.randomUUID(), remise_percentage: l.remise_percentage || 0 })) || [{ local_id: crypto.randomUUID(), item_id: null, description: '', quantity: 1, unit_price_ht: 0, remise_percentage: 0, tva_rate: 19.0 }]);
  
  const [escomptePercentage, setEscomptePercentage] = useState(initialData?.escompte_percentage || 0); // <-- NOUVEAU
  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp || false);
  const [termsAndConditions, setTermsAndConditions] = useState(initialData?.terms_and_conditions || defaultTerms || '');
  const [saveTermsAsDefault, setSaveTermsAsDefault] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- DONNÉES DÉRIVÉES ET CALCULS (logique copiée des factures) ---
  const selectedCompany = useMemo(() => companies.find(c => c.id === companyId), [companyId, companies]);
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany]);

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price_ht), 0);
    const total_remise = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price_ht * (line.remise_percentage / 100)), 0);
    const total_ht = total_ht_brut - total_remise;

    const total_escompte = total_ht * (escomptePercentage / 100);
    const net_commercial = total_ht - total_escompte;
    const total_fodec = isFodecApplicable ? net_commercial * FODEC_RATE : 0;
    const base_tva = net_commercial + total_fodec;

    const tva_details = TVA_RATES.map(rate => {
        const base = lines.filter(l => l.tva_rate === rate).reduce((s, l) => s + (l.quantity * l.unit_price_ht * (1 - l.remise_percentage/100)), 0);
        const base_fodec = base + (isFodecApplicable ? (base * (1 - escomptePercentage / 100)) * FODEC_RATE : 0);
        const amount = base_fodec * (rate / 100);
        return { rate, base: base_fodec, amount };
    });

    const total_tva = tva_details.reduce((sum, detail) => sum + detail.amount, 0);
    const timbre = hasStamp ? 1 : 0;
    const total_ttc = base_tva + total_tva + timbre;

    return { total_ht, total_remise, total_escompte, net_commercial, total_fodec, total_tva, total_ttc, timbre };
  }, [lines, escomptePercentage, isFodecApplicable, hasStamp]);

  // --- GESTION DES LIGNES (inchangée) ---
  const handleLineChange = useCallback((index: number, field: keyof QuoteLine, value: any) => { const newLines = [...lines]; newLines[index][field] = value; setLines(newLines); }, [lines]);
  const handleItemSelect = useCallback((index: number, itemId: string) => { const selectedItem = items.find(item => item.id === itemId); if (selectedItem) { const newLines = [...lines]; const line = { ...newLines[index] }; line.item_id = itemId; line.description = `${selectedItem.reference ? `[${selectedItem.reference}] ` : ''}${selectedItem.name}`; line.unit_price_ht = selectedItem.sale_price || 0; line.quantity = line.quantity || 1; newLines[index] = line; setLines(newLines); } }, [lines, items]);
  const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: null, description: '', quantity: 1, unit_price_ht: 0, remise_percentage: 0, tva_rate: 19.0 }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  // --- SAUVEGARDE (mise à jour pour inclure les nouveaux champs) ---
  const handleSave = async () => {
    if (!companyId) { setError("Veuillez sélectionner une entreprise."); return; }
    if (!customerId && !prospectName.trim()) { setError("Veuillez sélectionner un client ou saisir le nom d'un prospect."); return; }
    if (lines.length === 0 || lines.every(l => !l.description.trim())) { setError("Le devis doit contenir au moins une ligne."); return; }

    setIsLoading(true); setError(null);

    if (saveTermsAsDefault) {
      const { error: defaultTermsError } = await supabase
        .from('company_defaults')
        .upsert({ company_id: companyId, default_quote_terms: termsAndConditions });

      if (defaultTermsError) {
        setError("Erreur lors de la sauvegarde des conditions par défaut.");
        setIsLoading(false);
        return;
      }
    }

    const quotePayload = {
      company_id: companyId,
      customer_id: customerId || null,
      prospect_name: customerId ? null : prospectName,
      quote_date: quoteDate,
      total_ht: totals.total_ht,
      total_remise: totals.total_remise,
      escompte_percentage: escomptePercentage,
      total_escompte: totals.total_escompte,
      total_fodec: totals.total_fodec,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      has_stamp: hasStamp,
      status: initialData?.status || 'BROUILLON',
      terms_and_conditions: termsAndConditions,
    };
    
    if (isNew) {
      const { data: newQuote, error: quoteError } = await supabase.from('quotes').insert(quotePayload).select('id').single();
      if (quoteError) { setIsLoading(false); setError("Erreur création devis: " + quoteError.message); return; }

      // --- CORRECTION: On ajoute line_total_ht au payload ---
      const linesPayload = lines.map(line => ({
        quote_id: newQuote.id,
        item_id: line.item_id,
        description: line.description,
        quantity: line.quantity,
        unit_price_ht: line.unit_price_ht,
        remise_percentage: line.remise_percentage,
        tva_rate: line.tva_rate,
        // On calcule et on ajoute le champ manquant
        line_total_ht: (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100)
      }));

      const { error: linesError } = await supabase.from('quote_lines').insert(linesPayload);
      if (linesError) { setError("Erreur ajout lignes: " + linesError.message); } else { router.push(`/dashboard/quotes`); router.refresh(); }

    } else {
      const { error: quoteUpdateError } = await supabase.from('quotes').update(quotePayload).eq('id', initialData.id);
      if (quoteUpdateError) { setIsLoading(false); setError("Erreur MàJ devis: " + quoteUpdateError.message); return; }

      const { error: deleteError } = await supabase.from('quote_lines').delete().eq('quote_id', initialData.id);
      if (deleteError) { setIsLoading(false); setError("Erreur suppression anciennes lignes: " + deleteError.message); return; }

      if (lines.length > 0) {
        // --- CORRECTION: On ajoute aussi line_total_ht ici pour la mise à jour ---
        const linesPayload = lines.map(line => ({
            quote_id: initialData.id, 
            item_id: line.item_id, 
            description: line.description, 
            quantity: line.quantity,
            unit_price_ht: line.unit_price_ht, 
            remise_percentage: line.remise_percentage, 
            tva_rate: line.tva_rate,
            // On calcule et on ajoute le champ manquant
            line_total_ht: (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100)
        }));
        const { error: linesInsertError } = await supabase.from('quote_lines').insert(linesPayload);
        if (linesInsertError) { setError("Erreur insertion nouvelles lignes: " + linesInsertError.message); }
      }
      router.push(`/dashboard/quotes`); router.refresh();
    }
    
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <QuoteFormHeader
        companyId={companyId} setCompanyId={setCompanyId}
        customerId={customerId} setCustomerId={setCustomerId}
        prospectName={prospectName} setProspectName={setProspectName}
        quoteDate={quoteDate} setQuoteDate={setQuoteDate}
        companies={companies} customers={customers} isNew={isNew}
      />
      
      {/* --- TABLEAU DES LIGNES (mis à jour) --- */}
      <Card>
        <CardHeader><CardTitle>Contenu du Devis</CardTitle></CardHeader>
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
                                <TableRow key={line.local_id} className="group">
                                    <TableCell className="align-top">
                                        <Command>
                                            <CommandInput placeholder="Saisir ou rechercher..." value={line.description} onValueChange={(v) => handleLineChange(index, 'description', v)} className='border rounded-md' />
                                            <CommandList><CommandEmpty>Aucun article trouvé.</CommandEmpty><CommandGroup>
                                                {items.filter(i => i.name.toLowerCase().includes(line.description.toLowerCase())).slice(0, 5).map(i => (
                                                    <CommandItem key={i.id} onSelect={() => handleItemSelect(index, i.id)}>{i.name}</CommandItem>
                                                ))}
                                            </CommandGroup></CommandList>
                                        </Command>
                                    </TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.quantity} onChange={e => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.unit_price_ht} onChange={e => handleLineChange(index, 'unit_price_ht', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top"><Input type="number" value={line.remise_percentage} onChange={e => handleLineChange(index, 'remise_percentage', parseFloat(e.target.value) || 0)} className="text-right" /></TableCell>
                                    <TableCell className="align-top">
                                        <Select value={String(line.tva_rate)} onValueChange={v => handleLineChange(index, 'tva_rate', parseFloat(v))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{TVA_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                                        </Select>
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
      
      {/* --- PIED DE PAGE (mis à jour) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-2">
            <Label htmlFor="terms">Notes et Conditions de Vente</Label>
            <Textarea id="terms" value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={6} placeholder="Ex: Paiement à 30 jours..."/>
            <div className="flex items-center space-x-2 pt-2">
                <Switch id="save-terms" checked={saveTermsAsDefault} onCheckedChange={setSaveTermsAsDefault} />
                <Label htmlFor="save-terms" className="text-sm font-normal text-muted-foreground">
                    Enregistrer comme conditions par défaut pour les prochains devis
                </Label>
            </div>
        </div>

        <div className="space-y-4">
             <Card>
                <CardHeader><CardTitle>Totaux</CardTitle></CardHeader>
                <CardContent className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span>{totals.total_ht.toFixed(3)} TND</span></div>
                    <div className="flex justify-between items-center">
                        <Label htmlFor="escompte">Escompte (%)</Label>
                        <Input id="escompte" type="number" className="w-24 h-8 text-right" value={escomptePercentage} onChange={e => setEscomptePercentage(parseFloat(e.target.value) || 0)} />
                    </div>
                    {isFodecApplicable && <div className="flex justify-between text-blue-600"><span className="font-medium">FODEC (1%)</span><span>+ {totals.total_fodec.toFixed(3)} TND</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Total TVA</span><span>+ {totals.total_tva.toFixed(3)} TND</span></div>
                    <div className="flex justify-between items-center">
                        <Label htmlFor="stamp-switch" className="flex items-center gap-2 cursor-pointer"><Switch id="stamp-switch" checked={hasStamp} onCheckedChange={setHasStamp} /> Timbre Fiscal</Label>
                        <span>+ {totals.timbre.toFixed(3)} TND</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Total TTC</span><span>{totals.total_ttc.toFixed(3)} TND</span>
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>
      
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading} size="lg">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sauvegarde...</> : isNew ? "Enregistrer le Devis" : "Mettre à jour le Devis"}
        </Button>
      </div>
    </div>
  );
}