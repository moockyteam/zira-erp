"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format, addDays } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {
  PlusCircle,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronsUpDown,
  Check,
  Building2,
  User,
  Calendar,
  Package,
  Truck,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string; is_subject_to_fodec: boolean | null }
type Customer = { id: string; name: string; balance: number | null }
type Item = { id: string; name: string; sale_price: number | null; reference: string | null; quantity_on_hand: number }
type Quote = { id: string; quote_number: string }

type InvoiceLine = {
  local_id: string
  item_id: string | null
  description: string
  quantity: number
  unit_price_ht: number
  remise_percentage: number
  tva_rate: number
}

const TVA_RATES = [19, 13, 7, 0]
const FODEC_RATE = 0.01

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
  companies: Company[]
  customers: Customer[]
  items: Item[]
  confirmedQuotes: Quote[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || "")
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoice_date || format(new Date(), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState(initialData?.due_date || format(addDays(new Date(), 30), "yyyy-MM-dd"))
  const [lines, setLines] = useState<InvoiceLine[]>(
    initialData?.invoice_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [
      {
        local_id: crypto.randomUUID(),
        item_id: null,
        description: "",
        quantity: 1,
        unit_price_ht: 0,
        remise_percentage: 0,
        tva_rate: 19,
      },
    ],
  )
  const [escomptePercentage, setEscomptePercentage] = useState(initialData?.escompte_percentage || 0)
  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp || false)
  const [deliveryEnabled, setDeliveryEnabled] = useState(initialData?.delivery_enabled || false)
  const [driverName, setDriverName] = useState(initialData?.driver_name || "")
  const [vehicleRegistration, setVehicleRegistration] = useState(initialData?.vehicle_registration || "")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteId, setQuoteId] = useState(initialData?.quote_id || null)

  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companyId, companies])
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customerId, customers])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])

  useEffect(() => {
    if (quoteInitialData && isNew) {
      setCompanyId(quoteInitialData.company_id)
      setCustomerId(quoteInitialData.customer_id || "")
      setEscomptePercentage(quoteInitialData.escompte_percentage || 0)
      setHasStamp(quoteInitialData.has_stamp || false)
      setQuoteId(quoteInitialData.id)

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

  const totals = useMemo(() => {
    const total_ht_brut = lines.reduce((sum, line) => sum + line.quantity * line.unit_price_ht, 0)
    const total_remise = lines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price_ht * (line.remise_percentage / 100),
      0,
    )
    const total_ht_net = total_ht_brut - total_remise

    const total_escompte = total_ht_net * (escomptePercentage / 100)
    const net_commercial = total_ht_net - total_escompte
    const total_fodec = isFodecApplicable ? net_commercial * FODEC_RATE : 0
    const base_tva = net_commercial + total_fodec

    const tva_details = TVA_RATES.map((rate) => {
      const base = lines
        .filter((line) => line.tva_rate === rate)
        .reduce((sum, line) => sum + line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100), 0)

      const base_with_fodec_share = base + (isFodecApplicable ? base * FODEC_RATE : 0)
      const amount = base_with_fodec_share * (rate / 100)
      return { rate, base: base_with_fodec_share, amount }
    })

    const total_tva = tva_details.reduce((sum, detail) => sum + detail.amount, 0)
    const timbre = hasStamp ? 1 : 0
    const total_ttc = base_tva + total_tva + timbre

    const ancien_solde = selectedCustomer?.balance || 0
    const nouveau_solde = ancien_solde - total_ttc

    return {
      total_ht_net,
      total_remise,
      total_escompte,
      net_commercial,
      total_fodec,
      base_tva,
      tva_details,
      total_tva,
      timbre,
      total_ttc,
      ancien_solde,
      nouveau_solde,
    }
  }, [lines, escomptePercentage, isFodecApplicable, hasStamp, selectedCustomer])

  const handleLineChange = useCallback(
    (index: number, field: keyof InvoiceLine, value: any) => {
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
        tva_rate: 19,
      },
    ])
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))

  const handleSave = async () => {
    if (!companyId || !customerId) {
      setError("Veuillez sélectionner une entreprise et un client.")
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      setError("La facture doit contenir au moins une ligne avec une description.")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const invoicePayload = {
        company_id: companyId,
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: initialData?.status || "BROUILLON",
        total_ht: totals.total_ht_net,
        total_remise: totals.total_remise,
        escompte_percentage: escomptePercentage,
        total_escompte: totals.total_escompte,
        total_fodec: totals.total_fodec,
        total_tva: totals.total_tva,
        has_stamp: hasStamp,
        total_ttc: totals.total_ttc,
        delivery_enabled: deliveryEnabled,
        driver_name: deliveryEnabled ? driverName : null,
        vehicle_registration: deliveryEnabled ? vehicleRegistration : null,
        quote_id: quoteId,
      }

      if (isNew) {
        const { data: numberData, error: numberError } = await supabase.functions.invoke("get-next-invoice-number", {
          body: JSON.stringify({ companyId }),
          headers: { "Content-Type": "application/json" },
        })
        if (numberError) throw new Error("Impossible de générer le numéro de facture. " + numberError.message)

        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({ ...invoicePayload, invoice_number: numberData.invoice_number, quote_id: quoteId })
          .select("id")
          .single()
        if (invoiceError) throw new Error("Erreur lors de la création de la facture. " + invoiceError.message)

        const linesPayload = lines.map((line) => ({
          invoice_id: newInvoice.id,
          item_id: line.item_id,
          description: line.description,
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          remise_percentage: line.remise_percentage,
          tva_rate: line.tva_rate,
        }))

        const { error: linesError } = await supabase.from("invoice_lines").insert(linesPayload)
        if (linesError) throw new Error("Erreur lors de l'ajout des lignes à la facture. " + linesError.message)
      } else {
        const { error: invoiceUpdateError } = await supabase
          .from("invoices")
          .update(invoicePayload)
          .eq("id", initialData.id)
        if (invoiceUpdateError)
          throw new Error("Erreur lors de la mise à jour de la facture. " + invoiceUpdateError.message)

        const { error: deleteError } = await supabase.from("invoice_lines").delete().eq("invoice_id", initialData.id)
        if (deleteError) throw new Error("Erreur lors de la suppression des anciennes lignes. " + deleteError.message)

        if (lines.length > 0) {
          const linesPayload = lines.map((line) => ({
            invoice_id: initialData.id,
            item_id: line.item_id,
            description: line.description,
            quantity: line.quantity,
            unit_price_ht: line.unit_price_ht,
            remise_percentage: line.remise_percentage,
            tva_rate: line.tva_rate,
          }))
          const { error: linesInsertError } = await supabase.from("invoice_lines").insert(linesPayload)
          if (linesInsertError)
            throw new Error("Erreur lors de l'insertion des nouvelles lignes. " + linesInsertError.message)
        }
      }

      router.push("/dashboard/invoices")
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
          {selectedCustomer && (
            <div
              className={cn(
                "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                selectedCustomer.balance && selectedCustomer.balance < 0
                  ? "bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20 border-rose-300 dark:border-rose-800"
                  : selectedCustomer.balance && selectedCustomer.balance > 0
                    ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-300 dark:border-emerald-800"
                    : "bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border-slate-300 dark:border-slate-700",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      selectedCustomer.balance && selectedCustomer.balance < 0
                        ? "bg-rose-200 dark:bg-rose-900"
                        : selectedCustomer.balance && selectedCustomer.balance > 0
                          ? "bg-emerald-200 dark:bg-emerald-900"
                          : "bg-slate-200 dark:bg-slate-700",
                    )}
                  >
                    <User
                      className={cn(
                        "h-5 w-5",
                        selectedCustomer.balance && selectedCustomer.balance < 0
                          ? "text-rose-700 dark:text-rose-300"
                          : selectedCustomer.balance && selectedCustomer.balance > 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-slate-700 dark:text-slate-300",
                      )}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base">Situation du client</h4>
                    <span className="text-sm text-muted-foreground">
                      {selectedCustomer.balance && selectedCustomer.balance < 0
                        ? "Dette antérieure"
                        : selectedCustomer.balance && selectedCustomer.balance > 0
                          ? "Avoir disponible"
                          : "Solde neutre"}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "font-mono font-bold text-2xl",
                    selectedCustomer.balance && selectedCustomer.balance < 0
                      ? "text-rose-700 dark:text-rose-300"
                      : selectedCustomer.balance && selectedCustomer.balance > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-700 dark:text-slate-300",
                  )}
                >
                  {selectedCustomer.balance?.toFixed(3)} TND
                </span>
              </div>
            </div>
          )}

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
                    {selectedCustomer ? selectedCustomer.name : "Rechercher un client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                  <Command>
                    <CommandInput placeholder="Taper pour rechercher..." />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setCustomerId(customer.id)
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
                Date d'échéance
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-2 focus:border-amber-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-500 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl">Contenu de la Facture</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[35%] font-semibold">Description / Article</TableHead>
                  <TableHead className="text-right font-semibold">Qté</TableHead>
                  <TableHead className="text-right font-semibold">Prix U. HT</TableHead>
                  <TableHead className="text-right font-semibold">Remise %</TableHead>
                  <TableHead className="text-right font-semibold">TVA %</TableHead>
                  <TableHead className="text-right font-semibold">Total HT</TableHead>
                  <TableHead className="text-right font-semibold">Total TTC</TableHead>
                  <TableHead className="text-center font-semibold">Act</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => {
                  const lineTotalHT = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)
                  const lineTotalTTC = lineTotalHT * (1 + line.tva_rate / 100)
                  return (
                    <TableRow
                      key={line.local_id}
                      className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors"
                    >
                      <TableCell className="align-top">
                        <Command>
                          <CommandInput
                            placeholder="Saisir ou rechercher un article..."
                            value={line.description}
                            onValueChange={(value) => handleLineChange(index, "description", value)}
                            className="border-2 rounded-md focus:border-emerald-500 transition-colors"
                          />
                          <CommandList>
                            <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                            <CommandGroup>
                              {items
                                .filter(
                                  (item) =>
                                    item.name.toLowerCase().includes(line.description.toLowerCase()) ||
                                    (item.reference &&
                                      item.reference.toLowerCase().includes(line.description.toLowerCase())),
                                )
                                .slice(0, 5)
                                .map((item) => (
                                  <CommandItem key={item.id} onSelect={() => handleItemSelect(index, item.id)}>
                                    {item.name}{" "}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      (Stock: {item.quantity_on_hand})
                                    </span>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, "quantity", Number.parseFloat(e.target.value) || 0)}
                          className="text-right border-2"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          value={line.unit_price_ht}
                          onChange={(e) =>
                            handleLineChange(index, "unit_price_ht", Number.parseFloat(e.target.value) || 0)
                          }
                          className="text-right border-2"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          value={line.remise_percentage}
                          onChange={(e) =>
                            handleLineChange(index, "remise_percentage", Number.parseFloat(e.target.value) || 0)
                          }
                          className="text-right border-2"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={String(line.tva_rate)}
                          onValueChange={(v) => handleLineChange(index, "tva_rate", Number.parseInt(v))}
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
                      <TableCell className="align-top font-mono text-right pt-4 font-semibold text-indigo-600 dark:text-indigo-400">
                        {lineTotalHT.toFixed(3)}
                      </TableCell>
                      <TableCell className="align-top font-mono font-bold text-right pt-4 text-lg text-emerald-600 dark:text-emerald-400">
                        {lineTotalTTC.toFixed(3)}
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
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
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-l-4 border-l-amber-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle>Informations de Livraison</CardTitle>
                </div>
                <Switch id="delivery-switch" checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
              </div>
            </CardHeader>
            {deliveryEnabled && (
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="driver_name">Nom du chauffeur</Label>
                  <Input
                    id="driver_name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="border-2 focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_registration">Matricule du véhicule</Label>
                  <Input
                    id="vehicle_registration"
                    value={vehicleRegistration}
                    onChange={(e) => setVehicleRegistration(e.target.value)}
                    className="border-2 focus:border-amber-500"
                  />
                </div>
              </CardContent>
            )}
          </Card>

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
          <Card className="border-2 border-indigo-500 shadow-xl sticky top-4">
            <CardHeader className="bg-gradient-to-br from-indigo-500 to-emerald-500 text-white">
              <CardTitle className="text-xl">Totaux & Soldes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm pt-6">
              <div className="flex justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <span className="text-muted-foreground">Total HT Net</span>
                <span className="font-semibold">{totals.total_ht_net.toFixed(3)}</span>
              </div>

              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                <Label htmlFor="escompte" className="text-xs">
                  Escompte (%)
                </Label>
                <Input
                  id="escompte"
                  type="number"
                  className="w-24 h-8 text-right border-2"
                  value={escomptePercentage}
                  onChange={(e) => setEscomptePercentage(Number.parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="flex justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <span className="text-muted-foreground">Montant Escompte</span>
                <span className="text-rose-600 dark:text-rose-400">- {totals.total_escompte.toFixed(3)}</span>
              </div>

              {isFodecApplicable && (
                <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <span className="font-medium text-blue-700 dark:text-blue-300">FODEC (1%)</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    + {totals.total_fodec.toFixed(3)}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t pt-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <span className="text-muted-foreground">Base TVA</span>
                <span className="font-semibold">{totals.base_tva.toFixed(3)}</span>
              </div>

              <div className="flex justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <span className="text-muted-foreground">Total TVA</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  + {totals.total_tva.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                <Label htmlFor="stamp-switch" className="flex items-center gap-2 cursor-pointer text-xs">
                  <Switch id="stamp-switch" checked={hasStamp} onCheckedChange={setHasStamp} />
                  Timbre Fiscal
                </Label>
                <span>+ {totals.timbre.toFixed(3)}</span>
              </div>

              <div className="flex justify-between font-bold text-xl border-t-2 pt-4 mt-4 p-3 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/20 dark:to-emerald-950/20 rounded-lg">
                <span>Total TTC</span>
                <span className="text-indigo-600 dark:text-indigo-400">{totals.total_ttc.toFixed(3)} TND</span>
              </div>

              <div className="border-t-2 pt-4 mt-4 space-y-3">
                <div className="flex justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <span className="text-muted-foreground">Ancien Solde</span>
                  <span className="font-semibold">{totals.ancien_solde.toFixed(3)} TND</span>
                </div>
                <div className="flex justify-between font-bold text-lg p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-lg border-2 border-emerald-300 dark:border-emerald-800">
                  <span>Nouveau Solde</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{totals.nouveau_solde.toFixed(3)} TND</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          size="lg"
          className="shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all px-8"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sauvegarde en cours...
            </>
          ) : (
            <>
              <Check className="mr-2 h-5 w-5" />
              Enregistrer la Facture
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
