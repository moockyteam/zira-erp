"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { format, addMonths, addWeeks, addYears } from "date-fns"
import { v4 as uuidv4 } from "uuid"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CategoryCreator } from "@/components/category-creator"
import { Loader2 } from "lucide-react"

const TVA_RATES = [19, 13, 7, 0]
const WITHHOLDING_TAX_RATES = [
  { label: "15%", value: 0.15 },
  { label: "10%", value: 0.1 },
  { label: "1.5%", value: 0.015 },
  { label: "1%", value: 0.01 },
  { label: "0.5%", value: 0.005 },
]

export function ExpenseForm({ companies = [] }: { companies: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    const paramId = searchParams.get("companyId")
    if (paramId) return paramId
    if (companies && companies.length === 1) return companies[0].id
    return ""
  })

  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [beneficiary, setBeneficiary] = useState("")
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [isVatApplicable, setIsVatApplicable] = useState(false)
  const [tvaBases, setTvaBases] = useState<{ [key: number]: string }>({})
  const [totalAmount, setTotalAmount] = useState("")
  const [hasWithholdingTax, setHasWithholdingTax] = useState(false)
  const [withholdingTaxRate, setWithholdingTaxRate] = useState(0.015)
  const [paymentMethod, setPaymentMethod] = useState("Virement")
  const [dueDate, setDueDate] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // États pour récurrence
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<string>("MENSUEL")
  const [recurringStartDate, setRecurringStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [recurringEndDate, setRecurringEndDate] = useState("")
  const [recurringTitle, setRecurringTitle] = useState("")

  // États pour échéancier
  const [hasPaymentSchedule, setHasPaymentSchedule] = useState(false)
  const [scheduleConfig, setScheduleConfig] = useState({
    totalAmount: "",
    firstPaymentDate: "",
    numberOfPayments: "2",
    intervalValue: "1",
    intervalUnit: "months" as "days" | "weeks" | "months",
  })
  const [schedulePayments, setSchedulePayments] = useState<any[]>([])

  const isDeferredPayment = paymentMethod === "Chèque" || paymentMethod === "Traite"

  // --- CORRECTION DU USEMEMO (Erreur ReferenceError résolue) ---
  const calculatedValues = useMemo(() => {
    let ht = 0
    let tva = 0
    const details: any[] = []

    if (isVatApplicable) {
      TVA_RATES.forEach((rate) => {
        const baseVal = tvaBases[rate] ? parseFloat(tvaBases[rate]) : 0
        if (baseVal > 0) {
          const amount = baseVal * (rate / 100)
          ht += baseVal
          tva += amount
          details.push({ rate, base: baseVal, amount })
        }
      })
    } else {
      ht = parseFloat(totalAmount) || 0
    }

    const ttc = ht + tva
    const withholding = hasWithholdingTax ? ht * withholdingTaxRate : 0
    const net = ttc - withholding

    return { 
      totalHT: ht, 
      totalTVA: tva, 
      totalTTC: ttc, 
      withholdingAmount: withholding, 
      netToPay: net, 
      tvaDetails: details 
    }
  }, [isVatApplicable, tvaBases, totalAmount, hasWithholdingTax, withholdingTaxRate])

  // On déstructure APRES le useMemo pour éviter le ReferenceError
  const { totalHT, totalTVA, totalTTC, withholdingAmount, netToPay, tvaDetails } = calculatedValues
  // -------------------------------------------------------------

  const fetchCategories = async () => {
    if (!selectedCompanyId) return
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .or(`company_id.is.null,company_id.eq.${selectedCompanyId}`)
      .order("name")
    if (error) console.error("Erreur catégories:", error)
    setCategories(data || [])
  }

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCategories()
    }
  }, [selectedCompanyId])

  const handleSave = async () => {
    if (!selectedCompanyId) {
      toast.error("Veuillez sélectionner une entreprise")
      return
    }

    setIsSaving(true)
    let attachment_url = null
    if (attachmentFile) {
      const filePath = `${selectedCompanyId}/${uuidv4()}`
      const { error: uploadError } = await supabase.storage.from("expense_attachments").upload(filePath, attachmentFile)
      if (uploadError) {
        toast.error("Erreur d'upload: " + uploadError.message)
        setIsSaving(false)
        return
      }
      attachment_url = supabase.storage.from("expense_attachments").getPublicUrl(filePath).data.publicUrl
    }

    // --- LOGIQUE DÉPENSE RÉCURRENTE ---
    if (isRecurring) {
      // 1. Calcul de la PROCHAINE date (Futur)
      const startDateObj = new Date(recurringStartDate)
      let nextDateObj = new Date(startDateObj)
      
      switch (recurringFrequency) {
        case "MENSUEL": nextDateObj = addMonths(startDateObj, 1); break;
        case "BIMENSUEL": nextDateObj = addMonths(startDateObj, 2); break;
        case "TRIMESTRIEL": nextDateObj = addMonths(startDateObj, 3); break;
        case "SEMESTRIEL": nextDateObj = addMonths(startDateObj, 6); break;
        case "ANNUEL": nextDateObj = addYears(startDateObj, 1); break;
        default: nextDateObj = addMonths(startDateObj, 1);
      }
      const nextExecutionCalculated = format(nextDateObj, "yyyy-MM-dd")

      const recurringPayload = {
        company_id: selectedCompanyId,
        title: recurringTitle || `${beneficiary} - ${categories.find((c) => c.id === categoryId)?.name || "Dépense"}`,
        description: notes,
        amount: totalTTC,
        category: categories.find((c) => c.id === categoryId)?.name || "",
        category_id: categoryId || null,
        frequency: recurringFrequency,
        start_date: recurringStartDate, // Date choisie (Aujourd'hui)
        end_date: recurringEndDate || null,
        next_execution_date: nextExecutionCalculated, // Date calculée (Mois prochain)
        payment_method: paymentMethod,
        beneficiary,
        is_active: true,
        total_ht: totalHT,
        total_tva: totalTVA,
        total_ttc: totalTTC,
        has_withholding_tax: hasWithholdingTax,
        withholding_tax_amount: withholdingAmount,
        currency: "TND"
      }

      // 2. Création de la règle de récurrence
      const { data: recurringData, error } = await supabase
        .from("recurring_expenses")
        .insert(recurringPayload)
        .select()
        .single()

      if (error) {
        toast.error("Erreur récurrence: " + error.message)
        setIsSaving(false)
        return
      }

      // 3. Création de la dépense IMMÉDIATE (Historique)
      const firstExpensePayload = {
        company_id: selectedCompanyId,
        category_id: categoryId || null,
        beneficiary,
        total_ht: totalHT,
        total_tva: totalTVA,
        total_ttc: totalTTC,
        tva_details: isVatApplicable ? tvaDetails : null,
        has_withholding_tax: hasWithholdingTax,
        withholding_tax_amount: withholdingAmount,
        payment_date: recurringStartDate, // Date choisie
        payment_method: paymentMethod,
        reference,
        status: "PAYE",
        attachment_url,
        notes: notes + " (Première occurrence)",
        is_recurring: true,
        recurring_expense_id: recurringData.id
      }

      const { error: expenseError } = await supabase.from("expenses").insert(firstExpensePayload)
      
      if (expenseError) {
         console.error("Erreur insertion historique", expenseError)
         toast.warning("Récurrence activée, mais la dépense d'aujourd'hui n'a pas pu être créée.")
      } else {
         toast.success("Dépense enregistrée et récurrence activée.")
      }

      router.push("/dashboard/expenses")
      router.refresh()
      setIsSaving(false)
      return
    }
    // ----------------------------------

    // --- LOGIQUE DÉPENSE NORMALE ---
    const payload = {
      company_id: selectedCompanyId,
      category_id: categoryId || null,
      beneficiary,
      total_ht: totalHT,
      total_tva: totalTVA,
      total_ttc: totalTTC,
      tva_details: isVatApplicable ? tvaDetails : null,
      has_withholding_tax: hasWithholdingTax,
      withholding_tax_amount: withholdingAmount,
      payment_date: isDeferredPayment ? format(new Date(), "yyyy-MM-dd") : paymentDate,
      due_date: isDeferredPayment ? dueDate : null,
      payment_method: paymentMethod,
      reference,
      status: isDeferredPayment ? "EN_ATTENTE" : "PAYE",
      attachment_url,
      notes,
    }

    const { data: expenseData, error } = await supabase.from("expenses").insert(payload).select().single()
    if (error) {
      toast.error(error.message)
      setIsSaving(false)
      return
    }

    // Gestion Échéancier
    if (hasPaymentSchedule && expenseData) {
      const scheduleData = schedulePayments
        .filter((p) => p.due_date && Number.parseFloat(p.amount) > 0)
        .map((p) => ({
          expense_id: expenseData.id,
          due_date: p.due_date,
          amount: Number.parseFloat(p.amount),
          payment_method: p.payment_method,
          reference: p.reference,
          status: "pending",
        }))

      if (scheduleData.length > 0) {
        const { error: scheduleError } = await supabase.from("expense_schedules").insert(scheduleData)
        if (scheduleError) {
          toast.error("Erreur échéancier: " + scheduleError.message)
        }
      }
    }

    toast.success("Dépense enregistrée.")
    router.push("/dashboard/expenses")
    router.refresh()
    setIsSaving(false)
  }

  // --- FONCTIONS UI ---
  const addSchedulePayment = () => setSchedulePayments([...schedulePayments, { due_date: "", amount: "", payment_method: "Virement", reference: "" }])
  const removeSchedulePayment = (index: number) => setSchedulePayments(schedulePayments.filter((_, i) => i !== index))
  const updateSchedulePayment = (index: number, field: string, value: string) => {
    const updated = [...schedulePayments]
    updated[index] = { ...updated[index], [field]: value }
    setSchedulePayments(updated)
  }
  const generateSchedules = () => {
    const { totalAmount, firstPaymentDate, numberOfPayments, intervalValue, intervalUnit } = scheduleConfig
    if (!totalAmount || !firstPaymentDate || !numberOfPayments) { toast.error("Champs manquants"); return }
    const total = Number.parseFloat(totalAmount)
    const numPayments = Number.parseInt(numberOfPayments)
    const interval = Number.parseInt(intervalValue)
    const amountPerPayment = (total / numPayments).toFixed(3)
    const generatedSchedules = []
    for (let i = 0; i < numPayments; i++) {
      const paymentDate = new Date(firstPaymentDate)
      if (intervalUnit === "days") paymentDate.setDate(paymentDate.getDate() + i * interval)
      else if (intervalUnit === "weeks") paymentDate.setDate(paymentDate.getDate() + i * interval * 7)
      else if (intervalUnit === "months") paymentDate.setMonth(paymentDate.getMonth() + i * interval)
      generatedSchedules.push({
        due_date: paymentDate.toISOString().split("T")[0],
        amount: i === numPayments - 1 ? (total - Number.parseFloat(amountPerPayment) * (numPayments - 1)).toFixed(3) : amountPerPayment,
        payment_method: "Virement",
        reference: "",
      })
    }
    setSchedulePayments(generatedSchedules)
    toast.success(`${numPayments} échéances générées`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Informations Générales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Société</Label>
            {companies && companies.length > 1 ? (
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choisir une société" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (<Input value={companies.find(c => c.id === selectedCompanyId)?.name || ""} disabled />)}
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId} disabled={!selectedCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {selectedCompanyId && <CategoryCreator companyId={selectedCompanyId} tableName="expense_categories" onCategoryCreated={fetchCategories} />}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bénéficiaire</Label>
            <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Fournisseur..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Type & Montants</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border p-4 rounded-lg">
             <Label className="font-semibold">Dépense Récurrente ?</Label>
             <Switch checked={isRecurring} onCheckedChange={(c) => { setIsRecurring(c); if(c) setHasPaymentSchedule(false); }} />
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded">
               <div>
                  <Label>Fréquence</Label>
                  <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="MENSUEL">Mensuel</SelectItem>
                        <SelectItem value="BIMENSUEL">Bimensuel</SelectItem>
                        <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                        <SelectItem value="SEMESTRIEL">Semestriel</SelectItem>
                        <SelectItem value="ANNUEL">Annuel</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label>Date du 1er Paiement</Label>
                  <Input type="date" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)} />
               </div>
            </div>
          )}

          {!isRecurring && (
             <div className="flex items-center justify-between border p-4 rounded-lg">
                <Label className="font-semibold">Échéancier ?</Label>
                <Switch checked={hasPaymentSchedule} onCheckedChange={setHasPaymentSchedule} />
             </div>
          )}

          {/* Configuration Échéancier (si activé) */}
          {hasPaymentSchedule && !isRecurring && (
             <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded space-y-4">
                <div className="grid grid-cols-4 gap-2">
                   <Input type="number" placeholder="Total" value={scheduleConfig.totalAmount} onChange={e => setScheduleConfig({...scheduleConfig, totalAmount: e.target.value})} />
                   <Input type="date" value={scheduleConfig.firstPaymentDate} onChange={e => setScheduleConfig({...scheduleConfig, firstPaymentDate: e.target.value})} />
                   <Input type="number" placeholder="Nbr" value={scheduleConfig.numberOfPayments} onChange={e => setScheduleConfig({...scheduleConfig, numberOfPayments: e.target.value})} />
                   <Button onClick={generateSchedules}>Générer</Button>
                </div>
                {schedulePayments.map((p, i) => (
                   <div key={i} className="flex gap-2">
                      <Input type="date" value={p.due_date} onChange={e => updateSchedulePayment(i, 'due_date', e.target.value)} />
                      <Input type="number" value={p.amount} onChange={e => updateSchedulePayment(i, 'amount', e.target.value)} />
                      <Button size="icon" variant="ghost" onClick={() => removeSchedulePayment(i)}>X</Button>
                   </div>
                ))}
             </div>
          )}
          
          {/* MONTANTS */}
          <div className="space-y-4 pt-4 border-t">
            {!isVatApplicable && (
               <div><Label>Montant Total TTC</Label><Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} /></div>
            )}
            
            <div className="flex items-center space-x-2">
               <Switch checked={isVatApplicable} onCheckedChange={setIsVatApplicable} />
               <Label>Appliquer TVA</Label>
            </div>

            {isVatApplicable && (
               <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded">
                  {TVA_RATES.map(r => (
                     <div key={r}>
                        <Label>Base HT {r}%</Label>
                        <Input type="number" value={tvaBases[r] || ''} onChange={e => setTvaBases({...tvaBases, [r]: e.target.value})} />
                     </div>
                  ))}
               </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
         <CardHeader><CardTitle>3. Paiement & Retenue</CardTitle></CardHeader>
         <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
               <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
               <Label>Retenue à la source</Label>
            </div>
            {hasWithholdingTax && (
               <Select value={withholdingTaxRate.toString()} onValueChange={v => setWithholdingTaxRate(parseFloat(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WITHHOLDING_TAX_RATES.map(r => <SelectItem key={r.value} value={r.value.toString()}>{r.label}</SelectItem>)}</SelectContent>
               </Select>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-4">
               <div>
                  <Label>Méthode</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="Virement">Virement</SelectItem>
                        <SelectItem value="Chèque">Chèque</SelectItem>
                        <SelectItem value="Espèces">Espèces</SelectItem>
                        <SelectItem value="Traite">Traite</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div>
                  <Label>Date de Paiement</Label>
                  {/* Si récurrence, on utilise recurringStartDate, sinon paymentDate */}
                  <Input type="date" value={isRecurring ? recurringStartDate : paymentDate} onChange={e => isRecurring ? setRecurringStartDate(e.target.value) : setPaymentDate(e.target.value)} />
               </div>
               <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
               </div>
            </div>
         </CardContent>
      </Card>

      <Card className="sticky bottom-0 bg-background border-t-2 border-primary">
         <CardContent className="pt-6 flex justify-between items-center">
            <div className="text-sm font-mono space-y-1">
               <div>HT: {totalHT.toFixed(3)}</div>
               <div>TVA: {totalTVA.toFixed(3)}</div>
               {hasWithholdingTax && <div className="text-red-500">RS: -{withholdingAmount.toFixed(3)}</div>}
            </div>
            <div className="text-right">
               <div className="text-sm text-muted-foreground">NET À PAYER</div>
               <div className="text-2xl font-bold">{netToPay.toFixed(3)} TND</div>
            </div>
         </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </div>
  )
}