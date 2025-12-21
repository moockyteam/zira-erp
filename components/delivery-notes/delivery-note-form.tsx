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
import { PlusCircle, Trash2, Save, CreditCard, Check, ChevronsUpDown, User } from "lucide-react"
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
}
type Item = { id: string; name: string; sale_price: number | null; reference: string | null; quantity_on_hand: number }
type DnLine = {
  local_id: string
  item_id: string | null
  description: string
  quantity: number | string
  unit_price_ht: number | string
  remise_percentage: number | string
  tva_rate: number
}

const TVA_RATES = [19, 13, 7, 0]

export function DeliveryNoteForm({
  initialData,
  initialDataSource,
  companies,
  customers: initialCustomers,
  items,
}: any) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(initialData?.company_id || companies[0]?.id || "")
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || [])
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState(initialData?.delivery_address || "")
  const [deliveryDate, setDeliveryDate] = useState(initialData?.delivery_date || format(new Date(), "yyyy-MM-dd"))
  const [lines, setLines] = useState<DnLine[]>(
    initialData?.delivery_note_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [],
  )
  const [driverName, setDriverName] = useState(initialData?.driver_name || "")
  const [vehicleRegistration, setVehicleRegistration] = useState(initialData?.vehicle_registration || "")
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isValued, setIsValued] = useState(initialData?.is_valued ?? false)
  const [showRemise, setShowRemise] = useState(initialData?.show_remise_column ?? true)
  const [bankName, setBankName] = useState(initialData?.bank_name || "")
  const [iban, setIban] = useState(initialData?.iban || "")
  const [bicSwift, setBicSwift] = useState(initialData?.bic_swift || "")
  const [rib, setRib] = useState(initialData?.rib || "")
  // Removed managerName state as it comes from company profile now
  const [showManagerName, setShowManagerName] = useState(initialData?.show_manager_name ?? false)

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customerId, customers])

  useEffect(() => {
    const fetchCustomersForCompany = async () => {
      if (companyId) {
        const { data } = await supabase.from("customers").select("*").eq("company_id", companyId)
        setCustomers(data || [])
      }
    }
    if (!initialDataSource) {
      fetchCustomersForCompany()
    }
  }, [companyId, supabase, initialDataSource])

  useEffect(() => {
    if (initialDataSource && isNew) {
      const { type, data } = initialDataSource
      setCompanyId(data.company_id)
      setCustomerId(data.customer_id || "")
      const sourceLines = type === "quote" ? data.quote_lines : data.invoice_lines
      setLines(sourceLines.map((line: any) => ({ ...line, local_id: crypto.randomUUID() })))
    }
  }, [initialDataSource, isNew])

  useEffect(() => {
    if (selectedCustomer) {
      const fullAddress = [
        selectedCustomer.street,
        selectedCustomer.delegation,
        selectedCustomer.governorate,
        selectedCustomer.country,
      ]
        .filter(Boolean)
        .join(", ")
      setDeliveryAddress(fullAddress || selectedCustomer.address || "")
    }
  }, [selectedCustomer])

  const handleLineChange = useCallback(
    (local_id: string, field: keyof DnLine, value: any) => {
      setLines(lines => lines.map(line => line.local_id === local_id ? { ...line, [field]: value } : line))
    },
    [],
  )

  const handleItemSelect = useCallback(
    (local_id: string, itemId: string) => {
      const item = items.find((i: Item) => i.id === itemId)
      if (item) {
        setLines(lines => lines.map(line => line.local_id === local_id ? {
          ...line,
          item_id: itemId,
          description: `${item.reference ? `[${item.reference}] ` : ""}${item.name}`,
          unit_price_ht: item.sale_price || 0,
        } : line))
      }
    },
    [items],
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
  const removeLine = (local_id: string) => setLines(lines.filter((l) => l.local_id !== local_id))

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

    const total_ht = isValued
      ? lines.reduce((sum, l) => {
        const qty = typeof l.quantity === 'string' ? parseFloat(l.quantity.replace(',', '.')) || 0 : l.quantity;
        const price = typeof l.unit_price_ht === 'string' ? parseFloat(l.unit_price_ht.replace(',', '.')) || 0 : l.unit_price_ht;
        const remise = typeof l.remise_percentage === 'string' ? parseFloat(l.remise_percentage.replace(',', '.')) || 0 : l.remise_percentage;
        return sum + qty * price * (1 - remise / 100)
      }, 0)
      : 0;

    const dnPayload = {
      company_id: companyId,
      customer_id: customerId,
      delivery_date: deliveryDate,
      delivery_address: deliveryAddress,
      driver_name: driverName || null,
      vehicle_registration: vehicleRegistration || null,
      notes: notes || null,
      status: "BROUILLON",
      is_valued: isValued,
      show_remise_column: showRemise,
      total_ht: total_ht,
      bank_name: bankName || null,
      iban: iban || null,
      bic_swift: bicSwift || null,
      rib: rib || null,
      // manager_name is now fetched from company profile
      show_manager_name: showManagerName,
    }

    if (isNew) {
      const { data: numberData } = await supabase.rpc("get_next_delivery_note_number", { p_company_id: companyId })

      if (!numberData) {
        toast.error("Impossible de générer un numéro de BL.");
        setIsLoading(false);
        return;
      }

      const { data: newDn, error: insertError } = await supabase.from("delivery_notes").insert({
        ...dnPayload,
        delivery_note_number: numberData
      }).select("id").single();

      if (insertError) {
        toast.error("Erreur création BL: " + insertError.message);
        setIsLoading(false);
        return;
      }

      const linesPayload = lines.map(line => ({
        delivery_note_id: newDn.id,
        item_id: line.item_id,
        description: line.description,
        quantity: typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity,
        unit_price_ht: typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht,
        remise_percentage: typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage,
        tva_rate: line.tva_rate
      }))

      if (linesPayload.length > 0) {
        const { error: linesError } = await supabase.from("delivery_note_lines").insert(linesPayload);
        if (linesError) {
          toast.error("Erreur save lignes: " + linesError.message);
        }
      }
      toast.success("Bon de Livraison créé avec succès.");

    } else {
      await supabase.from("delivery_notes").update(dnPayload).eq("id", initialData.id);
      await supabase.from("delivery_note_lines").delete().eq("delivery_note_id", initialData.id);

      const linesPayload = lines.map(line => ({
        delivery_note_id: initialData.id,
        item_id: line.item_id,
        description: line.description,
        quantity: typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity,
        unit_price_ht: typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht,
        remise_percentage: typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage,
        tva_rate: line.tva_rate
      }))

      if (linesPayload.length > 0) {
        await supabase.from("delivery_note_lines").insert(linesPayload);
      }
      toast.success("Bon de Livraison mis à jour.");
    }
    router.push("/dashboard/delivery-notes")
    router.refresh()
    setIsLoading(false)
  }

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <CardHeader>
          <CardTitle>Informations Générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Client
            </Label>
            <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCustomerPopover}
                  className="w-full justify-between font-normal"
                >
                  {customers.find((c) => c.id === customerId)?.name || "Sélectionner un client..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher un client..." />
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
                            className={cn(
                              "mr-2 h-4 w-4",
                              customerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
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
          <div>
            <Label>Date de Livraison</Label>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Adresse de Livraison</Label>
            <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={3} />
          </div>
          {selectedCustomer && (
            <div className="md:col-span-2 p-4 border rounded-md bg-muted text-sm">
              <h4 className="font-semibold mb-2">Détails du Client</h4>
              <p>
                <strong>MF:</strong> {selectedCustomer.matricule_fiscal || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {selectedCustomer.email || "N/A"}
              </p>
              <p>
                <strong>Tél:</strong> {selectedCustomer.phone_number || "N/A"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transport</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Nom Chauffeur (Optionnel)</Label>
            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div>
            <Label>Immatriculation (Optionnel)</Label>
            <Input value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2 mt-4 p-4 border rounded-md bg-muted/20">
            <div className="flex items-center space-x-3">
              <Switch id="show-manager" checked={showManagerName} onCheckedChange={setShowManagerName} />
              <div className="space-y-0.5">
                <Label htmlFor="show-manager" className="text-base">Afficher le nom du gérant</Label>
                <p className="text-xs text-muted-foreground">
                  Si activé, le nom du gérant défini dans les paramètres de l'entreprise sera affiché sur le BL.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NEW: Totals Display Section for Delivery Notes */}
      {isValued && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Récapitulatif (Valorisé)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 max-w-sm ml-auto">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-mono">
                  {lines.reduce((sum, l) => {
                    const qty = typeof l.quantity === 'string' ? parseFloat(l.quantity.replace(',', '.')) || 0 : l.quantity
                    const price = typeof l.unit_price_ht === 'string' ? parseFloat(l.unit_price_ht.replace(',', '.')) || 0 : l.unit_price_ht
                    const remise = typeof l.remise_percentage === 'string' ? parseFloat(l.remise_percentage.replace(',', '.')) || 0 : l.remise_percentage
                    return sum + (qty * price * (1 - remise / 100))
                  }, 0).toFixed(3)} TND
                </span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                <span>Total TTC (Approximatif)</span>
                <span className="font-mono">
                  {lines.reduce((sum, l) => {
                    const qty = typeof l.quantity === 'string' ? parseFloat(l.quantity.replace(',', '.')) || 0 : l.quantity
                    const price = typeof l.unit_price_ht === 'string' ? parseFloat(l.unit_price_ht.replace(',', '.')) || 0 : l.unit_price_ht
                    const remise = typeof l.remise_percentage === 'string' ? parseFloat(l.remise_percentage.replace(',', '.')) || 0 : l.remise_percentage
                    const tva = l.tva_rate || 0
                    return sum + (qty * price * (1 - remise / 100) * (1 + tva / 100))
                  }, 0).toFixed(3)} TND
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes de BL</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="valued-switch">Valorisée ?</Label>
            <Switch id="valued-switch" checked={isValued} onCheckedChange={setIsValued} />
            <div className="w-4"></div>
            <Label htmlFor="remise-switch">Remise ?</Label>
            <Switch id="remise-switch" checked={showRemise} onCheckedChange={setShowRemise} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Article</TableHead>
                  <TableHead>Qté</TableHead>
                  {isValued && <TableHead>Prix U. HT</TableHead>}
                  {isValued && showRemise && <TableHead>Remise %</TableHead>}
                  {isValued && <TableHead>TVA %</TableHead>}
                  {isValued && <TableHead>Total HT</TableHead>}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.local_id}>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-[300px] justify-between font-normal">
                            {line.description || "Sélectionner article..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Rechercher article..."
                              onValueChange={(val) => handleLineChange(line.local_id, "description", val)}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => handleLineChange(line.local_id, "description", document.querySelector('[cmdk-input]')?.getAttribute('value') || "")}>
                                  Utiliser comme texte libre
                                </Button>
                              </CommandEmpty>
                              <CommandGroup>
                                {items.map((item: any) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.name}
                                    onSelect={() => handleItemSelect(line.local_id, item.id)}
                                  >
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
                    <TableCell>
                      <Input
                        type="text"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(line.local_id, "quantity", e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    {isValued && (
                      <TableCell>
                        <Input
                          type="text"
                          value={line.unit_price_ht}
                          onChange={(e) => handleLineChange(line.local_id, "unit_price_ht", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                    )}
                    {isValued && showRemise && (
                      <TableCell>
                        <Input
                          type="text"
                          value={line.remise_percentage}
                          onChange={(e) => handleLineChange(line.local_id, "remise_percentage", e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                    )}
                    {isValued && (
                      <TableCell>
                        <Select
                          value={String(line.tva_rate)}
                          onValueChange={(v) => handleLineChange(line.local_id, "tva_rate", Number.parseInt(v))}
                        >
                          <SelectTrigger className="w-20">
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
                      <TableCell className="font-mono">
                        {(
                          (typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity) *
                          (typeof line.unit_price_ht === 'string' ? parseFloat(line.unit_price_ht.replace(',', '.')) || 0 : line.unit_price_ht) *
                          (1 - (typeof line.remise_percentage === 'string' ? parseFloat(line.remise_percentage.replace(',', '.')) || 0 : line.remise_percentage) / 100)
                        ).toFixed(3)}
                      </TableCell>
                    )}

                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(line.local_id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" className="mt-4" onClick={addLine}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 border-t z-10">
        <Link href="/dashboard/delivery-notes">
          <Button variant="outline">Annuler</Button>
        </Link>
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
