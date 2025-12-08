"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Users, UserPlus, Package, Plus, ChevronsUpDown, Check, Trash2, Search } from "lucide-react"
import Link from "next/link"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

// --- TYPES ---
type Company = { id: string; name: string; is_subject_to_fodec: boolean | null }
type Customer = { id: string; name: string }
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

// --- CONSTANTES ---
const TVA_RATES = [19, 13, 7, 0]
const FODEC_RATE = 0.01 // 1%

interface QuoteFormProps {
  initialData: any | null
  companies: Company[]
  customers: Customer[]
  items: Item[]
  defaultTerms: string | null
}

function QuoteFormContent({
  setCompanyId,
  customerId,
  setCustomerId,
  prospectName,
  setProspectName,
  quoteDate,
  setQuoteDate,
  companies,
  customers,
  isNew,
}) {
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false)
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId])

  const handleCustomerSelect = (customerIdValue: string) => {
    setCustomerId(customerIdValue)
    setProspectName("") // Clear prospect when customer is selected
    setOpenCustomerPopover(false)
  }

  const handleProspectChange = (value: string) => {
    setProspectName(value)
    if (value) setCustomerId("") // Clear customer when prospect is entered
  }

  return (
    <div className="space-y-8">
      {/* En-tête avec dégradé */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-white">Informations générales</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-950/30 p-6 rounded-lg">
        {/* Société émettrice */}
        <div className="space-y-1.5">
          <Label>Société émettrice</Label>
          <Select value={customerId} onValueChange={setCompanyId} disabled={!isNew}>
            <SelectTrigger className="bg-transparent">
              <SelectValue placeholder="Sélectionner une société" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date du devis */}
        <div className="space-y-1.5">
          <Label>Date du devis</Label>
          <Input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="bg-transparent"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Client
          </Label>
          <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCustomerPopover}
                disabled={!!prospectName}
                className="w-full justify-between font-normal bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedCustomer ? selectedCustomer.name : "Rechercher un client..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Rechercher un client..." />
                <CommandList>
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandGroup>
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.name}
                        onSelect={() => handleCustomerSelect(customer.id)}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")}
                        />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-purple-600" />
            Prospect (saisie libre)
          </Label>
          <Input
            type="text"
            placeholder="Nom du prospect..."
            value={prospectName}
            onChange={(e) => handleProspectChange(e.target.value)}
            disabled={!!customerId}
            className="bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  )
}

function LineItem({ line, items, onUpdate, onDelete }) {
  const [openProductPopover, setOpenProductPopover] = useState(false)
  const selectedItem = useMemo(() => items.find((item) => item.id === line.item_id), [items, line.item_id])

  const handleProductSelect = (itemId: string) => {
    const selectedProduct = items.find((item) => item.id === itemId)
    if (selectedProduct) {
      onUpdate({
        ...line,
        item_id: itemId,
        description: `${selectedProduct.reference ? `[${selectedProduct.reference}] ` : ""}${selectedProduct.name}`,
        unit_price_ht: selectedProduct.sale_price || 0,
      })
    }
    setOpenProductPopover(false)
  }

  return (
    <div className="grid grid-cols-12 gap-3 items-center p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-200 dark:border-purple-900 hover:border-purple-400 transition-colors">
      {/* Produit du stock */}
      <div className="col-span-3">
        <Popover open={openProductPopover} onOpenChange={setOpenProductPopover}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openProductPopover}
              className="w-full justify-between font-normal bg-transparent border-2"
            >
              {selectedItem ? (
                <span className="truncate">{selectedItem.reference || selectedItem.name}</span>
              ) : (
                <span className="text-muted-foreground">Produit...</span>
              )}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Rechercher un produit..." />
              <CommandList>
                <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem key={item.id} value={item.name} onSelect={() => handleProductSelect(item.id)}>
                      <Check className={cn("mr-2 h-4 w-4", line.item_id === item.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        {item.reference && <span className="text-xs text-muted-foreground">{item.reference}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Description */}
      <div className="col-span-3">
        <Input
          type="text"
          placeholder="Description..."
          value={line.description}
          onChange={(e) => onUpdate({ ...line, description: e.target.value })}
          className="border-2 bg-transparent"
        />
      </div>

      {/* Quantité */}
      <div className="col-span-1">
        <Input
          type="number"
          placeholder="Qté"
          value={line.quantity}
          onChange={(e) => onUpdate({ ...line, quantity: Number.parseFloat(e.target.value) || 0 })}
          className="border-2 bg-transparent"
        />
      </div>

      {/* Prix unitaire HT */}
      <div className="col-span-2">
        <Input
          type="number"
          placeholder="Prix U. HT"
          value={line.unit_price_ht}
          onChange={(e) => onUpdate({ ...line, unit_price_ht: Number.parseFloat(e.target.value) || 0 })}
          className="border-2 bg-transparent"
        />
      </div>

      {/* Remise % */}
      <div className="col-span-1">
        <Input
          type="number"
          placeholder="Remise"
          value={line.remise_percentage}
          onChange={(e) => onUpdate({ ...line, remise_percentage: Number.parseFloat(e.target.value) || 0 })}
          className="border-2 bg-transparent"
        />
      </div>

      {/* TVA */}
      <div className="col-span-1">
        <Select
          value={String(line.tva_rate)}
          onValueChange={(v) => onUpdate({ ...line, tva_rate: Number.parseFloat(v) })}
        >
          <SelectTrigger className="border-2 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TVA_RATES.map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bouton supprimer */}
      <div className="col-span-1 flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function QuoteForm({ initialData, companies, customers, items }: QuoteFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isNew = !initialData

  // --- ÉTATS DU FORMULAIRE ---
  const [companyId, setCompanyId] = useState(
    initialData?.company_id || searchParams.get("companyId") || companies[0]?.id || "",
  )
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [prospectName, setProspectName] = useState(initialData?.prospect_name || "")
  const [quoteDate, setQuoteDate] = useState(initialData?.quote_date || new Date().toISOString().split("T")[0])

  const [lines, setLines] = useState<QuoteLine[]>(
    initialData?.quote_lines?.map((l: any) => ({
      ...l,
      local_id: crypto.randomUUID(),
      remise_percentage: l.remise_percentage || 0,
    })) || [
      {
        local_id: crypto.randomUUID(),
        item_id: null,
        description: "",
        quantity: 1,
        unit_price_ht: 0,
        remise_percentage: 0,
        tva_rate: 19.0,
      },
    ],
  )

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- CALCULS ---
  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companyId, companies])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => sum + line.quantity * line.unit_price_ht, 0)
    const total_remise = lines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price_ht * (line.remise_percentage / 100),
      0,
    )
    const total_ht = total_ht_brut - total_remise

    const total_fodec = isFodecApplicable ? total_ht * FODEC_RATE : 0
    const base_tva = total_ht + total_fodec

    const tva_details = TVA_RATES.map((rate) => {
      const base = lines
        .filter((l) => l.tva_rate === rate)
        .reduce((s, l) => s + l.quantity * l.unit_price_ht * (1 - l.remise_percentage / 100), 0)
      const base_fodec = base + (isFodecApplicable ? base * FODEC_RATE : 0)
      const amount = base_fodec * (rate / 100)
      return { rate, base: base_fodec, amount }
    })

    const total_tva = tva_details.reduce((sum, detail) => sum + detail.amount, 0)
    const timbre = 1
    const total_ttc = base_tva + total_tva + timbre

    return { total_ht, total_remise, total_fodec, total_tva, total_ttc, timbre }
  }, [lines, isFodecApplicable])

  // --- GESTION DES LIGNES ---
  const handleLineChange = useCallback(
    (index: number, field: keyof QuoteLine, value: any) => {
      const newLines = [...lines]
      newLines[index][field] = value
      setLines(newLines)
    },
    [lines],
  )
  const handleItemSelect = useCallback(
    (index: number, itemId: string) => {
      const selectedItem = items.find((item) => item.id === itemId)
      if (selectedItem) {
        const newLines = [...lines]
        const line = { ...newLines[index] }
        line.item_id = itemId
        line.description = `${selectedItem.reference ? `[${selectedItem.reference}] ` : ""}${selectedItem.name}`
        line.unit_price_ht = selectedItem.sale_price || 0
        line.quantity = line.quantity || 1
        newLines[index] = line
        setLines(newLines)
      }
    },
    [lines, items],
  )
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
        tva_rate: 19.0,
      },
    ])
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))

  // --- SAUVEGARDE ---
  const handleSave = async () => {
    if (!companyId) {
      setError("Veuillez sélectionner une entreprise.")
      return
    }
    if (!customerId && !prospectName.trim()) {
      setError("Veuillez sélectionner un client ou saisir le nom d'un prospect.")
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      setError("Le devis doit contenir au moins une ligne.")
      return
    }

    setIsSaving(true)
    setError(null)

    const quotePayload = {
      company_id: companyId,
      customer_id: customerId || null,
      prospect_name: customerId ? null : prospectName,
      quote_date: quoteDate,
      status: initialData?.status || "BROUILLON",
    }

    if (isNew) {
      const { data: newQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert(quotePayload)
        .select("id")
        .single()
      if (quoteError) {
        setIsSaving(false)
        setError("Erreur création devis: " + quoteError.message)
        return
      }

      const linesPayload = lines.map((line) => ({
        quote_id: newQuote.id,
        item_id: line.item_id,
        description: line.description,
        quantity: line.quantity,
        unit_price_ht: line.unit_price_ht,
        remise_percentage: line.remise_percentage,
        tva_rate: line.tva_rate,
        line_total_ht: (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100),
      }))

      const { error: linesError } = await supabase.from("quote_lines").insert(linesPayload)
      if (linesError) {
        setError("Erreur ajout lignes: " + linesError.message)
      } else {
        router.push(`/dashboard/quotes`)
        router.refresh()
      }
    } else {
      const { error: quoteUpdateError } = await supabase.from("quotes").update(quotePayload).eq("id", initialData.id)
      if (quoteUpdateError) {
        setIsSaving(false)
        setError("Erreur MàJ devis: " + quoteUpdateError.message)
        return
      }

      const { error: deleteError } = await supabase.from("quote_lines").delete().eq("quote_id", initialData.id)
      if (deleteError) {
        setIsSaving(false)
        setError("Erreur suppression anciennes lignes: " + deleteError.message)
        return
      }

      if (lines.length > 0) {
        const linesPayload = lines.map((line) => ({
          quote_id: initialData.id,
          item_id: line.item_id,
          description: line.description,
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          remise_percentage: line.remise_percentage,
          tva_rate: line.tva_rate,
          line_total_ht: (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100),
        }))
        const { error: linesInsertError } = await supabase.from("quote_lines").insert(linesPayload)
        if (linesInsertError) {
          setError("Erreur insertion nouvelles lignes: " + linesInsertError.message)
        }
      }
      router.push(`/dashboard/quotes`)
      router.refresh()
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-8">
      {/* Formulaire principal */}
      <div className="border-2 border-indigo-200 dark:border-indigo-900 rounded-lg shadow-lg p-6 bg-gradient-to-br from-white to-indigo-50/30 dark:from-gray-900 dark:to-indigo-950/20">
        <QuoteFormContent
          setCompanyId={setCompanyId}
          customerId={customerId}
          setCustomerId={setCustomerId}
          prospectName={prospectName}
          setProspectName={setProspectName}
          quoteDate={quoteDate}
          setQuoteDate={setQuoteDate}
          companies={companies}
          customers={customers}
          isNew={isNew}
        />

        {/* Lignes du devis */}
        <div className="mt-8 space-y-4">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="h-6 w-6" />
              Articles et Services
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950 dark:to-pink-950 rounded-lg border-2 border-purple-300 dark:border-purple-700">
            <div className="col-span-3 text-sm font-semibold text-purple-900 dark:text-purple-100">
              Produit du stock
            </div>
            <div className="col-span-3 text-sm font-semibold text-purple-900 dark:text-purple-100">Description</div>
            <div className="col-span-1 text-sm font-semibold text-purple-900 dark:text-purple-100">Quantité</div>
            <div className="col-span-2 text-sm font-semibold text-purple-900 dark:text-purple-100">Prix U. HT (DT)</div>
            <div className="col-span-1 text-sm font-semibold text-purple-900 dark:text-purple-100">Remise %</div>
            <div className="col-span-1 text-sm font-semibold text-purple-900 dark:text-purple-100">TVA %</div>
            <div className="col-span-1 text-sm font-semibold text-purple-900 dark:text-purple-100 text-center">
              Action
            </div>
          </div>

          <div className="border-l-4 border-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/30 p-6 rounded-lg space-y-4">
            {lines.map((line) => (
              <LineItem
                key={line.local_id}
                line={line}
                items={items}
                onUpdate={(updatedLine) => {
                  setLines((prev) => prev.map((l) => (l.local_id === line.local_id ? updatedLine : l)))
                }}
                onDelete={() => setLines((prev) => prev.filter((l) => l.local_id !== line.local_id))}
              />
            ))}
            <Button
              type="button"
              onClick={addLine}
              variant="outline"
              className="w-full border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 bg-transparent"
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un article
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-lg shadow-2xl border-2 border-indigo-400">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-lg">
            <span className="font-medium">Total HT</span>
            <span className="font-bold">{totals.total_ht.toFixed(3)} DT</span>
          </div>
          <div className="flex justify-between items-center border-t border-white/30 pt-2">
            <span className="font-medium">TVA</span>
            <span className="font-bold">{totals.total_tva.toFixed(3)} DT</span>
          </div>
          <div className="flex justify-between items-center text-2xl font-bold border-t-2 border-white/50 pt-3">
            <span>Total TTC</span>
            <span>{totals.total_ttc.toFixed(3)} DT</span>
          </div>
        </div>
        {error && <p className="mt-4 text-red-200 bg-red-500/20 p-3 rounded">{error}</p>}
        <div className="mt-6 flex gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-white text-indigo-600 hover:bg-indigo-50 font-bold text-lg h-12 shadow-lg"
          >
            {isSaving ? "Enregistrement..." : isNew ? "Créer le devis" : "Mettre à jour"}
          </Button>
          <Link href="/dashboard/quotes">
            <Button
              type="button"
              variant="outline"
              className="h-12 bg-white/10 border-white text-white hover:bg-white/20"
            >
              Annuler
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
