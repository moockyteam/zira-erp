"use client"
import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
type Company = { id: string; name: string }
type Supplier = { id: string; name: string }
type Item = { id: string; name: string; reference: string | null }
type POLine = {
local_id: string;
item_id: string | null;
description: string;
quantity: number;
purchase_price_ht: number;
tva_rate: number;
}
const TVA_RATES = [19, 13, 7, 0]
interface POFormProps {
initialData: any | null;
companies: Company[];
suppliers: Supplier[];
items: Item[];
}
export function PurchaseOrderForm({ initialData, companies, suppliers, items }: POFormProps) {
const router = useRouter()
const searchParams = useSearchParams()
const supabase = createClient()
const isNew = !initialData
const [companyId, setCompanyId] = useState(initialData?.company_id || searchParams.get("companyId") || companies[0]?.id || "")
const [supplierId, setSupplierId] = useState(initialData?.supplier_id || "")
const [orderDate, setOrderDate] = useState(initialData?.order_date || new Date().toISOString().split("T")[0])
const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(initialData?.expected_delivery_date || '')
const [shippingAddress, setShippingAddress] = useState(initialData?.shipping_address || '')
const [notes, setNotes] = useState(initialData?.notes || '')
const [lines, setLines] = useState<POLine[]>(initialData?.purchase_order_lines?.map((l: any) => ({ ...l, local_id: crypto.randomUUID() })) || [])
const [isSaving, setIsSaving] = useState(false)
useEffect(() => {
if (isNew && searchParams.get('supplierId')) {
setSupplierId(searchParams.get('supplierId')!)
const newLine: POLine = {
local_id: crypto.randomUUID(),
item_id: searchParams.get('itemId') || null,
description: searchParams.get('description') || '',
quantity: parseInt(searchParams.get('quantity') || '1'),
purchase_price_ht: parseFloat(searchParams.get('price') || '0'),
tva_rate: 19,
}
setLines([newLine])
}
}, [searchParams, isNew])
const totals = useMemo(() => {
const total_ht = lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.purchase_price_ht || 0), 0)
const total_tva = lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.purchase_price_ht || 0) * ((line.tva_rate || 0) / 100), 0)
const total_ttc = total_ht + total_tva
return { total_ht, total_tva, total_ttc }
}, [lines])
const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: null, description: "", quantity: 1, purchase_price_ht: 0, tva_rate: 19 }])
const removeLine = (local_id: string) => setLines(lines.filter(l => l.local_id !== local_id))
const updateLine = (local_id: string, updatedValues: Partial<POLine>) => {
setLines(lines.map(l => l.local_id === local_id ? { ...l, ...updatedValues } : l))
}
const handleSave = async () => {
if (!companyId || !supplierId) {
toast.error("Veuillez sélectionner une société et un fournisseur.")
return
}
setIsSaving(true)
const poPayload = {
  company_id: companyId, supplier_id: supplierId, order_date: orderDate,
  expected_delivery_date: expectedDeliveryDate || null, shipping_address: shippingAddress,
  notes: notes, status: initialData?.status || "BROUILLON",
  total_ht: totals.total_ht, total_tva: totals.total_tva, total_ttc: totals.total_ttc,
}

const linesPayload = lines.map(line => ({
  item_id: line.item_id, description: line.description, quantity: line.quantity || 0,
  purchase_price_ht: line.purchase_price_ht || 0, tva_rate: line.tva_rate || 0,
  line_total_ht: (line.quantity || 0) * (line.purchase_price_ht || 0),
}))

if (isNew) {
  const { data: nextNumber, error: rpcError } = await supabase.rpc('get_next_po_number', { p_company_id: companyId })
  if (rpcError || !nextNumber) {
    toast.error("Impossible de générer un numéro de commande.", { description: rpcError?.message });
    setIsSaving(false);
    return;
  }

  const { data: newPO, error } = await supabase.from("purchase_orders").insert({ ...poPayload, po_number: nextNumber }).select("id").single()
  if (error) { toast.error(error.message); setIsSaving(false); return }
  if (lines.length > 0) {
    await supabase.from("purchase_order_lines").insert(linesPayload.map(l => ({ ...l, purchase_order_id: newPO.id })))
  }
} else {
  await supabase.from("purchase_orders").update(poPayload).eq("id", initialData.id)
  await supabase.from("purchase_order_lines").delete().eq("purchase_order_id", initialData.id)
  if (lines.length > 0) {
    await supabase.from("purchase_order_lines").insert(linesPayload.map(l => ({ ...l, purchase_order_id: initialData.id })))
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
<CardHeader><CardTitle>Informations Générales</CardTitle></CardHeader>
<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div><Label>Société</Label><Select value={companyId} onValueChange={setCompanyId} disabled={!isNew}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
<div><Label>Fournisseur</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Sélectionner..."/></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
<div><Label>Date de commande</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
<div><Label>Date de livraison prévue</Label><Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} /></div>
<div className="md:col-span-2"><Label>Adresse de livraison</Label><Textarea placeholder="Par défaut, l'adresse de votre société..." value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} /></div>
</CardContent>
</Card>
<Card>
    <CardHeader><CardTitle>Articles Commandés</CardTitle></CardHeader>
    <CardContent>
      <div className="grid grid-cols-12 gap-2 items-center px-2 pb-2 border-b mb-2">
        <div className="col-span-4 text-sm font-semibold text-muted-foreground">Description</div>
        <div className="col-span-2 text-sm font-semibold text-muted-foreground">Qté</div>
        <div className="col-span-3 text-sm font-semibold text-muted-foreground">Prix Achat HT</div>
        <div className="col-span-2 text-sm font-semibold text-muted-foreground">TVA %</div>
        <div className="col-span-1"></div>
      </div>
      <div className="space-y-2">
        {lines.map(line => (
          <div key={line.local_id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4"><Input placeholder="Article ou service..." value={line.description} onChange={e => updateLine(line.local_id, { description: e.target.value })} /></div>
            <div className="col-span-2"><Input type="number" placeholder="1" value={line.quantity} onChange={e => updateLine(line.local_id, { quantity: parseFloat(e.target.value) || 0 })} /></div>
            <div className="col-span-3"><Input type="number" placeholder="0.000" value={line.purchase_price_ht} onChange={e => updateLine(line.local_id, { purchase_price_ht: parseFloat(e.target.value) || 0 })} /></div>
            <div className="col-span-2"><Select value={String(line.tva_rate)} onValueChange={v => updateLine(line.local_id, { tva_rate: parseFloat(v) })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TVA_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-1 flex justify-center"><Button variant="ghost" size="icon" onClick={() => removeLine(line.local_id)}><Trash2 className="h-4 w-4 text-red-500"/></Button></div>
          </div>
        ))}
      </div>
      <Button variant="outline" onClick={addLine} className="w-full mt-4 border-dashed"><Plus className="mr-2 h-4 w-4"/>Ajouter une ligne</Button>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>Totaux et Notes</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div><Label>Notes internes</Label><Textarea placeholder="Informations pour votre équipe..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="space-y-2 p-4 bg-muted rounded-md">
        <div className="flex justify-between"><span>Total HT</span><span>{totals.total_ht.toFixed(3)} TND</span></div>
        <div className="flex justify-between"><span>Total TVA</span><span>{totals.total_tva.toFixed(3)} TND</span></div>
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total TTC</span><span>{totals.total_ttc.toFixed(3)} TND</span></div>
      </div>
    </CardContent>
  </Card>

  <div className="flex gap-4 pt-4 border-t">
    <Button onClick={handleSave} disabled={isSaving} size="lg">{isSaving ? "Sauvegarde..." : "Sauvegarder"}</Button>
    <Link href="/dashboard/purchase-orders"><Button variant="outline" size="lg">Annuler</Button></Link>
  </div>
</div>
)
}