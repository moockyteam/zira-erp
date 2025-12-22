"use client"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format, addDays } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  PlusCircle,
  Trash2,
  ChevronsUpDown,
  Check,
  Building2,
  User,
  Calendar,
  Package,
  Receipt,
  CreditCard,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"

const TVA_RATES = [19, 13, 7, 0]
const FODEC_RATE = 0.01
const WITHHOLDING_TAX_RATE = 0.015

const CURRENCIES = [
  { code: "TND", symbol: "TND", label: "Dinar Tunisien" },
  { code: "USD", symbol: "$", label: "Dollar US" },
  { code: "EUR", symbol: "€", label: "Euro" },
]

export function InvoiceForm({
  initialData,
  quoteInitialData,
  companies,
  customers,
  items,
  confirmedQuotes,
}: {
  initialData: any | null
  quoteInitialData?: any | null
  companies: any[]
  customers: any[]
  items: any[]
  confirmedQuotes?: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || "")
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [prospectName, setProspectName] = useState(initialData?.prospect_name || "")
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoice_date || format(new Date(), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState(initialData?.due_date || format(addDays(new Date(), 30), "yyyy-MM-dd"))
  const [currency, setCurrency] = useState(initialData?.currency || quoteInitialData?.currency || "TND")

  // Refactor: lines use string | number for controlled inputs
  const [lines, setLines] = useState<any[]>(
    initialData?.invoice_lines?.map((l: any) => ({ ...l, local_id: l.id ? String(l.id) : crypto.randomUUID() })) || [],
  )

  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp ?? true)
  const [showRemise, setShowRemise] = useState(initialData?.show_remise_column ?? true)
  const [hasWithholdingTax, setHasWithholdingTax] = useState(initialData?.has_withholding_tax ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const [quoteId, setQuoteId] = useState(initialData?.quote_id || null)
  const [bankName, setBankName] = useState(initialData?.bank_name || "")
  const [iban, setIban] = useState(initialData?.iban || "")
  const [bicSwift, setBicSwift] = useState(initialData?.bic_swift || "")
  const [rib, setRib] = useState(initialData?.rib || "")

  useEffect(() => {
    if (quoteInitialData && isNew) {
      setCompanyId(quoteInitialData.company_id)
      setCustomerId(quoteInitialData.customer_id || "")
      setProspectName(quoteInitialData.prospect_name || "")
      setHasStamp(quoteInitialData.has_stamp ?? true)
      setShowRemise(quoteInitialData.show_remise_column ?? true)
      setQuoteId(quoteInitialData.id)
      setCurrency(quoteInitialData.currency || "TND")
      const newLines = quoteInitialData.quote_lines.map((line: any) => ({
        local_id: crypto.randomUUID(),
        item_id: line.item_id,
        description: line.description,
        quantity: line.quantity,
        unit_price_ht: line.unit_price_ht,
        remise_percentage: line.remise_percentage || 0,
        tva_rate: line.tva_rate,
      }))
      setLines(newLines)
    }
  }, [quoteInitialData, isNew])

  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companyId, companies])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])

  const currencySymbol = useMemo(() => CURRENCIES.find((c) => c.code === currency)?.symbol || currency, [currency])

  const totals = useMemo(() => {
    // Calcul sécurisé avec conversion
    const safeLines = lines.map(l => ({
      ...l,
      quantity: typeof l.quantity === 'string' ? parseFloat(l.quantity.replace(',', '.')) || 0 : l.quantity || 0,
      unit_price_ht: typeof l.unit_price_ht === 'string' ? parseFloat(l.unit_price_ht.replace(',', '.')) || 0 : l.unit_price_ht || 0,
      remise_percentage: typeof l.remise_percentage === 'string' ? parseFloat(l.remise_percentage.replace(',', '.')) || 0 : l.remise_percentage || 0,
    }))

    const total_ht_net = safeLines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100),
      0,
    )
    const total_fodec = isFodecApplicable ? total_ht_net * FODEC_RATE : 0
    const base_tva = total_ht_net + total_fodec
    const total_tva = safeLines.reduce((sum, line) => {
      const line_ht = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)
      const line_fodec = isFodecApplicable ? line_ht * FODEC_RATE : 0
      return sum + (line_ht + line_fodec) * ((line.tva_rate || 0) / 100)
    }, 0)
    const timbre = hasStamp ? 1.0 : 0
    const total_ttc = base_tva + total_tva + timbre
    const withholding_tax_amount = hasWithholdingTax ? total_ht_net * WITHHOLDING_TAX_RATE : 0
    const net_to_pay = total_ttc - withholding_tax_amount

    const tva_details = TVA_RATES.map((rate) => {
      const base = safeLines
        .filter((line) => line.tva_rate === rate)
        .reduce(
          (sum, line) =>
            sum + line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100),
          0,
        )
      const base_with_fodec_share = base + (isFodecApplicable ? base * FODEC_RATE : 0)
      const amount = base_with_fodec_share * (rate / 100)
      return { rate, base: base_with_fodec_share, amount }
    })

    return {
      total_ht_net,
      total_fodec,
      tva_details,
      total_tva,
      timbre,
      total_ttc,
      withholding_tax_amount,
      net_to_pay,
    }
  }, [lines, isFodecApplicable, hasStamp, hasWithholdingTax])

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
        tva_rate: 19,
      },
    ])
  const removeLine = (local_id: string) => setLines(lines.filter((l) => l.local_id !== local_id))

  const updateLine = (local_id: string, updatedValues: any) => {
    setLines(lines.map((l) => (l.local_id === local_id ? { ...l, ...updatedValues } : l)))
  }

  const handleItemSelect = async (local_id: string, itemId: string) => {
    const selectedItem = items.find((item) => item.id === itemId)
    if (selectedItem) {
      let finalPrice = selectedItem.sale_price || 0

      // Check for special price if customer is selected
      if (customerId) {
        try {
          const { data: specialPriceData } = await supabase
            .from("customer_items")
            .select("special_price, special_vat_rate")
            .eq("customer_id", customerId)
            .or(`item_id.eq.${itemId},service_id.eq.${itemId}`)
            .maybeSingle()

          if (specialPriceData) {
            if (specialPriceData.special_price !== null) {
              finalPrice = specialPriceData.special_price
              toast.info("Prix spécial appliqué")
            }

            // Determine applicable VAT: Special override -> Item default -> Fallback 19
            const applicableVat = (specialPriceData.special_vat_rate !== null && specialPriceData.special_vat_rate !== undefined)
              ? specialPriceData.special_vat_rate
              : (selectedItem.vat_rate || selectedItem.tva || 19)

            updateLine(local_id, {
              item_id: itemId,
              description: `${selectedItem.reference ? `[${selectedItem.reference}] ` : ""}${selectedItem.name}`,
              unit_price_ht: finalPrice,
              tva_rate: applicableVat
            })
            return
          }
        } catch (error) {
          console.error("Error fetching special price:", error)
        }
      }

      updateLine(local_id, {
        item_id: itemId,
        description: `${selectedItem.reference ? `[${selectedItem.reference}] ` : ""}${selectedItem.name}`,
        unit_price_ht: finalPrice,
        tva_rate: selectedItem.vat_rate || selectedItem.tva || 19
      })
    }
  }

  const handleSave = async () => {
    if (!companyId || (!customerId && !prospectName.trim())) {
      toast.error("Veuillez sélectionner une entreprise et un client (ou saisir un prospect).")
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      toast.error("La facture doit contenir au moins une ligne avec une description.")
      return
    }
    setIsLoading(true)
    try {
      const invoicePayload = {
        company_id: companyId,
        customer_id: customerId || null,
        prospect_name: customerId ? null : prospectName,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: initialData?.status || "BROUILLON",
        currency: currency,
        total_ht: totals.total_ht_net,
        total_fodec: totals.total_fodec,
        total_tva: totals.total_tva,
        has_stamp: hasStamp,
        total_ttc: totals.total_ttc,
        show_remise_column: showRemise,
        quote_id: quoteId,
        has_withholding_tax: hasWithholdingTax,
        withholding_tax_amount: totals.withholding_tax_amount,
        bank_name: bankName || null,
        iban: iban || null,
        bic_swift: bicSwift || null,
        rib: rib || null,
      }

      let targetInvoiceId = initialData?.id

      if (isNew) {
        const { data: numberData, error: numberError } = await supabase.functions.invoke("get-next-invoice-number", {
          body: JSON.stringify({ companyId }),
          headers: { "Content-Type": "application/json" },
        })
        if (numberError) throw new Error("Impossible de générer le numéro de facture.")

        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({ ...invoicePayload, invoice_number: numberData.invoice_number })
          .select("id")
          .single()
        if (invoiceError) throw new Error(invoiceError.message)

        targetInvoiceId = newInvoice.id
        toast.success("Facture créée avec succès")
      } else {
        const { error: invoiceUpdateError } = await supabase
          .from("invoices")
          .update(invoicePayload)
          .eq("id", targetInvoiceId)
        if (invoiceUpdateError) throw new Error(invoiceUpdateError.message)

        // Prepare for lines update
        const { error: deleteError } = await supabase.from("invoice_lines").delete().eq("invoice_id", targetInvoiceId)
        if (deleteError) throw new Error(deleteError.message)

        toast.success("Facture mise à jour avec succès")
      }

      if (lines.length > 0) {
        const payloadLines = lines.map((line) => {
          const itemObj = items.find(i => i.id === line.item_id)
          const isService = itemObj?.type === 'SERVICE'

          return {
            invoice_id: targetInvoiceId,
            item_id: isService ? null : line.item_id,
            service_id: isService ? line.item_id : null,
            description: line.description,
            quantity: typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity,
            unit_price_ht: typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht,
            remise_percentage: typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage,
            tva_rate: line.tva_rate,
          }
        })

        const { error: linesInsertError } = await supabase.from("invoice_lines").insert(payloadLines)
        if (linesInsertError) throw new Error(linesInsertError.message)
      }

      router.push("/dashboard/invoices")
      router.refresh()
    } catch (e: any) {
      toast.error("Erreur lors de la sauvegarde: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <Card className="border-l-4 border-l-indigo-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl">Informations Générales</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Entreprise Émettrice
              </Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={!isNew}>
                <SelectTrigger id="company" className="border-2 focus:border-indigo-500">
                  <SelectValue placeholder="Sélectionner..." />
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Client
              </Label>
              <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCustomerPopover}
                    className="w-full justify-between font-normal border-2 hover:border-emerald-500 transition-colors bg-transparent"
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
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setCustomerId(customer.id)
                              setProspectName("")
                              setOpenCustomerPopover(false)
                            }}
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

            {!customerId && (
              <div className="space-y-2">
                <Label htmlFor="prospectName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  Ou Prospect
                </Label>
                <Input
                  id="prospectName"
                  placeholder="Nom du prospect"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  className="border-2 focus:border-gray-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invoiceDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Date de la facture
              </Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="border-2 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Date d&apos;échéance
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-2 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-purple-600" />
                Devise
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="border-2 focus:border-purple-500">
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
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl">Contenu de la Facture</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="show-remise">Afficher Remise</Label>
            <Switch id="show-remise" checked={showRemise} onCheckedChange={setShowRemise} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[45%] min-w-[300px] font-semibold">Description / Article</TableHead>
                  <TableHead className="text-right font-semibold">Qté</TableHead>
                  <TableHead className="text-right font-semibold">Prix U. HT</TableHead>
                  {showRemise && <TableHead className="text-right font-semibold">Remise %</TableHead>}
                  <TableHead className="text-right font-semibold">TVA %</TableHead>
                  <TableHead className="text-right font-semibold">Prix U. TTC</TableHead>
                  <TableHead className="text-right font-semibold">Total HT</TableHead>
                  <TableHead className="text-center font-semibold">Act</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity || 0;
                  const price = typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht || 0;
                  const remise = typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage || 0;

                  const unitPriceTTC = price * (1 + (line.tva_rate || 0) / 100)
                  const lineTotalHT = qty * price * (1 - remise / 100)

                  return (
                    <TableRow
                      key={line.local_id}
                      className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors"
                    >
                      <TableCell className="align-top">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-start text-left font-normal whitespace-normal h-auto min-h-[40px] border-2">
                              {line.description || <span className="text-muted-foreground">Sélectionner ou saisir...</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Chercher un article..."
                                onValueChange={(val) => updateLine(line.local_id, { description: val })}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <Button variant="ghost" className="w-full justify-start" onClick={() => updateLine(line.local_id, { description: document.querySelector('[cmdk-input]')?.getAttribute('value') || "Nouvel article" })}>
                                    Utiliser comme description libre
                                  </Button>
                                </CommandEmpty>
                                <CommandGroup>
                                  {items.slice(0, 50).map(item => (
                                    <CommandItem key={item.id} value={item.name} onSelect={() => handleItemSelect(line.local_id, item.id)}>
                                      <Check className={cn("mr-2 h-4 w-4", line.item_id === item.id ? "opacity-100" : "opacity-0")} />
                                      {item.name} {item.reference && <span className="text-xs text-muted-foreground ml-2">({item.reference})</span>}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={line.quantity}
                          onChange={(e) => updateLine(line.local_id, { quantity: e.target.value })}
                          className="text-right border-2"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={line.unit_price_ht}
                          onChange={(e) => updateLine(line.local_id, { unit_price_ht: e.target.value })}
                          className="text-right border-2"
                        />
                      </TableCell>

                      {showRemise && (
                        <TableCell className="align-top">
                          <Input
                            value={line.remise_percentage}
                            onChange={(e) => updateLine(line.local_id, { remise_percentage: e.target.value })}
                            className="text-right border-2"
                          />
                        </TableCell>
                      )}
                      <TableCell className="align-top">
                        <Select
                          value={String(line.tva_rate)}
                          onValueChange={(v) => updateLine(line.local_id, { tva_rate: Number.parseInt(v) })}
                        >
                          <SelectTrigger className="border-2">
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
                      </TableCell>

                      <TableCell className="align-top font-mono text-right pt-3 text-muted-foreground">
                        {unitPriceTTC.toFixed(3)}
                      </TableCell>

                      <TableCell className="align-top font-mono text-right pt-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {lineTotalHT.toFixed(3)}
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.local_id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100 dark:hover:bg-rose-900/20"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t bg-slate-50 dark:bg-slate-900/50">
            <Button
              variant="outline"
              size="sm"
              onClick={addLine}
              className="border-2 border-dashed hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all bg-transparent"
            >
              <PlusCircle className="h-4 w-4 mr-2 text-emerald-600" />
              Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Moved financial recap to the right column and adjusted structure */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500 rounded-lg">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <CardTitle>Récapitulatif TVA</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Taux</TableHead>
                    <TableHead className="font-semibold">Base HT</TableHead>
                    <TableHead className="font-semibold">Montant TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals.tva_details
                    .filter((d) => d.base > 0)
                    .map((d) => (
                      <TableRow key={d.rate} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10">
                        <TableCell className="font-semibold">{d.rate}%</TableCell>
                        <TableCell className="font-mono">{d.base.toFixed(3)}</TableCell>
                        <TableCell className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {d.amount.toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          {/* Simplified the financial recap section to be more direct */}
          <Card className="border-2 border-indigo-500 shadow-xl sticky top-4">
            <CardHeader className="bg-gradient-to-br from-indigo-500 to-emerald-500 text-white">
              <CardTitle className="text-xl">Totaux & Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                <Label htmlFor="stamp-switch" className="flex items-center gap-2 cursor-pointer text-sm">
                  <Switch id="stamp-switch" checked={hasStamp} onCheckedChange={setHasStamp} />
                  Timbre Fiscal
                </Label>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                <Label htmlFor="withholding-switch" className="flex items-center gap-2 cursor-pointer text-sm">
                  <Switch id="withholding-switch" checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
                  Retenue à la Source (1.5%)
                </Label>
              </div>

              <div className="border-t pt-3 space-y-2 font-mono text-sm">
                <div className="flex justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <span className="text-muted-foreground">Total HT Net</span>
                  <span>{totals.total_ht_net.toFixed(3)}</span>
                </div>
                {isFodecApplicable && (
                  <div className="flex justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <span className="text-muted-foreground">FODEC (1%)</span>
                    <span>+ {totals.total_fodec.toFixed(3)}</span>
                  </div>
                )}
                <div className="flex justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <span className="text-muted-foreground">Total TVA</span>
                  <span>+ {totals.total_tva.toFixed(3)}</span>
                </div>
                <div className="flex justify-between p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <span className="text-muted-foreground">Timbre</span>
                  <span>+ {totals.timbre.toFixed(3)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2 p-1">
                  <span>Total TTC</span>
                  <span>
                    {totals.total_ttc.toFixed(3)} {currencySymbol}
                  </span>
                </div>
                {hasWithholdingTax && (
                  <>
                    <div className="flex justify-between text-red-600 dark:text-red-400 p-1">
                      <span>Retenue (1.5%)</span>
                      <span>- {totals.withholding_tax_amount.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t-2 border-emerald-500 pt-3 mt-3 text-emerald-600 dark:text-emerald-400 p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                      <span>NET À PAYER</span>
                      <span>
                        {totals.net_to_pay.toFixed(3)} {currencySymbol}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Coordonnées Bancaires (optionnel)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Nom de la Banque</Label>
              <Input
                id="bank_name"
                placeholder="Nom de la Banque"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="border-2 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                placeholder="IBAN"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="border-2 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic_swift">BIC/SWIFT</Label>
              <Input
                id="bic_swift"
                placeholder="BIC/SWIFT"
                value={bicSwift}
                onChange={(e) => setBicSwift(e.target.value)}
                className="border-2 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rib">RIB</Label>
              <Input
                id="rib"
                placeholder="RIB"
                value={rib}
                onChange={(e) => setRib(e.target.value)}
                className="border-2 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Actions Footer - Fixed Bottom or placed at end */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t flex items-center justify-end gap-4 z-50 md:pl-72">
        <Link href="/dashboard/invoices">
          <Button variant="outline" size="lg">Annuler</Button>
        </Link>
        <Button size="lg" onClick={handleSave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Enregistrement..." : "Enregistrer la Facture"}
        </Button>
      </div>
    </div>
  )
}
