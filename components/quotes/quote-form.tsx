"use client"

import { Button } from "@/components/ui/button"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Package, Plus, ChevronsUpDown, Check, Trash2, Receipt } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string; is_subject_to_fodec: boolean | null }
type Customer = { id: string; name: string; is_subject_to_vat: boolean | null }
type Item = { id: string; name: string; sale_price: number | null; reference: string | null }
type QuoteLine = {
  local_id: string
  id?: string
  item_id: string | null
  description: string
  quantity: number
  unit_price_ht: number
  remise_percentage: number
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

export function QuoteForm({ initialData, companies, customers, items, defaultTerms }: QuoteFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || "")
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [quoteDate, setQuoteDate] = useState(initialData?.quote_date || new Date().toISOString().split("T")[0])
  const [currency, setCurrency] = useState(initialData?.currency || "TND")

  const [prospectName, setProspectName] = useState(initialData?.prospect_name || "")
  const [prospectAddress, setProspectAddress] = useState(initialData?.prospect_address || "")
  const [prospectEmail, setProspectEmail] = useState(initialData?.prospect_email || "")
  const [prospectPhone, setProspectPhone] = useState(initialData?.prospect_phone || "")

  const [lines, setLines] = useState<QuoteLine[]>(
    initialData?.quote_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [],
  )

  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp ?? true)
  const [showRemise, setShowRemise] = useState(initialData?.show_remise_column ?? true)

  const [termsAndConditions, setTermsAndConditions] = useState(initialData?.terms_and_conditions || defaultTerms || "")
  const [notes, setNotes] = useState(initialData?.notes || "")

  const [isSaving, setIsSaving] = useState(false)

  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companyId, companies])
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customerId, customers])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])
  const defaultVatRate = useMemo(() => (selectedCustomer?.is_subject_to_vat === false ? 0 : 19), [selectedCustomer])

  const currencySymbol = useMemo(() => CURRENCIES.find((c) => c.code === currency)?.symbol || currency, [currency])

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.unit_price_ht || 0), 0)
    const total_remise = lines.reduce(
      (sum, line) => sum + (line.quantity || 0) * (line.unit_price_ht || 0) * ((line.remise_percentage || 0) / 100),
      0,
    )
    const total_ht = total_ht_brut - total_remise
    const total_fodec = isFodecApplicable ? total_ht * FODEC_RATE : 0
    const base_tva = total_ht + total_fodec
    const total_tva = lines.reduce((sum, line) => {
      const line_ht = (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100)
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
        quantity: 1,
        unit_price_ht: 0,
        remise_percentage: 0,
        tva_rate: defaultVatRate,
      },
    ])
  const removeLine = (local_id: string) => setLines(lines.filter((l) => l.local_id !== local_id))
  const updateLine = (local_id: string, updatedValues: Partial<QuoteLine>) => {
    setLines(lines.map((l) => (l.local_id === local_id ? { ...l, ...updatedValues } : l)))
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
      const quantity = line.quantity || 0
      const unit_price_ht = line.unit_price_ht || 0
      const remise_percentage = line.remise_percentage || 0

      const line_total_ht = quantity * unit_price_ht * (1 - remise_percentage / 100)

      return {
        item_id: line.item_id,
        description: line.description,
        quantity: quantity,
        unit_price_ht: unit_price_ht,
        remise_percentage: remise_percentage,
        tva_rate: line.tva_rate || 0,
        line_total_ht: line_total_ht,
      }
    })

    if (isNew) {
      const { data: newQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert(quotePayload)
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
    <div className="space-y-8">
      <div className="border-2 p-6 rounded-lg space-y-6">
        <h2 className="text-2xl font-bold">Informations générales</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Société émettrice</Label>
            <Select onValueChange={setCompanyId} defaultValue={companyId} disabled={!isNew}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date du devis</Label>
            <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="currency" className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-600" />
              Devise
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.symbol} - {curr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border p-4 rounded-md space-y-4">
          <h3 className="font-semibold">Destinataire</h3>
          <div>
            <Label>Client existant</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled={!!prospectName}
                  className="w-full justify-between font-normal bg-transparent"
                >
                  {selectedCustomer ? selectedCustomer.name : "Rechercher..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                  <CommandInput />
                  <CommandList>
                    <CommandEmpty>Aucun client.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem key={c.id} value={c.name} onSelect={() => setCustomerId(c.id)}>
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
          <div className="text-center text-sm text-muted-foreground">OU</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nom du Prospect</Label>
              <Input
                placeholder="Nom..."
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                disabled={!!customerId}
              />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input
                placeholder="Adresse..."
                value={prospectAddress}
                onChange={(e) => setProspectAddress(e.target.value)}
                disabled={!!customerId}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Email..."
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                disabled={!!customerId}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                type="tel"
                placeholder="Téléphone..."
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                disabled={!!customerId}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-2 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package /> Articles et Services
          </h2>
          <div className="flex items-center space-x-2">
            <Label htmlFor="show-remise">Afficher Remise</Label>
            <Switch id="show-remise" checked={showRemise} onCheckedChange={setShowRemise} />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 items-center px-2 pb-2 border-b">
          <div className="col-span-4 text-sm font-semibold text-muted-foreground">Description</div>
          <div className="col-span-1 text-sm font-semibold text-muted-foreground">Qté</div>
          <div className="col-span-2 text-sm font-semibold text-muted-foreground">Prix U. HT</div>
          {showRemise && <div className="col-span-2 text-sm font-semibold text-muted-foreground">Remise %</div>}
          <div className={cn("col-span-2 text-sm font-semibold text-muted-foreground", !showRemise && "col-span-4")}>
            TVA %
          </div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2 mt-2">
          {lines.map((line) => (
            <div key={line.local_id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <Input
                  placeholder="Description de l'article ou service"
                  value={line.description}
                  onChange={(e) => updateLine(line.local_id, { description: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="text"
                  placeholder="1"
                  defaultValue={line.quantity}
                  onBlur={(e) => {
                    const value = e.target.value.replace(",", ".")
                    updateLine(line.local_id, { quantity: Number.parseFloat(value) || 0 })
                  }}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="text"
                  placeholder="0.000"
                  defaultValue={line.unit_price_ht}
                  onBlur={(e) => {
                    const value = e.target.value.replace(",", ".")
                    updateLine(line.local_id, { unit_price_ht: Number.parseFloat(value) || 0 })
                  }}
                />
              </div>
              {showRemise && (
                <div className="col-span-2">
                  <Input
                    type="text"
                    placeholder="0"
                    defaultValue={line.remise_percentage}
                    onBlur={(e) => {
                      const value = e.target.value.replace(",", ".")
                      updateLine(line.local_id, { remise_percentage: Number.parseFloat(value) || 0 })
                    }}
                  />
                </div>
              )}
              <div className={cn("col-span-2", !showRemise && "col-span-4")}>
                <Select
                  value={String(line.tva_rate)}
                  onValueChange={(v) => updateLine(line.local_id, { tva_rate: Number.parseFloat(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TVA_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-center">
                <Button variant="ghost" size="icon" onClick={() => removeLine(line.local_id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" onClick={addLine} variant="outline" className="w-full mt-4 border-dashed bg-transparent">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une ligne
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-semibold">Termes et Notes (Optionnel)</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-6 pt-4">
              <div>
                <Label htmlFor="terms">Termes et conditions</Label>
                <Textarea
                  id="terms"
                  placeholder="Ex: Validité du devis, conditions de paiement..."
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes internes (non visibles sur le PDF)</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes pour référence future..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-6 rounded-lg bg-gray-900 text-white">
          <h3 className="text-xl font-bold mb-4">Récapitulatif</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span>
                {totals.total_ht.toFixed(3)} {currencySymbol}
              </span>
            </div>
            {isFodecApplicable && (
              <div className="flex justify-between">
                <span>FODEC</span>
                <span>
                  {totals.total_fodec.toFixed(3)} {currencySymbol}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total TVA</span>
              <span>
                {totals.total_tva.toFixed(3)} {currencySymbol}
              </span>
            </div>
            {hasStamp && (
              <div className="flex justify-between">
                <span>Timbre Fiscal</span>
                <span>
                  {totals.timbre.toFixed(3)} {currencySymbol}
                </span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold border-t pt-2 mt-2">
              <span>Total TTC</span>
              <span>
                {totals.total_ttc.toFixed(3)} {currencySymbol}
              </span>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1 p-6 rounded-lg border-2">
          <h3 className="text-lg font-bold mb-4">Options du Document</h3>
          <div className="flex items-center justify-between">
            <Label>Timbre Fiscal (1.000 {currencySymbol})</Label>
            <Switch checked={hasStamp} onCheckedChange={setHasStamp} />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
          {isSaving ? "Enregistrement..." : "Sauvegarder le devis"}
        </Button>
        <Link href="/dashboard/quotes">
          <Button type="button" variant="outline" size="lg">
            Annuler
          </Button>
        </Link>
      </div>
    </div>
  )
}
