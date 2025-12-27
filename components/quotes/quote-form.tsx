"use client"

import { Button } from "@/components/ui/button"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Package, Plus, ChevronsUpDown, Check, Trash2, Receipt, Building2, Users, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string; is_subject_to_fodec: boolean | null }
type Customer = { id: string; name: string; is_subject_to_vat: boolean | null }
type Item = { id: string; name: string; sale_price: number | null; reference: string | null }
type QuoteLine = {
  local_id: string
  id?: string
  item_id: string | null
  description: string
  quantity: number | string
  unit_price_ht: number | string
  remise_percentage: number | string
  tva_rate: number
}

const TVA_RATES = [19, 13, 7, 0]
const FODEC_RATE = 0.01

const CURRENCIES = [
  { code: "TND", symbol: "TND", label: "Dinar Tunisien" },
  { code: "USD", symbol: "$", label: "Dollar US" },
  { code: "EUR", symbol: "€", label: "Euro" },
]

interface QuoteFormProps {
  initialData: any | null
  companies: Company[]
  customers: Customer[]
  items: Item[]
  defaultTerms: string | null
}

import { useCompany } from "@/components/providers/company-provider" // Add import

export function QuoteForm({ initialData, companies, customers, items, defaultTerms }: QuoteFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { selectedCompany: globalSelectedCompany } = useCompany() // Rename to avoid conflict
  const isNew = !initialData

  // Init companyId with initialData if exists (edit mode), otherwise use global context
  // But if it's new, we want it to be responsive to context changes?
  // Actually, if we are in "New Quote" mode, we usually want to use the currently selected company.
  // And if the user switches company in sidebar, the form should probably update IF it hasn't been saved yet.

  const [companyId, setCompanyId] = useState(initialData?.company_id || "")

  // Effect to sync with sidebar selection ONLY if creating new
  useEffect(() => {
    if (isNew && globalSelectedCompany) {
      setCompanyId(globalSelectedCompany.id)
    }
  }, [isNew, globalSelectedCompany])


  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [quoteDate, setQuoteDate] = useState(initialData?.quote_date || "")

  useEffect(() => {
    if (isNew && !quoteDate) {
      setQuoteDate(new Date().toISOString().split("T")[0])
    }
  }, [isNew, quoteDate])

  const [currency, setCurrency] = useState(initialData?.currency || "TND")

  const [prospectName, setProspectName] = useState(initialData?.prospect_name || "")
  const [prospectAddress, setProspectAddress] = useState(initialData?.prospect_address || "")
  const [prospectEmail, setProspectEmail] = useState(initialData?.prospect_email || "")
  const [prospectPhone, setProspectPhone] = useState(initialData?.prospect_phone || "")

  const [lines, setLines] = useState<QuoteLine[]>(
    initialData?.quote_lines?.map((l: any) => ({ ...l, local_id: l.id || crypto.randomUUID() })) || [],
  )

  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp ?? true)
  const [showRemise, setShowRemise] = useState(initialData?.show_remise_column ?? true)

  const [termsAndConditions, setTermsAndConditions] = useState(initialData?.terms_and_conditions || defaultTerms || "")
  const [notes, setNotes] = useState(initialData?.notes || "")

  const [isSaving, setIsSaving] = useState(false)

  // États pour les Popovers (un par ligne serait trop lourd, on triche ou on laisse le composant gérer)
  // Pour simplifier, on utilise simplement un bouton qui déclenche le popover.
  // Note: Radix UI Popover gère son état d'ouverture.

  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companyId, companies])
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customerId, customers])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])
  const defaultVatRate = useMemo(() => (selectedCustomer?.is_subject_to_vat === false ? 0 : 19), [selectedCustomer])

  const currencySymbol = useMemo(() => CURRENCIES.find((c) => c.code === currency)?.symbol || currency, [currency])

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => {
      const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity;
      const price = typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht;
      return sum + qty * price
    }, 0)

    const total_remise = lines.reduce((sum, line) => {
      const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity;
      const price = typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht;
      const remise = typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage;
      return sum + (qty * price * (remise / 100))
    }, 0)

    const total_ht = total_ht_brut - total_remise
    const total_fodec = isFodecApplicable ? total_ht * FODEC_RATE : 0
    const base_tva = total_ht + total_fodec

    const total_tva = lines.reduce((sum, line) => {
      const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity;
      const price = typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht;
      const remise = typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage;

      const line_ht = qty * price * (1 - remise / 100)
      const line_fodec = isFodecApplicable ? line_ht * FODEC_RATE : 0
      return sum + (line_ht + line_fodec) * ((line.tva_rate || 0) / 100)
    }, 0)

    const timbre = hasStamp ? 1.0 : 0
    const total_ttc = base_tva + total_tva + timbre
    return { total_ht, total_remise, total_fodec, total_tva, total_ttc, timbre }
  }, [lines, isFodecApplicable, hasStamp])

  const addLine = () =>
    setLines([
      ...lines,
      {
        local_id: crypto.randomUUID(),
        item_id: null,
        description: "",
        quantity: 0,
        unit_price_ht: 0,
        remise_percentage: 0,
        tva_rate: defaultVatRate,
      },
    ])
  const removeLine = (local_id: string) => setLines(lines.filter((l) => l.local_id !== local_id))

  // Update générique pour les champs texte/nombre
  const updateLine = (local_id: string, field: keyof QuoteLine, value: any) => {
    setLines(lines.map((l) => (l.local_id === local_id ? { ...l, [field]: value } : l)))
  }

  const handleItemSelect = (local_id: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (item) {
      setLines((prevLines) =>
        prevLines.map((l) =>
          l.local_id === local_id
            ? {
              ...l,
              item_id: itemId,
              description: (item.reference ? `[${item.reference}] ` : "") + item.name,
              unit_price_ht: item.sale_price || 0,
            }
            : l,
        ),
      )
    }
  }

  const handleSave = async () => {
    if (!companyId || (!customerId && !prospectName.trim())) {
      toast.error("Veuillez sélectionner une société et un client (ou prospect).")
      return
    }
    setIsSaving(true)

    const quotePayload = {
      company_id: companyId,
      customer_id: customerId || null,
      currency: currency,
      prospect_name: customerId ? null : prospectName,
      prospect_address: customerId ? null : prospectAddress,
      prospect_email: customerId ? null : prospectEmail,
      prospect_phone: customerId ? null : prospectPhone,
      quote_date: quoteDate,
      status: initialData?.status || "BROUILLON",
      has_stamp: hasStamp,
      show_remise_column: showRemise,
      total_ht: totals.total_ht,
      total_remise: totals.total_remise,
      total_fodec: totals.total_fodec,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      terms_and_conditions: termsAndConditions,
      notes: notes,
    }

    const linesPayload = lines.map((line) => {
      const quantity = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity;
      const unit_price_ht = typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht;
      const remise_percentage = typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage;

      const line_total_ht = quantity * unit_price_ht * (1 - remise_percentage / 100)

      const itemObj = items.find((i) => i.id === line.item_id)
      const isService = itemObj && 'type' in itemObj && itemObj.type === "SERVICE"

      return {
        item_id: isService ? null : line.item_id,
        service_id: isService ? line.item_id : null,
        description: line.description,
        quantity: quantity,
        unit_price_ht: unit_price_ht,
        remise_percentage: remise_percentage,
        tva_rate: line.tva_rate || 0,
        line_total_ht: line_total_ht,
      }
    })

    if (isNew) {
      // --- START: Generate Quote Number via Edge Function ---
      const { data: numberData, error: numberError } = await supabase.functions.invoke("get-next-quote-number", {
        body: JSON.stringify({ companyId }),
        headers: { "Content-Type": "application/json" },
      })

      if (numberError) {
        console.error("Error generating quote number:", numberError)
        toast.error("Impossible de générer le numéro de devis.")
        setIsSaving(false)
        return
      }

      const generatedQuoteNumber = numberData.quote_number
      // --- END: Generate Quote Number ---

      const { data: newQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert({ ...quotePayload, quote_number: generatedQuoteNumber })
        .select("id")
        .single()
      if (quoteError) {
        toast.error("Erreur création devis: " + quoteError.message)
        setIsSaving(false)
        return
      }
      if (linesPayload.length > 0) {
        const { error: linesError } = await supabase
          .from("quote_lines")
          .insert(linesPayload.map((l) => ({ ...l, quote_id: newQuote.id })))
        if (linesError) {
          toast.error("Erreur ajout lignes: " + linesError.message)
          setIsSaving(false)
          return
        }
      }
    } else {
      const { error: quoteUpdateError } = await supabase.from("quotes").update(quotePayload).eq("id", initialData.id)
      if (quoteUpdateError) {
        toast.error("Erreur MàJ devis: " + quoteUpdateError.message)
        setIsSaving(false)
        return
      }
      await supabase.from("quote_lines").delete().eq("quote_id", initialData.id)
      if (lines.length > 0) {
        const { error: linesInsertError } = await supabase
          .from("quote_lines")
          .insert(linesPayload.map((l) => ({ ...l, quote_id: initialData.id })))
        if (linesInsertError) {
          toast.error("Erreur insertion lignes: " + linesInsertError.message)
          setIsSaving(false)
          return
        }
      }
    }
    toast.success("Devis sauvegardé avec succès !")
    router.push(`/dashboard/quotes`)
    router.refresh()
    setIsSaving(false)
  }

  return (
    <div className="space-y-6 pb-24">
      {/* PREMIUM HEADER CARD */}
      <Card className="border-l-4 border-l-primary shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-purple-600 rounded-lg shadow-inner">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                  {isNew ? "Nouveau Devis" : `Devis ${initialData?.quote_number || ""}`}
                </CardTitle>
                <CardDescription className="text-base">
                  {isNew ? "Création d'une nouvelle proposition commerciale" : "Modification du devis existant"}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={cn("px-3 py-1 rounded-full text-sm font-medium border",
                initialData?.status === "VALIDÉ" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  initialData?.status === "EN_ATTENTE" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    "bg-slate-100 text-slate-700 border-slate-200"
              )}>
                {initialData?.status || "NOUVEAU"}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 grid gap-8">
          {/* CLIENT & COMPANY SECTION */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-dashed">
              <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                <Building2 className="h-4 w-4" />
                <h3>Émetteur</h3>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Entreprise</Label>
                <div className="font-medium text-lg flex items-center gap-2">
                  {companies.find(c => c.id === companyId)?.name || "Aucune entreprise sélectionnée"}
                  {!isNew && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">(Fixé)</span>}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-dashed">
              <div className="flex items-center gap-2 text-purple-600 font-semibold mb-2">
                <Users className="h-4 w-4" />
                <h3>Client</h3>
              </div>

              <div className="space-y-2">
                <Label>Client Destinataire</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between bg-background"
                      disabled={!isNew && !!initialData?.customer_id}
                    >
                      {customers.find((c) => c.id === customerId)?.name || "Sélectionner un client..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Rechercher..." />
                      <CommandList>
                        <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setCustomerId(c.id)
                                setProspectName("")
                                // setOpenCustomerPopover(false) // Component state managed cleanly
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {!customerId && (
                <div className="space-y-2 pt-2 border-t mt-2">
                  <Label className="text-xs text-muted-foreground">Ou saisir un prospect</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Nom du prospect..."
                      value={prospectName}
                      onChange={(e) => setProspectName(e.target.value)}
                      className="bg-background"
                    />
                    {prospectName && (
                      <>
                        <Input placeholder="Adresse..." value={prospectAddress} onChange={(e) => setProspectAddress(e.target.value)} />
                        <Input placeholder="Email..." value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} />
                        <Input placeholder="Téléphone..." value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Date du devis</Label>
              <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ITEMS SECTION */}
      <Card className="border-l-4 border-l-emerald-500 shadow-md">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            <CardTitle>Articles et Services</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Remises</Label>
              <Switch checked={showRemise} onCheckedChange={setShowRemise} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Timbre Fiscal</Label>
              <Switch checked={hasStamp} onCheckedChange={setHasStamp} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Article / Description</TableHead>
                  <TableHead className="w-[100px] text-right">Qté</TableHead>
                  <TableHead className="w-[120px] text-right">P.U. HT</TableHead>
                  {showRemise && <TableHead className="w-[100px] text-right">Remise %</TableHead>}
                  <TableHead className="w-[100px] text-right">TVA %</TableHead>
                  <TableHead className="w-[120px] text-right">Total HT</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const lineTotal = (typeof line.quantity === 'string' ? parseFloat(line.quantity) || 0 : line.quantity) *
                    (typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht) || 0 : line.unit_price_ht) *
                    (1 - (typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage) || 0 : line.remise_percentage) / 100);
                  return (
                    <TableRow key={line.local_id} className="group hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="justify-between w-full font-normal">
                                {line.item_id ? items.find(i => i.id === line.item_id)?.name : "Sélectionner un article..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Rechercher un article..." />
                                <CommandList>
                                  <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                                  <CommandGroup>
                                    {items.map((item) => (
                                      <CommandItem key={item.id} value={item.name} onSelect={() => handleItemSelect(line.local_id, item.id)}>
                                        <Check className={cn("mr-2 h-4 w-4", line.item_id === item.id ? "opacity-100" : "opacity-0")} />
                                        {item.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Textarea
                            placeholder="Description..."
                            value={line.description}
                            onChange={(e) => updateLine(line.local_id, "description", e.target.value)}
                            rows={1}
                            className="min-h-[40px] resize-y text-xs text-muted-foreground"
                          />
                        </div>
                      </TableCell>
                      <TableCell><Input type="number" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.local_id, "quantity", e.target.value)} className="text-right" /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={line.unit_price_ht} onChange={(e) => updateLine(line.local_id, "unit_price_ht", e.target.value)} className="text-right" /></TableCell>
                      {showRemise && (
                        <TableCell><Input type="number" step="0.01" value={line.remise_percentage} onChange={(e) => updateLine(line.local_id, "remise_percentage", e.target.value)} className="text-right" /></TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={String(line.tva_rate)}
                          onValueChange={(val) => updateLine(line.local_id, "tva_rate", parseFloat(val))}
                        >
                          <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TVA_RATES.map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium">{lineTotal.toFixed(3)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeLine(line.local_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 bg-muted/20 border-t flex justify-center">
            <Button variant="outline" onClick={addLine} className="w-full md:w-auto border-dashed">
              <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TOTALS & ACTIONS */}
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes & Conditions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notes internes / Publiques</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes visibles sur le devis..." />
              </div>
              <div className="space-y-2">
                <Label>Conditions de paiement</Label>
                <Textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} placeholder="Conditions particulières..." />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total HT Brut</span>
                <span>{totals.total_ht.toFixed(3)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total Remise</span>
                <span>- {totals.total_remise.toFixed(3)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>Total HT Net</span>
                <span>{totals.total_ht.toFixed(3)} {currencySymbol}</span>
              </div>
              {isFodecApplicable && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>FODEC (1%)</span>
                  <span>{totals.total_fodec.toFixed(3)} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total TVA</span>
                <span>{totals.total_tva.toFixed(3)} {currencySymbol}</span>
              </div>
              {hasStamp && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Timbre Fiscal</span>
                  <span>{totals.timbre.toFixed(3)} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-3 text-primary">
                <span>Net à Payer</span>
                <span>{totals.total_ttc.toFixed(3)} {currencySymbol}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : (isNew ? "Créer le Devis" : "Mettre à jour")}
            </Button>
            <Link href="/dashboard/quotes" className="w-full">
              <Button variant="outline" size="lg" className="w-full">Annuler</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

