"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
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

export function ExpenseForm({ companyId }: { companyId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

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

  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<string>("MENSUEL")
  const [recurringStartDate, setRecurringStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [recurringEndDate, setRecurringEndDate] = useState("")
  const [recurringTitle, setRecurringTitle] = useState("")

  const [hasPaymentSchedule, setHasPaymentSchedule] = useState(false)
  const [scheduleConfig, setScheduleConfig] = useState({
    totalAmount: "",
    firstPaymentDate: "",
    numberOfPayments: "2",
    intervalValue: "1",
    intervalUnit: "months" as "days" | "weeks" | "months",
  })
  const [schedulePayments, setSchedulePayments] = useState<
    Array<{
      due_date: string
      amount: string
      payment_method: string
      reference: string
    }>
  >([])

  const isDeferredPayment = paymentMethod === "Chèque" || paymentMethod === "Traite"

  const { totalHT, totalTVA, totalTTC, withholdingAmount, netToPay, tvaDetails } = useMemo(() => {
    let ht = 0,
      tva = 0
    const details: any[] = []

    if (isVatApplicable) {
      TVA_RATES.forEach((rate) => {
        const base = Number.parseFloat(tvaBases[rate]) || 0
        if (base > 0) {
          const amount = base * (rate / 100)
          ht += base
          tva += amount
          details.push({ rate, base, amount })
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

  const fetchCategories = async () => {
    console.log("[v0] fetchCategories called, companyId:", companyId)
    if (companyId) {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .order("name")
      console.log("[v0] Categories fetched:", data, "error:", error)
      setCategories(data || [])
    }
  }

  useEffect(() => {
    console.log("[v0] useEffect triggered, companyId:", companyId)
    fetchCategories()
  }, [companyId])

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

    if (isRecurring) {
      const recurringPayload = {
        company_id: companyId,
        title: recurringTitle || `${beneficiary} - ${categories.find((c) => c.id === categoryId)?.name || "Dépense"}`,
        description: notes,
        amount: totalTTC,
        category: categories.find((c) => c.id === categoryId)?.name || "",
        frequency: recurringFrequency,
        start_date: recurringStartDate,
        end_date: recurringEndDate || null,
        next_execution_date: recurringStartDate,
        payment_method: paymentMethod,
        beneficiary,
        is_active: true,
      }

      const { error } = await supabase.from("recurring_expenses").insert(recurringPayload)
      if (error) {
        toast.error(error.message)
        setIsSaving(false)
        return
      }
      toast.success("Dépense récurrente créée.")
      router.push("/dashboard/expenses")
      router.refresh()
      setIsSaving(false)
      return
    }

    const payload = {
      company_id: companyId,
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

  const addSchedulePayment = () => {
    setSchedulePayments([...schedulePayments, { due_date: "", amount: "", payment_method: "Virement", reference: "" }])
  }

  const removeSchedulePayment = (index: number) => {
    setSchedulePayments(schedulePayments.filter((_, i) => i !== index))
  }

  const updateSchedulePayment = (index: number, field: string, value: string) => {
    const updated = [...schedulePayments]
    updated[index] = { ...updated[index], [field]: value }
    setSchedulePayments(updated)
  }

  const generateSchedules = () => {
    const { totalAmount, firstPaymentDate, numberOfPayments, intervalValue, intervalUnit } = scheduleConfig

    if (!totalAmount || !firstPaymentDate || !numberOfPayments) {
      toast.error("Veuillez remplir tous les champs de configuration")
      return
    }

    const total = Number.parseFloat(totalAmount)
    const numPayments = Number.parseInt(numberOfPayments)
    const interval = Number.parseInt(intervalValue)

    if (isNaN(total) || isNaN(numPayments) || numPayments < 1) {
      toast.error("Montant ou nombre de paiements invalide")
      return
    }

    const amountPerPayment = (total / numPayments).toFixed(3)
    const generatedSchedules = []

    for (let i = 0; i < numPayments; i++) {
      const paymentDate = new Date(firstPaymentDate)

      if (intervalUnit === "days") {
        paymentDate.setDate(paymentDate.getDate() + i * interval)
      } else if (intervalUnit === "weeks") {
        paymentDate.setDate(paymentDate.getDate() + i * interval * 7)
      } else if (intervalUnit === "months") {
        paymentDate.setMonth(paymentDate.getMonth() + i * interval)
      }

      generatedSchedules.push({
        due_date: paymentDate.toISOString().split("T")[0],
        amount:
          i === numPayments - 1
            ? (total - Number.parseFloat(amountPerPayment) * (numPayments - 1)).toFixed(3) // Adjust last payment for rounding
            : amountPerPayment,
        payment_method: "Virement",
        reference: "",
      })
    }

    setSchedulePayments(generatedSchedules)
    toast.success(`${numPayments} échéances générées automatiquement`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Informations Générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
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
                onCategoryCreated={fetchCategories}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bénéficiaire</Label>
            <Input
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="Nom du fournisseur, Trésor Public..."
            />
          </div>
          <div className="space-y-2">
            <Label>Date de la Dépense</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Type de Dépense</CardTitle>
              <CardDescription>Choisissez si c'est une dépense unique, récurrente ou avec échéancier</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="font-semibold">Dépense Récurrente</Label>
              <p className="text-sm text-muted-foreground">Loyer, abonnement, salaires, etc.</p>
            </div>
            <Switch
              checked={isRecurring}
              onCheckedChange={(checked) => {
                setIsRecurring(checked)
                if (checked) setHasPaymentSchedule(false)
              }}
            />
          </div>

          {isRecurring && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie</Label>
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
                      onCategoryCreated={fetchCategories}
                    />
                  </div>
                </div>
                <div>
                  <Label>Bénéficiaire</Label>
                  <Input
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder="Ex: Propriétaire, Fournisseur..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Montant HT</Label>
                  <Input type="number" value={totalHT} onChange={(e) => setTotalAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Montant TVA</Label>
                  <Input type="number" value={totalTVA} onChange={(e) => setTotalAmount(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fréquence</Label>
                  <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Label>Prochaine exécution</Label>
                  <Input
                    type="date"
                    value={recurringStartDate}
                    onChange={(e) => setRecurringStartDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Méthode de paiement</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Virement">Virement</SelectItem>
                      <SelectItem value="Prélèvement">Prélèvement</SelectItem>
                      <SelectItem value="Espèces">Espèces</SelectItem>
                      <SelectItem value="Chèque">Chèque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Référence</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="N° compte, référence..."
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
                  <Label>Retenue à la source</Label>
                </div>
                {hasWithholdingTax && (
                  <div className="ml-6">
                    <Label>Taux de retenue</Label>
                    <Select value={withholdingTaxRate} onValueChange={setWithholdingTaxRate}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WITHHOLDING_TAX_RATES.map((rate) => (
                          <SelectItem key={rate.value} value={rate.value}>
                            {rate.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Montant:{" "}
                      {((Number.parseFloat(totalHT) || 0) * (Number.parseFloat(withholdingTaxRate) / 100)).toFixed(3)}{" "}
                      TND
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Loyer local commercial..."
                />
              </div>
              <div>
                <Label>Date de fin (optionnelle)</Label>
                <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Laissez vide pour une dépense sans fin</p>
              </div>
            </div>
          )}

          {!isRecurring && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-semibold">Échéancier de Paiement</Label>
                <p className="text-sm text-muted-foreground">
                  Paiement réparti sur plusieurs dates (chèques, traites...)
                </p>
              </div>
              <Switch checked={hasPaymentSchedule} onCheckedChange={setHasPaymentSchedule} />
            </div>
          )}

          {hasPaymentSchedule && !isRecurring && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div className="space-y-4 p-4 border rounded-md bg-blue-50 dark:bg-blue-950">
                <Label className="font-semibold text-blue-900 dark:text-blue-100">Configuration Automatique</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Montant Total</Label>
                    <Input
                      type="number"
                      value={scheduleConfig.totalAmount}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, totalAmount: e.target.value })}
                      placeholder="0.000"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Date 1ère Échéance</Label>
                    <Input
                      type="date"
                      value={scheduleConfig.firstPaymentDate}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, firstPaymentDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nombre d'Échéances</Label>
                    <Input
                      type="number"
                      min="1"
                      value={scheduleConfig.numberOfPayments}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, numberOfPayments: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Intervalle</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={scheduleConfig.intervalValue}
                        onChange={(e) => setScheduleConfig({ ...scheduleConfig, intervalValue: e.target.value })}
                        className="w-20"
                      />
                      <Select
                        value={scheduleConfig.intervalUnit}
                        onValueChange={(v: any) => setScheduleConfig({ ...scheduleConfig, intervalUnit: v })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Jours</SelectItem>
                          <SelectItem value="weeks">Semaines</SelectItem>
                          <SelectItem value="months">Mois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button type="button" variant="default" size="sm" onClick={generateSchedules} className="w-full">
                  Générer les Échéances Automatiquement
                </Button>
              </div>

              {schedulePayments.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Échéances Générées ({schedulePayments.length})</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSchedulePayment}>
                      Ajouter manuellement
                    </Button>
                  </div>
                  {schedulePayments.map((payment, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={payment.due_date}
                          onChange={(e) => updateSchedulePayment(index, "due_date", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Montant</Label>
                        <Input
                          type="number"
                          value={payment.amount}
                          onChange={(e) => updateSchedulePayment(index, "amount", e.target.value)}
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Moyen</Label>
                        <Select
                          value={payment.payment_method}
                          onValueChange={(v) => updateSchedulePayment(index, "payment_method", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Virement">Virement</SelectItem>
                            <SelectItem value="Chèque">Chèque</SelectItem>
                            <SelectItem value="Traite">Traite</SelectItem>
                            <SelectItem value="Espèces">Espèces</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Référence</Label>
                        <Input
                          value={payment.reference}
                          onChange={(e) => updateSchedulePayment(index, "reference", e.target.value)}
                          placeholder="N°"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeSchedulePayment(index)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ))}
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Total échéances:{" "}
                    {schedulePayments.reduce((sum, p) => sum + (Number.parseFloat(p.amount) || 0), 0).toFixed(3)} TND
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Détail des Montants</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
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
                onCategoryCreated={fetchCategories}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bénéficiaire</Label>
            <Input
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="Nom du fournisseur, Trésor Public..."
            />
          </div>
          <div className="space-y-2">
            <Label>Date de la Dépense</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>3. Options Fiscales & Paiement</CardTitle>
            <div className="flex items-center space-x-2">
              <Label>Dépense soumise à TVA</Label>
              <Switch checked={isVatApplicable} onCheckedChange={setIsVatApplicable} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isVatApplicable ? (
            <div>
              <Label>Montant Total (TTC)</Label>
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium text-sm">Saisir les bases HT par taux de TVA</h4>
              {TVA_RATES.map((rate) => (
                <div key={rate} className="grid grid-cols-3 items-center gap-4">
                  <Label>Base HT ({rate}%)</Label>
                  <Input
                    type="number"
                    className="col-span-2"
                    value={tvaBases[rate] || ""}
                    onChange={(e) => setTvaBases((prev) => ({ ...prev, [rate]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
              <Label>Retenue à la Source</Label>
            </div>
            {hasWithholdingTax && (
              <Select
                value={withholdingTaxRate.toString()}
                onValueChange={(val) => setWithholdingTaxRate(Number.parseFloat(val))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Taux" />
                </SelectTrigger>
                <SelectContent>
                  {WITHHOLDING_TAX_RATES.map((rate) => (
                    <SelectItem key={rate.value} value={rate.value.toString()}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Justificatifs & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Pièce Jointe (Facture, Reçu...)</Label>
            <Input type="file" onChange={(e) => setAttachmentFile(e.target.files ? e.target.files[0] : null)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="sticky bottom-0">
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span>{totalHT.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total TVA</span>
            <span>{totalTVA.toFixed(3)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total TTC</span>
            <span>{totalTTC.toFixed(3)}</span>
          </div>
          {hasWithholdingTax && (
            <>
              <div className="flex justify-between text-red-500">
                <span>Retenue à la Source</span>
                <span>- {withholdingAmount.toFixed(3)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-emerald-600">
                <span>NET À PAYER</span>
                <span>{netToPay.toFixed(3)} TND</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer la Dépense
        </Button>
      </div>
    </div>
  )
}
