"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { format, addMonths, addYears } from "date-fns"
import { v4 as uuidv4 } from "uuid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [currency, setCurrency] = useState<string>("TND")

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
        const baseVal = tvaBases[rate] ? Number.parseFloat(tvaBases[rate]) : 0
        if (baseVal > 0) {
          const amount = baseVal * (rate / 100)
          ht += baseVal
          tva += amount
          details.push({ rate, base: baseVal, amount })
        }
      })
    } else {
      ht = Number.parseFloat(totalAmount) || 0
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
      tvaDetails: details,
    }
  }, [isVatApplicable, tvaBases, totalAmount, hasWithholdingTax, withholdingTaxRate])

  // On déstructure APRES le useMemo pour éviter le ReferenceError
  const { totalHT, totalTVA, totalTTC, withholdingAmount, netToPay, tvaDetails } = calculatedValues
  // -------------------------------------------------------------

  const formatCurrency = (value: number) => {
    const decimals = currency === "TND" ? 3 : 2
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : ""
    return `${value.toFixed(decimals)} ${symbol || currency}`
  }

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
        case "MENSUEL":
          nextDateObj = addMonths(startDateObj, 1)
          break
        case "BIMENSUEL":
          nextDateObj = addMonths(startDateObj, 2)
          break
        case "TRIMESTRIEL":
          nextDateObj = addMonths(startDateObj, 3)
          break
        case "SEMESTRIEL":
          nextDateObj = addMonths(startDateObj, 6)
          break
        case "ANNUEL":
          nextDateObj = addYears(startDateObj, 1)
          break
        default:
          nextDateObj = addMonths(startDateObj, 1)
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
        currency: currency, // Added currency to recurring expense
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
        recurring_expense_id: recurringData.id,
        currency: currency, // Added currency to first expense
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
      currency: currency, // Added currency to regular expense
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
          currency: currency, // Added currency to schedule
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
  const addSchedulePayment = () =>
    setSchedulePayments([...schedulePayments, { due_date: "", amount: "", payment_method: "Virement", reference: "" }])
  const removeSchedulePayment = (index: number) => setSchedulePayments(schedulePayments.filter((_, i) => i !== index))
  const updateSchedulePayment = (index: number, field: string, value: string) => {
    const updated = [...schedulePayments]
    updated[index] = { ...updated[index], [field]: value }
    setSchedulePayments(updated)
  }
  const generateSchedules = () => {
    const { totalAmount, firstPaymentDate, numberOfPayments, intervalValue, intervalUnit } = scheduleConfig
    if (!totalAmount || !firstPaymentDate || !numberOfPayments) {
      toast.error("Champs manquants")
      return
    }
    const total = Number.parseFloat(totalAmount)
    const numPayments = Number.parseInt(numberOfPayments)
    const interval = Number.parseInt(intervalValue)
    const amountPerPayment = (total / numPayments).toFixed(currency === "TND" ? 3 : 2)
    const generatedSchedules = []
    for (let i = 0; i < numPayments; i++) {
      const paymentDate = new Date(firstPaymentDate)
      if (intervalUnit === "days") paymentDate.setDate(paymentDate.getDate() + i * interval)
      else if (intervalUnit === "weeks") paymentDate.setDate(paymentDate.getDate() + i * interval * 7)
      else if (intervalUnit === "months") paymentDate.setMonth(paymentDate.getMonth() + i * interval)
      generatedSchedules.push({
        due_date: paymentDate.toISOString().split("T")[0],
        amount:
          i === numPayments - 1
            ? (total - Number.parseFloat(amountPerPayment) * (numPayments - 1)).toFixed(currency === "TND" ? 3 : 2)
            : amountPerPayment,
        payment_method: "Virement",
        reference: "",
      })
    }
    setSchedulePayments(generatedSchedules)
    toast.success(`${numPayments} échéances générées`)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </span>
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Société *</Label>
              {companies && companies.length > 1 ? (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choisir une société" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-11"
                  value={companies.find((c) => c.id === selectedCompanyId)?.name || ""}
                  disabled
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Catégorie *</Label>
              <div className="flex gap-2">
                <Select value={categoryId} onValueChange={setCategoryId} disabled={!selectedCompanyId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Sélectionner une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCompanyId && (
                  <CategoryCreator
                    companyId={selectedCompanyId}
                    tableName="expense_categories"
                    onCategoryCreated={fetchCategories}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Bénéficiaire *</Label>
              <Input
                className="h-11"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Nom du fournisseur ou prestataire..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Devise *</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TND">🇹🇳 TND - Dinar Tunisien</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD - Dollar Américain</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </span>
            Type & Montants
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 p-5 rounded-lg">
            <div className="space-y-1">
              <Label className="font-semibold text-base">Dépense Récurrente</Label>
              <p className="text-sm text-muted-foreground">Activer pour créer une dépense automatique périodique</p>
            </div>
            <Switch
              checked={isRecurring}
              onCheckedChange={(c) => {
                setIsRecurring(c)
                if (c) setHasPaymentSchedule(false)
              }}
            />
          </div>

          {isRecurring && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Fréquence de récurrence *</Label>
                <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSUEL">📅 Mensuel (tous les mois)</SelectItem>
                    <SelectItem value="BIMENSUEL">📅 Bimensuel (tous les 2 mois)</SelectItem>
                    <SelectItem value="TRIMESTRIEL">📅 Trimestriel (tous les 3 mois)</SelectItem>
                    <SelectItem value="SEMESTRIEL">📅 Semestriel (tous les 6 mois)</SelectItem>
                    <SelectItem value="ANNUEL">📅 Annuel (tous les ans)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date du 1er Paiement *</Label>
                <Input
                  className="h-11"
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isRecurring && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 p-5 rounded-lg">
              <div className="space-y-1">
                <Label className="font-semibold text-base">Paiement Échelonné</Label>
                <p className="text-sm text-muted-foreground">Diviser le paiement en plusieurs échéances</p>
              </div>
              <Switch checked={hasPaymentSchedule} onCheckedChange={setHasPaymentSchedule} />
            </div>
          )}

          {/* Configuration Échéancier */}
          {hasPaymentSchedule && !isRecurring && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 p-6 rounded-lg border border-amber-200 dark:border-amber-800 space-y-4">
              <h4 className="font-semibold text-sm">Configuration de l'échéancier</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Montant Total</Label>
                  <Input
                    className="h-11"
                    type="number"
                    placeholder="0.000"
                    value={scheduleConfig.totalAmount}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, totalAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">1ère Échéance</Label>
                  <Input
                    className="h-11"
                    type="date"
                    value={scheduleConfig.firstPaymentDate}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, firstPaymentDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Nombre d'échéances</Label>
                  <Input
                    className="h-11"
                    type="number"
                    placeholder="2"
                    value={scheduleConfig.numberOfPayments}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, numberOfPayments: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={generateSchedules} className="w-full h-11">
                    Générer
                  </Button>
                </div>
              </div>
              {schedulePayments.map((p, i) => (
                <div key={i} className="flex gap-3 items-center bg-white dark:bg-slate-900 p-3 rounded border">
                  <span className="text-sm font-semibold min-w-[80px]">Échéance {i + 1}</span>
                  <Input
                    className="h-10"
                    type="date"
                    value={p.due_date}
                    onChange={(e) => updateSchedulePayment(i, "due_date", e.target.value)}
                  />
                  <Input
                    className="h-10"
                    type="number"
                    value={p.amount}
                    onChange={(e) => updateSchedulePayment(i, "amount", e.target.value)}
                  />
                  <Button size="icon" variant="destructive" onClick={() => removeSchedulePayment(i)}>
                    X
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-6 pt-4 border-t-2">
            <h4 className="font-semibold text-base">Calcul des Montants</h4>

            {!isVatApplicable && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Montant Total TTC *</Label>
                <Input
                  className="h-12 text-lg font-semibold"
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.000"
                />
              </div>
            )}

            <div className="flex items-center space-x-3 bg-muted/50 p-4 rounded-lg">
              <Switch checked={isVatApplicable} onCheckedChange={setIsVatApplicable} id="vat-switch" />
              <div>
                <Label htmlFor="vat-switch" className="font-semibold cursor-pointer">
                  TVA Applicable
                </Label>
                <p className="text-xs text-muted-foreground">Activer pour décomposer HT + TVA</p>
              </div>
            </div>

            {isVatApplicable && (
              <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border">
                <h5 className="font-semibold text-sm">Décomposition par taux de TVA</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TVA_RATES.map((rate) => (
                    <div key={rate} className="space-y-2">
                      <Label className="text-sm font-medium">Base HT à {rate}%</Label>
                      <Input
                        className="h-11"
                        type="number"
                        value={tvaBases[rate] || ""}
                        onChange={(e) => setTvaBases({ ...tvaBases, [rate]: e.target.value })}
                        placeholder="0.000"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-3 bg-muted/50 p-4 rounded-lg">
                <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} id="withholding-switch" />
                <div>
                  <Label htmlFor="withholding-switch" className="font-semibold cursor-pointer">
                    Retenue à la Source
                  </Label>
                  <p className="text-xs text-muted-foreground">Appliquer une retenue fiscale</p>
                </div>
              </div>
              {hasWithholdingTax && (
                <div className="ml-6 space-y-3">
                  <Label className="text-sm font-semibold">Taux de retenue</Label>
                  <Select
                    value={withholdingTaxRate.toString()}
                    onValueChange={(v) => setWithholdingTaxRate(Number.parseFloat(v))}
                  >
                    <SelectTrigger className="h-11 w-full md:w-[250px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WITHHOLDING_TAX_RATES.map((r) => (
                        <SelectItem key={r.value} value={r.value.toString()}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg border-2 border-primary/20">
            <h4 className="font-bold text-lg mb-4">Récapitulatif</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-primary/20">
                <span className="text-sm font-medium">Total HT</span>
                <span className="text-lg font-semibold">{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-primary/20">
                <span className="text-sm font-medium">Total TVA</span>
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalTVA)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-primary/20">
                <span className="text-sm font-medium">Total TTC</span>
                <span className="text-lg font-semibold">{formatCurrency(totalTTC)}</span>
              </div>
              {hasWithholdingTax && (
                <div className="flex justify-between items-center py-2 border-b border-primary/20">
                  <span className="text-sm font-medium">Retenue à la source</span>
                  <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                    - {formatCurrency(withholdingAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 bg-primary text-primary-foreground rounded-md px-4 mt-2">
                <span className="font-bold text-base">NET À PAYER</span>
                <span className="text-2xl font-bold">{formatCurrency(netToPay)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </span>
            Paiement & Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Méthode de Paiement *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">💳 Virement Bancaire</SelectItem>
                  <SelectItem value="Chèque">🏦 Chèque</SelectItem>
                  <SelectItem value="Traite">📋 Traite</SelectItem>
                  <SelectItem value="Espèces">💵 Espèces</SelectItem>
                  <SelectItem value="Carte">💳 Carte Bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isRecurring && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {isDeferredPayment ? "Date d'engagement" : "Date de Paiement *"}
                </Label>
                <Input
                  className="h-11"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            )}

            {isDeferredPayment && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date d'Échéance *</Label>
                <Input className="h-11" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Référence / N° Pièce</Label>
              <Input
                className="h-11"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Numéro de facture, référence..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              4
            </span>
            Notes & Pièce Jointe
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes Internes</Label>
            <Textarea
              className="min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajouter des notes, commentaires ou détails supplémentaires..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Pièce Jointe (Facture, Reçu...)</Label>
            <Input
              type="file"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
              className="h-11 cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">Formats acceptés: PDF, JPG, PNG (Max 5MB)</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pb-8">
        <Button variant="outline" size="lg" onClick={() => router.back()} className="min-w-[150px]">
          Annuler
        </Button>
        <Button size="lg" onClick={handleSave} disabled={isSaving || !selectedCompanyId} className="min-w-[200px]">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer la Dépense"
          )}
        </Button>
      </div>
    </div>
  )
}
