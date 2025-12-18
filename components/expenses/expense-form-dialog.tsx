"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { v4 as uuidv4 } from "uuid"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CategoryCreator } from "@/components/category-creator"
import { Loader2, Save } from "lucide-react"

const WITHHOLDING_TAX_RATE = 0.015

export function ExpenseFormDialog({ isOpen, onOpenChange, companyId, onSuccess }: any) {
  const supabase = createClient()
  const [categories, setCategories] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  const [categoryId, setCategoryId] = useState("")
  const [beneficiary, setBeneficiary] = useState("")
  const [totalHT, setTotalHT] = useState("")
  const [totalTVA, setTotalTVA] = useState("")
  const [hasWithholdingTax, setHasWithholdingTax] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("Virement")
  const [dueDate, setDueDate] = useState("")
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [reference, setReference] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [currency, setCurrency] = useState<string>("TND")

  const isDeferredPayment = paymentMethod === "Chèque" || paymentMethod === "Traite"
  const totalTTC = (Number.parseFloat(totalHT) || 0) + (Number.parseFloat(totalTVA) || 0)
  const withholdingAmount = hasWithholdingTax ? (Number.parseFloat(totalHT) || 0) * WITHHOLDING_TAX_RATE : 0
  const netToPay = totalTTC - withholdingAmount

  const formatAmount = (value: number) => {
    const decimals = currency === "TND" ? 3 : 2
    return value.toFixed(decimals)
  }

  const fetchDropdownData = async () => {
    if (companyId) {
      // --- MODIFICATION ICI ---
      // On utilise .or() pour récupérer les globales (NULL) et celles de l'entreprise
      const [catRes, supRes] = await Promise.all([
        supabase
          .from("expense_categories")
          .select("*")
          .or(`company_id.is.null,company_id.eq.${companyId}`)
          .order("name"),
        supabase.from("suppliers").select("id, name").eq("company_id", companyId),
      ])
      // ------------------------
      setCategories(catRes.data || [])
      setSuppliers(supRes.data || [])
    }
  }

  useEffect(() => {
    if (isOpen) fetchDropdownData()
  }, [isOpen, companyId])

  const handleSave = async () => {
    setIsSaving(true)
    let attachment_url = null
    if (attachmentFile) {
      const filePath = `${companyId}/${uuidv4()}`
      const { error: uploadError } = await supabase.storage.from("expense_attachments").upload(filePath, attachmentFile)
      if (uploadError) {
        toast.error("Erreur d'upload: " + uploadError.message)
        setIsSaving(false)
        return
      }
      attachment_url = supabase.storage.from("expense_attachments").getPublicUrl(filePath).data.publicUrl
    }

    const payload = {
      company_id: companyId,
      category_id: categoryId || null,
      beneficiary,
      total_ht: Number.parseFloat(totalHT) || 0,
      total_tva: Number.parseFloat(totalTVA) || 0,
      total_ttc: totalTTC,
      has_withholding_tax: hasWithholdingTax,
      withholding_tax_amount: withholdingAmount,
      payment_date: isDeferredPayment ? null : paymentDate,
      due_date: isDeferredPayment ? dueDate : null,
      payment_method: paymentMethod,
      reference,
      status: isDeferredPayment ? "EN_ATTENTE" : "PAYE",
      attachment_url,
      currency: currency, // Added currency to payload
    }
    const { error } = await supabase.from("expenses").insert(payload)
    if (error) toast.error(error.message)
    else {
      toast.success("Dépense enregistrée.")
      onSuccess()
      onOpenChange(false)
    }
    setIsSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une Dépense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">1. Bénéficiaire</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Catégorie de Dépense</Label>
                <div className="flex gap-2">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CategoryCreator
                    companyId={companyId}
                    tableName="expense_categories"
                    onCategoryCreated={fetchDropdownData}
                  />
                </div>
              </div>
              <div>
                <Label>Nom du Bénéficiaire</Label>
                <Input
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="Fournisseur, CNSS, STEG..."
                />
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">2. Montants</h3>
            <div className="mb-4">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">TND (Dinar Tunisien)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Montant HT</Label>
                <Input type="number" value={totalHT} onChange={(e) => setTotalHT(e.target.value)} />
              </div>
              <div>
                <Label>Montant TVA</Label>
                <Input type="number" value={totalTVA} onChange={(e) => setTotalTVA(e.target.value)} />
              </div>
              <div>
                <Label>Montant TTC</Label>
                <Input type="number" value={formatAmount(totalTTC)} disabled className="font-bold" />
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-4">
              <Switch id="withholding-tax" checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
              <Label htmlFor="withholding-tax">Appliquer la retenue à la source (1.5%)</Label>
            </div>
            {hasWithholdingTax && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Montant Retenue</Label>
                  <Input value={formatAmount(withholdingAmount)} disabled />
                </div>
                <div>
                  <Label>Net à Payer</Label>
                  <Input value={formatAmount(netToPay)} disabled className="font-bold" />
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">3. Modalités de Paiement</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Méthode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                    <SelectItem value="Traite">Traite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isDeferredPayment ? (
                <div>
                  <Label>Date d'Échéance</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              ) : (
                <div>
                  <Label>Date de Paiement</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              )}
              {isDeferredPayment && (
                <div>
                  <Label>N° Chèque/Traite</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">4. Pièce Jointe</h3>
            <div>
              <Label>Facture ou Justificatif</Label>
              <Input type="file" onChange={(e) => setAttachmentFile(e.target.files ? e.target.files[0] : null)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
