"use client"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Trash2, Loader2, ChevronsUpDown, Check, Save } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string; is_subject_to_fodec: boolean | null }
type Customer = {
  id: string
  name: string
  address: string | null
  street?: string
  delegation?: string
  governorate?: string
  country?: string
  matricule_fiscal?: string
  email?: string
  phone_number?: string
  company_id?: string
}
type Item = { id: string; name: string; sale_price: number | null; reference: string | null; quantity_on_hand: number }
type DnLine = {
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

export function DeliveryNoteForm({ initialData, initialDataSource, companies, customers: initialCustomers, items }: any) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || "")
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || [])
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [deliveryAddress, setDeliveryAddress] = useState(initialData?.delivery_address || "")
  const [deliveryDate, setDeliveryDate] = useState(initialData?.delivery_date || format(new Date(), "yyyy-MM-dd"))
  const [lines, setLines] = useState<DnLine[]>(
    initialData?.delivery_note_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [
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
  const [driverName, setDriverName] = useState(initialData?.driver_name || "")
  const [vehicleRegistration, setVehicleRegistration] = useState(initialData?.vehicle_registration || "")
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [isLoading, setIsLoading] = useState(false)
  const [sourceDoc, setSourceDoc] = useState({
    quote_id: initialData?.quote_id || null,
    invoice_id: initialData?.invoice_id || null,
  })
  const [escomptePercentage, setEscomptePercentage] = useState(initialData?.escompte_percentage || 0)
  const [hasStamp, setHasStamp] = useState(initialData?.has_stamp || false)
  const [isValued, setIsValued] = useState(initialData?.is_valued ?? false)
  const [showRemise, setShowRemise] = useState(initialData?.show_remise_column ?? true)

  const selectedCompany = useMemo(() => companies.find((c: Company) => c.id === companyId), [companyId, companies])
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customerId, customers])
  const isFodecApplicable = useMemo(() => selectedCompany?.is_subject_to_fodec === true, [selectedCompany])

  useEffect(() => {
    const fetchCustomersForCompany = async () => {
      if (companyId) {
        const { data } = await supabase.from("customers").select("*").eq("company_id", companyId)
        setCustomers(data || [])
      }
    }
    fetchCustomersForCompany()
  }, [companyId, supabase])

  useEffect(() => {
    if (initialDataSource && isNew) {
      const { type, data } = initialDataSource
      setCompanyId(data.company_id)
      setCustomerId(data.customer_id || "")
      const customerForAddress = customers.find((c) => c.id === data.customer_id)
      if (customerForAddress) {
        const fullAddress = [
          customerForAddress.street,
          customerForAddress.delegation,
          customerForAddress.governorate,
          customerForAddress.country
        ].filter(Boolean).join(', ')
        setDeliveryAddress(fullAddress || customerForAddress.address || "")
      }
      setDriverName(data.driver_name || "")
      setVehicleRegistration(data.vehicle_registration || "")
      setEscomptePercentage(data.escompte_percentage || 0)
      setHasStamp(data.has_stamp || false)
      const sourceLines = type === "quote" ? data.quote_lines : data.invoice_lines
      const newLines = sourceLines.map((line: any) => ({
        local_id: crypto.randomUUID(),
        item_id: line.item_id,
        description: line.description,
        quantity: line.quantity,
        unit_price_ht: line.unit_price_ht,
        remise_percentage: line.remise_percentage || 0,
        tva_rate: line.tva_rate,
      }))
      setLines(newLines)
      if (type === "quote") setSourceDoc({ quote_id: data.id, invoice_id: null })
      if (type === "invoice") setSourceDoc({ quote_id: data.quote_id || null, invoice_id: data.id })
    }
  }, [initialDataSource, isNew, customers])

  useEffect(() => {
    if (!initialDataSource && selectedCustomer) {
      const fullAddress = [selectedCustomer.street, selectedCustomer.delegation, selectedCustomer.governorate, selectedCustomer.country].filter(Boolean).join(', ')
      setDeliveryAddress(fullAddress || selectedCustomer.address || "")
    }
  }, [selectedCustomer, initialDataSource])

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
    }
  }, [lines, escomptePercentage, isFodecApplicable, hasStamp])

  const handleLineChange = useCallback(
    (index: number, field: keyof DnLine, value: any) => {
      const newLines = [...lines]
      newLines[index][field] = value
      setLines(newLines)
    },
    [lines],
  )

  // LA CORRECTION EST ICI
  const handleItemSelect = useCallback(
    (index: number, itemId: string) => {
      const item = items.find((i: Item) => i.id === itemId);
      if (item) {
        const newLines = [...lines];
        newLines[index] = {
          ...newLines[index],
          item_id: itemId,
          description: `${item.reference ? `[${item.reference}] ` : ""}${item.name}`,
          unit_price_ht: item.sale_price || 0,
        };
        setLines(newLines);
      }
    },
    [lines, items]
  );

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
      toast.error("Veuillez sélectionner une entreprise et un client.")
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      toast.error("Le BL doit contenir au moins une ligne.")
      return
    }
    setIsLoading(true)
    try {
      if (isNew) {
        const { data: numberData, error: numberError } = await supabase.functions.invoke(
          "get-next-delivery-note-number",
          { body: JSON.stringify({ companyId }), headers: { "Content-Type": "application/json" } },
        )
        if (numberError) throw new Error("Impossible de générer le numéro de BL.")

        const dnPayload = {
          company_id: companyId,
          customer_id: customerId,
          ...sourceDoc,
          delivery_note_number: numberData.delivery_note_number,
          delivery_date: deliveryDate,
          delivery_address: deliveryAddress,
          driver_name: driverName || null,
          vehicle_registration: vehicleRegistration || null,
          notes: notes || null,
          status: "BROUILLON",
          total_ht: totals.total_ht_net,
          total_remise: totals.total_remise,
          escompte_percentage: escomptePercentage,
          total_escompte: totals.total_escompte,
          total_fodec: totals.total_fodec,
          total_tva: totals.total_tva,
          has_stamp: hasStamp,
          total_ttc: totals.total_ttc,
          is_valued: isValued,
          show_remise_column: showRemise
        }

        const { data: newDn, error: dnError } = await supabase
          .from("delivery_notes")
          .insert(dnPayload)
          .select("id")
          .single()
        if (dnError) throw new Error("Erreur lors de la création du BL.")

        const linesPayload = lines.map((line) => ({
          delivery_note_id: newDn.id,
          item_id: line.item_id,
          description: line.description,
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          remise_percentage: line.remise_percentage,
          tva_rate: line.tva_rate,
        }))
        const { error: linesError } = await supabase.from("delivery_note_lines").insert(linesPayload)
        if (linesError) throw new Error("Erreur lors de l'ajout des lignes.")

        toast.success("Bon de livraison enregistré avec succès")
        router.push("/dashboard/delivery-notes")
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informations Générales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Client</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..."/></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date de Livraison</Label><Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Adresse de Livraison</Label><Textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} rows={3} /></div>
          {selectedCustomer && (
            <div className="md:col-span-2 p-4 border rounded-md bg-muted text-sm">
              <h4 className="font-semibold mb-2">Détails du Client</h4>
              <p><strong>MF:</strong> {selectedCustomer.matricule_fiscal || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</p>
              <p><strong>Tél:</strong> {selectedCustomer.phone_number || 'N/A'}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Détails de Transport & Notes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><Label>Nom du chauffeur</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
          <div><Label>Matricule du véhicule</Label><Input value={vehicleRegistration} onChange={e => setVehicleRegistration(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Articles à Livrer</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2"><Label>Afficher Remise</Label><Switch checked={showRemise} onCheckedChange={setShowRemise} disabled={!isValued} /></div>
            <div className="flex items-center space-x-2"><Label>BL Valorisé</Label><Switch checked={isValued} onCheckedChange={setIsValued} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                {isValued && <TableHead className="text-right">Prix U. HT</TableHead>}
                {isValued && showRemise && <TableHead className="text-right">Remise %</TableHead>}
                {isValued && <TableHead className="text-right">TVA %</TableHead>}
                {isValued && <TableHead className="text-right">Total HT</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => {
                const lineTotalHT = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)
                return (
                  <TableRow key={line.local_id}>
                    <TableCell className="align-top">
                      <Command className="border rounded-md">
                        <CommandInput
                          placeholder="Rechercher..."
                          value={line.description}
                          onValueChange={(v) => handleLineChange(index, "description", v)}
                        />
                        <CommandList>
                          <CommandEmpty>Non trouvé.</CommandEmpty>
                          <CommandGroup>
                            {items
                              .filter((i: Item) => i.name.toLowerCase().includes(line.description.toLowerCase()))
                              .slice(0, 5)
                              .map((i: Item) => (
                                <CommandItem key={i.id} onSelect={() => handleItemSelect(index, i.id)}>
                                  {i.name}
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
                        className="text-right"
                      />
                    </TableCell>
                    {isValued && (
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          value={line.unit_price_ht}
                          onChange={(e) =>
                            handleLineChange(index, "unit_price_ht", Number.parseFloat(e.target.value) || 0)
                          }
                          className="text-right"
                        />
                      </TableCell>
                    )}
                    {isValued && showRemise && (
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          value={line.remise_percentage}
                          onChange={(e) =>
                            handleLineChange(index, "remise_percentage", Number.parseFloat(e.target.value) || 0)
                          }
                          className="text-right"
                        />
                      </TableCell>
                    )}
                    {isValued && (
                      <TableCell className="align-top">
                         <Select
                          value={String(line.tva_rate)}
                          onValueChange={(v) => handleLineChange(index, "tva_rate", Number.parseInt(v))}
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
                      </TableCell>
                    )}
                    {isValued && (
                      <TableCell className="align-top text-right pt-3 font-mono">
                        {lineTotalHT.toFixed(3)}
                      </TableCell>
                    )}
                    <TableCell className="align-top text-center">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <Button variant="outline" onClick={addLine} className="w-full mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Ajouter une ligne</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Link href="/dashboard/delivery-notes"><Button variant="outline">Annuler</Button></Link>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
          Enregistrer le BL
        </Button>
      </div>
    </div>
  )
}