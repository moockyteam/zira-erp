// components/delivery-notes/delivery-note-form.tsx

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
import { PlusCircle, Trash2, Save, CreditCard } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { NumericInput } from "@/components/ui/numeric-input"

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
  quantity: number
  unit_price_ht: number
  remise_percentage: number
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
    (index: number, field: keyof DnLine, value: any) => {
      const newLines = [...lines]
      newLines[index][field] = value
      setLines(newLines)
    },
    [lines],
  )

  const handleItemSelect = useCallback(
    (index: number, itemId: string) => {
      const item = items.find((i: Item) => i.id === itemId)
      if (item) {
        const newLines = [...lines]
        newLines[index] = {
          ...newLines[index],
          item_id: itemId,
          description: `${item.reference ? `[${item.reference}] ` : ""}${item.name}`,
          unit_price_ht: item.sale_price || 0,
        }
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
      toast.error("Veuillez sélectionner une entreprise et un client.")
      return
    }
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) {
      toast.error("Le BL doit contenir au moins une ligne.")
      return
    }
    setIsLoading(true)

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
      total_ht: isValued
        ? lines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht * (1 - (l.remise_percentage || 0) / 100), 0)
        : 0,
      bank_name: bankName || null,
      iban: iban || null,
      bic_swift: bicSwift || null,
      rib: rib || null,
    }

    if (isNew) {
      const { data: numberData } = await supabase.rpc("get_next_delivery_note_number", { p_company_id: companyId })
      const { data: newDn, error } = await supabase
        .from("delivery_notes")
        .insert({ ...dnPayload, delivery_note_number: numberData })
        .select("id")
        .single()
      if (error) {
        toast.error(error.message)
        setIsLoading(false)
        return
      }

      const linesPayload = lines.map((line) => ({ ...line, delivery_note_id: newDn.id }))
      await supabase.from("delivery_note_lines").insert(linesPayload)
    } else {
      // Logique de mise à jour
    }

    toast.success("Bon de livraison sauvegardé.")
    router.push("/dashboard/delivery-notes")
    router.refresh()
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations Générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Client</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <CardTitle>Détails de Transport & Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Nom du chauffeur</Label>
            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div>
            <Label>Matricule du véhicule</Label>
            <Input value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Articles à Livrer</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Label>Afficher Remise</Label>
              <Switch checked={showRemise} onCheckedChange={setShowRemise} disabled={!isValued} />
            </div>
            <div className="flex items-center space-x-2">
              <Label>BL Valorisé</Label>
              <Switch checked={isValued} onCheckedChange={setIsValued} />
            </div>
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
                {isValued && <TableHead className="text-right">Prix U. TTC</TableHead>}
                {isValued && <TableHead className="text-right">Total HT</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => {
                const unitPriceTTC = line.unit_price_ht * (1 + line.tva_rate / 100)
                const lineTotalHT = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)
                return (
                  <TableRow key={line.local_id}>
                    <TableCell className="align-top">
                      <Command>
                        <CommandInput
                          placeholder="Rechercher un article..."
                          value={line.description}
                          onValueChange={(v) => handleLineChange(index, "description", v)}
                        />
                        <CommandList>
                          <CommandEmpty>Aucun article trouvé.</CommandEmpty>
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
                      <NumericInput
                        value={line.quantity}
                        onChange={(e) => handleLineChange(index, "quantity", Number(e.target.value))}
                        className="text-right"
                        decimals={3}
                      />
                    </TableCell>
                    {isValued && (
                      <TableCell className="align-top">
                        <NumericInput
                          value={line.unit_price_ht}
                          onChange={(e) => handleLineChange(index, "unit_price_ht", Number(e.target.value))}
                          className="text-right"
                          decimals={3}
                        />
                      </TableCell>
                    )}
                    {isValued && showRemise && (
                      <TableCell className="align-top">
                        <NumericInput
                          value={line.remise_percentage}
                          onChange={(e) => handleLineChange(index, "remise_percentage", Number(e.target.value))}
                          className="text-right"
                          decimals={2}
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
                      <TableCell className="align-top text-right pt-3 font-mono text-muted-foreground">
                        {unitPriceTTC.toFixed(3)}
                      </TableCell>
                    )}
                    {isValued && (
                      <TableCell className="align-top text-right pt-3 font-mono">{lineTotalHT.toFixed(3)}</TableCell>
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
          <Button variant="outline" onClick={addLine} className="w-full mt-4 bg-transparent">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter une ligne
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Coordonnées Bancaires (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Nom de la Banque</Label>
              <Input
                id="bank_name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ex: Banque de Tunisie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rib">RIB</Label>
              <Input
                id="rib"
                value={rib}
                onChange={(e) => setRib(e.target.value)}
                placeholder="Ex: 12345678901234567890"
                maxLength={24}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                placeholder="Ex: TN59 1234 5678 9012 3456 7890"
                maxLength={34}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic_swift">Code BIC/SWIFT</Label>
              <Input
                id="bic_swift"
                value={bicSwift}
                onChange={(e) => setBicSwift(e.target.value.toUpperCase())}
                placeholder="Ex: BTUBTNTT"
                maxLength={11}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Link href="/dashboard/delivery-notes">
          <Button variant="outline">Annuler</Button>
        </Link>
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          Enregistrer le BL
        </Button>
      </div>
    </div>
  )
}
