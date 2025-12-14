// components/returns/return-voucher-form.tsx

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Trash2, Save } from "lucide-react"
import { CustomerHistoryDialog } from "./customer-history-dialog"

type ReturnLine = { local_id: string; item_id: string | null; quantity: number; reason: string }

export function ReturnVoucherForm({ isOpen, onOpenChange, companyId, initialData, onSuccess }: any) {
  // --- LOGS DE DÉBOGAGE AJOUTÉS ---
  console.log("--- [FORMULAIRE] Le composant se charge ---");
  console.log("--- [FORMULAIRE] Données initiales reçues (initialData):", JSON.stringify(initialData, null, 2));

  const supabase = createClient()
  const isNew = !initialData

  const [customers, setCustomers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  
  // Initialisation des champs simples via useState (ne change que si le composant est remonté)
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "")
  const [returnDate, setReturnDate] = useState(initialData?.return_date || format(new Date(), "yyyy-MM-dd"))
  const [sourceDocRef, setSourceDocRef] = useState(initialData?.source_document_ref || "")
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [driverName, setDriverName] = useState(initialData?.driver_name || "")
  const [vehicleReg, setVehicleReg] = useState(initialData?.vehicle_registration || "")
  
  // Modification ici : lines démarre vide, sera rempli par le useEffect
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    console.log("--- [FORMULAIRE] useEffect se déclenche ---");
    console.log("--- [FORMULAIRE] initialData dans useEffect:", JSON.stringify(initialData, null, 2));
    
    // 1. Gestion des lignes depuis initialData
    if (initialData && initialData.return_voucher_lines) {
      console.log("--- [FORMULAIRE] LIGNES TROUVÉES dans initialData. Nombre de lignes:", initialData.return_voucher_lines.length);
      const mappedLines = initialData.return_voucher_lines.map((l: any) => ({ ...l, local_id: crypto.randomUUID() }));
      console.log("--- [FORMULAIRE] Lignes après mapping:", mappedLines);
      setLines(mappedLines);
    } else {
      console.log("--- [FORMULAIRE] AUCUNE LIGNE TROUVÉE dans initialData, ou c'est un nouveau BR.");
      setLines([]); // On s'assure que c'est vide si rien n'est trouvé
    }

    // 2. Récupération des données référentielles (Clients / Articles)
    const fetchInitialData = async () => {
      if (companyId) {
        const [customerRes, itemsRes] = await Promise.all([
          supabase.from("customers").select("id, name").eq("company_id", companyId),
          supabase.from("items").select("id, name, reference").eq("company_id", companyId).eq("is_archived", false)
        ])
        setCustomers(customerRes.data || [])
        setItems(itemsRes.data || [])
      }
    }

    if (isOpen) {
      fetchInitialData()
    }
  }, [isOpen, initialData, companyId, supabase])

  const addLine = () => setLines([...lines, { local_id: crypto.randomUUID(), item_id: null, quantity: 1, reason: "" }])
  const removeLine = (local_id: string) => setLines(lines.filter(l => l.local_id !== local_id))
  const updateLine = (local_id: string, updatedValues: Partial<ReturnLine>) => {
    setLines(lines.map(l => l.local_id === local_id ? { ...l, ...updatedValues } : l))
  }

  const handleSave = async () => {
    if (!customerId || lines.length === 0 || lines.some(l => !l.item_id)) {
      toast.error("Veuillez sélectionner un client et ajouter au moins un article pour chaque ligne.")
      return
    }
    setIsSaving(true)
    
    const payload = {
      company_id: companyId, 
      customer_id: customerId, 
      return_date: returnDate,
      source_document_ref: sourceDocRef, 
      notes: notes, 
      status: initialData?.status || "BROUILLON",
      driver_name: driverName, 
      vehicle_registration: vehicleReg,
    }
    
    // On prépare les lignes en retirant l'ID local qui n'est pas dans la DB
    const linesPayload = lines.map(l => ({ 
      item_id: l.item_id, 
      quantity: l.quantity, 
      reason: l.reason 
    }))

    if (isNew) {
      // Étape 1: Créer le bon de retour principal
      const { data: numberData, error: rpcError } = await supabase.rpc('get_next_return_voucher_number', { p_company_id: companyId })
      if (rpcError || !numberData) {
        toast.error("Impossible de générer un numéro de bon de retour.");
        setIsSaving(false);
        return;
      }

      const { data: newReturn, error: returnError } = await supabase.from("return_vouchers").insert({ ...payload, return_voucher_number: numberData }).select().single()
      if (returnError) { toast.error(returnError.message); setIsSaving(false); return }
      
      // Étape 2: Insérer les lignes en les liant au nouveau bon de retour
      if (linesPayload.length > 0) {
        const linesToInsert = linesPayload.map(line => ({ ...line, return_voucher_id: newReturn.id }))
        const { error: linesError } = await supabase.from("return_voucher_lines").insert(linesToInsert)
        if (linesError) {
          toast.error("Erreur lors de l'ajout des articles: " + linesError.message);
          setIsSaving(false);
          return;
        }
      }
    } else { // Mode Mise à jour
      // Étape 1: Mettre à jour le bon de retour principal
      const { error: updateError } = await supabase.from("return_vouchers").update(payload).eq("id", initialData.id)
      if (updateError) { toast.error(updateError.message); setIsSaving(false); return }

      // Étape 2: Supprimer les anciennes lignes
      await supabase.from("return_voucher_lines").delete().eq("return_voucher_id", initialData.id)

      // Étape 3: Insérer les nouvelles lignes
      if (linesPayload.length > 0) {
        const linesToInsert = linesPayload.map(line => ({ ...line, return_voucher_id: initialData.id }))
        const { error: linesError } = await supabase.from("return_voucher_lines").insert(linesToInsert)
        if (linesError) {
          toast.error("Erreur lors de la mise à jour des articles: " + linesError.message);
          setIsSaving(false);
          return;
        }
      }
    }

    toast.success("Bon de retour sauvegardé.")
    onSuccess()
    onOpenChange(false)
    setIsSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{isNew ? "Créer un Bon de Retour" : `Modifier le BR N° ${initialData?.return_voucher_number}`}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto pr-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Client *</Label>
              <div className="flex items-center gap-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client..."/></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                {customerId && (
                  <CustomerHistoryDialog 
                    customerId={customerId} 
                    onSelect={(docNumber) => setSourceDocRef(docNumber)} 
                  />
                )}
              </div>
            </div>
            <div><Label>Date du Retour *</Label><Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} /></div>
            <div><Label>Réf. Document d'Origine</Label><Input placeholder="Utiliser l'historique ou saisir manuellement..." value={sourceDocRef} onChange={e => setSourceDocRef(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div><Label>Chauffeur</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
            <div><Label>Véhicule</Label><Input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} /></div>
          </div>
          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Articles Retournés</h3>
            <div className="space-y-2">
              {lines.map(line => (
                <div key={line.local_id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><Select value={line.item_id || ''} onValueChange={v => updateLine(line.local_id, { item_id: v })}><SelectTrigger><SelectValue placeholder="Article..."/></SelectTrigger><SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="col-span-2"><Input type="number" placeholder="Qté" value={line.quantity} onChange={e => updateLine(line.local_id, { quantity: parseFloat(e.target.value) || 1 })} /></div>
                  <div className="col-span-4"><Input placeholder="Raison du retour..." value={line.reason} onChange={e => updateLine(line.local_id, { reason: e.target.value })} /></div>
                  <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeLine(line.local_id)}><Trash2 className="h-4 w-4 text-red-500"/></Button></div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={addLine} className="w-full mt-2"><PlusCircle className="mr-2 h-4 w-4"/>Ajouter un article</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4"/>Sauvegarder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}