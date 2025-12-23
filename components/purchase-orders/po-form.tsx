"use client"
import { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Plus, Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string }
type Supplier = { id: string; name: string }
type Item = { id: string; name: string; reference: string | null }
type POLine = {
  local_id: string
  item_id: string | null
  description: string
  quantity: number | string
  purchase_price_ht: number | string
  tva_rate: number
}

const TVA_RATES = [19, 13, 7, 0]

interface POFormProps {
  initialData: any | null
  companies: Company[]
  suppliers: Supplier[]
  items: Item[]
}

export function PurchaseOrderForm({ initialData, companies, suppliers, items }: POFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isNew = !initialData

  const [companyId, setCompanyId] = useState(
    initialData?.company_id || searchParams.get("companyId") || companies[0]?.id || "",
  )
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id || "")
  const [orderDate, setOrderDate] = useState(initialData?.order_date || format(new Date(), "yyyy-MM-dd"))
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(initialData?.expected_delivery_date || "")
  const [shippingAddress, setShippingAddress] = useState(initialData?.shipping_address || "")
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [lines, setLines] = useState<POLine[]>(
    initialData?.purchase_order_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [],
  )
  const [isSaving, setIsSaving] = useState(false)

  const totals = useMemo(() => {
    // Conversion sécurisée
    const safeLines = lines.map(l => ({
      ...l,
      quantity: typeof l.quantity === 'string' ? parseFloat(l.quantity.replace(',', '.')) || 0 : l.quantity,
      purchase_price_ht: typeof l.purchase_price_ht === 'string' ? parseFloat(l.purchase_price_ht.replace(',', '.')) || 0 : l.purchase_price_ht,
    }))

    const total_ht = safeLines.reduce((sum, line) => sum + (line.quantity || 0) * (line.purchase_price_ht || 0), 0)
    const total_tva = safeLines.reduce(
      (sum, line) => sum + (line.quantity || 0) * (line.purchase_price_ht || 0) * ((line.tva_rate || 0) / 100),
      0,
    )
    const total_ttc = total_ht + total_tva
    return { total_ht, total_tva, total_ttc }
  }, [lines])

  const addLine = () =>
    setLines([
      ...lines,
      {
        local_id: crypto.randomUUID(),
        item_id: null,
        description: "",
        quantity: 1,
        purchase_price_ht: 0,
        tva_rate: 19,
      },
    ])
  const removeLine = (local_id: string) => setLines(lines.filter((l) => l.local_id !== local_id))

  const updateLine = (local_id: string, updatedValues: Partial<POLine>) => {
    setLines(lines.map((l) => (l.local_id === local_id ? { ...l, ...updatedValues } : l)))
  }

  const handleItemSelect = useCallback(
    (local_id: string, itemId: string) => {
      const selectedItem = items.find((item) => item.id === itemId)
      if (selectedItem) {
        updateLine(local_id, {
          item_id: itemId,
          description: `${selectedItem.reference ? `[${selectedItem.reference}] ` : ""}${selectedItem.name}`,
        })
      }
    },
    [items, lines],
  )

  const handleSave = async () => {
    if (!companyId || !supplierId) {
      toast.error("Veuillez sélectionner une société et un fournisseur.")
      return
    }
    setIsSaving(true)
    const poPayload = {
      company_id: companyId,
      supplier_id: supplierId,
      order_date: orderDate,
      expected_delivery_date: expectedDeliveryDate || null,
      shipping_address: shippingAddress,
      notes: notes,
      status: initialData?.status || "BROUILLON",
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
    }

    const linesPayload = lines.map((line) => {
      const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity.replace(',', '.')) || 0 : line.quantity;
      const price = typeof line.purchase_price_ht === 'string' ? parseFloat(line.purchase_price_ht.replace(',', '.')) || 0 : line.purchase_price_ht;

      return {
        item_id: line.item_id,
        description: line.description,
        quantity: qty,
        purchase_price_ht: price,
        tva_rate: line.tva_rate || 0,
        line_total_ht: qty * price,
      }
    })

    if (isNew) {
      const { data: nextNumber, error: rpcError } = await supabase.rpc("get_next_po_number", {
        p_company_id: companyId,
      })
      if (rpcError || !nextNumber) {
        toast.error("Impossible de générer un numéro de commande.", { description: rpcError?.message })
        setIsSaving(false)
        return
      }
      const { data: newPO, error } = await supabase
        .from("purchase_orders")
        .insert({ ...poPayload, po_number: nextNumber })
        .select("id")
        .single()
      if (error) {
        toast.error(error.message)
        setIsSaving(false)
        return
      }
      if (lines.length > 0) {
        await supabase
          .from("purchase_order_lines")
          .insert(linesPayload.map((l) => ({ ...l, purchase_order_id: newPO.id })))
      }
    } else {
      await supabase.from("purchase_orders").update(poPayload).eq("id", initialData.id)
      await supabase.from("purchase_order_lines").delete().eq("purchase_order_id", initialData.id)
      if (lines.length > 0) {
        await supabase
          .from("purchase_order_lines")
          .insert(linesPayload.map((l) => ({ ...l, purchase_order_id: initialData.id })))
      }
    }
    toast.success("Bon de commande sauvegardé.")
    router.push("/dashboard/purchase-orders")
    router.refresh()
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations Générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Société</Label>
            <Select value={companyId} onValueChange={setCompanyId} disabled={!isNew}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c: Company) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fournisseur</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s: Supplier) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date de commande</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <Label>Date de livraison prévue</Label>
            <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Adresse de livraison</Label>
            <Textarea
              placeholder="Par défaut, l'adresse de votre société..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Articles Commandés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.local_id} className="grid grid-cols-12 gap-2 items-start p-2 border rounded-md">
                <div className="col-span-4">
                  <Label>Article / Description</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-start text-left font-normal truncate mt-1">
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
                            <Button variant="ghost" className="w-full justify-start" onClick={() => updateLine(line.local_id, { description: document.querySelector('[cmdk-input]')?.getAttribute('value') || "Nouvelle ligne" })}>
                              Utiliser comme description libre
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {items.map(item => (
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
                </div>
                <div className="col-span-2">
                  <Label>Qté</Label>
                  <Input
                    className="mt-1"
                    type="text"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.local_id, { quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <Label>Prix Achat HT</Label>
                  <Input
                    className="mt-1"
                    type="text"
                    value={line.purchase_price_ht}
                    onChange={(e) => updateLine(line.local_id, { purchase_price_ht: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>TVA %</Label>
                  <Select
                    value={String(line.tva_rate)}
                    onValueChange={(v) => updateLine(line.local_id, { tva_rate: Number.parseFloat(v) })}
                  >
                    <SelectTrigger className="mt-1">
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
                <div className="col-span-1 flex items-end h-full mb-1">
                  <Button variant="ghost" size="icon" onClick={() => removeLine(line.local_id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addLine} className="w-full mt-4 bg-transparent border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une ligne
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totaux et Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Notes internes</Label>
            <Textarea
              placeholder="Informations pour votre équipe..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2 p-4 bg-muted rounded-md">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span>{totals.total_ht.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between">
              <span>Total TVA</span>
              <span>{totals.total_tva.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
              <span>Total TTC</span>
              <span>{totals.total_ttc.toFixed(3)} TND</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
        <Link href="/dashboard/purchase-orders">
          <Button variant="outline" size="lg">
            Annuler
          </Button>
        </Link>
      </div>
    </div>
  )
}
