"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CategoryCreator } from "@/components/category-creator"
import { PlusCircle, Pause, Play, Trash2, Calculator } from "lucide-react"
import { format } from "date-fns"
import { Textarea } from "@/components/ui/textarea"

interface RecurringExpenseManagerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

const TVA_RATES = [19, 13, 7, 0]
const WITHHOLDING_TAX_RATES = [
  { value: "15", label: "15%" },
  { value: "10", label: "10%" },
  { value: "1.5", label: "1.5%" },
  { value: "1", label: "1%" },
  { value: "0.5", label: "0.5%" },
]

export function RecurringExpenseManager({ isOpen, onOpenChange, companyId }: RecurringExpenseManagerProps) {
  const supabase = createClient()
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [categoryId, setCategoryId] = useState("")
  const [beneficiary, setBeneficiary] = useState("")

  // --- NOUVEAU SYSTÈME DE CALCUL ---
  const [totalHT, setTotalHT] = useState("")
  const [tvaRate, setTvaRate] = useState("19") // Par défaut 19%
  const [totalTVA, setTotalTVA] = useState("0")
  const [totalTTC, setTotalTTC] = useState("0")
  const [currency, setCurrency] = useState<string>("TND")
  // ---------------------------------

  const [hasWithholdingTax, setHasWithholdingTax] = useState(false)
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("1.5")
  const [frequency, setFrequency] = useState("MENSUEL")
  const [nextExecutionDate, setNextExecutionDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [paymentMethod, setPaymentMethod] = useState("Virement")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [title, setTitle] = useState("") // Ajout du titre

  useEffect(() => {
    if (isOpen) {
      fetchRecurringExpenses()
      fetchCategories()
    }
  }, [isOpen])

  // --- CALCUL AUTOMATIQUE ---
  useEffect(() => {
    const ht = Number.parseFloat(totalHT.replace(",", ".")) || 0
    const rate = Number.parseFloat(tvaRate) || 0
    const tva = ht * (rate / 100)
    const ttc = ht + tva

    const decimals = currency === "TND" ? 3 : 2
    setTotalTVA(tva.toFixed(decimals))
    setTotalTTC(ttc.toFixed(decimals))
  }, [totalHT, tvaRate, currency])
  // -------------------------

  const formatCurrency = (value: number, curr?: string) => {
    const usedCurrency = curr || currency
    const decimals = usedCurrency === "TND" ? 3 : 2
    const symbol = usedCurrency === "USD" ? "$" : usedCurrency === "EUR" ? "€" : ""
    return `${value.toFixed(decimals)} ${symbol || usedCurrency}`
  }

  const fetchRecurringExpenses = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .order("next_execution_date", { ascending: true })

    if (error && error.code !== "42P01") {
      console.error(error)
      // On ne toast plus l'erreur si c'est juste la table vide au début
    }
    setRecurringExpenses(data || [])
    setIsLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("expense_categories")
      .select("*")
      .or(`company_id.is.null,company_id.eq.${companyId}`)
      .order("name")
    setCategories(data || [])
  }

  const handleSave = async () => {
    const withholdingAmount = hasWithholdingTax
      ? (Number.parseFloat(totalHT.replace(",", ".")) || 0) * (Number.parseFloat(withholdingTaxRate) / 100)
      : 0

    // Construction du titre automatique si vide
    const categoryName = categories.find((c) => c.id === categoryId)?.name || "Dépense"
    const finalTitle = title || `${beneficiary} - ${categoryName}`

    const payload = {
      company_id: companyId,
      category_id: categoryId || null,
      category: categoryName, // Sécurité
      title: finalTitle,
      beneficiary,
      total_ht: Number.parseFloat(totalHT.replace(",", ".")) || 0,
      total_tva: Number.parseFloat(totalTVA) || 0,
      total_ttc: Number.parseFloat(totalTTC) || 0,
      amount: Number.parseFloat(totalTTC) || 0, // Pour compatibilité
      has_withholding_tax: hasWithholdingTax,
      withholding_tax_amount: withholdingAmount,
      frequency,
      next_execution_date: nextExecutionDate,
      payment_method: paymentMethod,
      reference,
      description: notes,
      status: "ACTIVE",
      currency: currency, // Added currency to payload
    }

    const { error } = await supabase.from("recurring_expenses").insert(payload)

    if (error) {
      toast.error("Erreur: " + error.message)
    } else {
      toast.success("Dépense récurrente créée")
      setShowForm(false)
      resetForm()
      fetchRecurringExpenses()
    }
  }

  const resetForm = () => {
    setCategoryId("")
    setBeneficiary("")
    setTotalHT("")
    setTvaRate("19")
    setHasWithholdingTax(false)
    setWithholdingTaxRate("1.5")
    setFrequency("MENSUEL")
    setNextExecutionDate(format(new Date(), "yyyy-MM-dd"))
    setPaymentMethod("Virement")
    setReference("")
    setNotes("")
    setTitle("")
    setCurrency("TND") // Reset currency
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    const { error } = await supabase.from("recurring_expenses").update({ status: newStatus }).eq("id", id)
    if (!error) {
      toast.success(newStatus === "ACTIVE" ? "Réactivée" : "Mise en pause")
      fetchRecurringExpenses()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette dépense récurrente ?")) return
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id)
    if (!error) {
      toast.success("Supprimée")
      fetchRecurringExpenses()
    }
  }

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      MENSUEL: "Tous les mois",
      BIMENSUEL: "Tous les 2 mois",
      TRIMESTRIEL: "Tous les 3 mois",
      SEMESTRIEL: "Tous les 6 mois",
      ANNUEL: "Tous les ans",
    }
    return labels[freq] || freq
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Gestion des Dépenses Récurrentes</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Configurez des dépenses automatiques périodiques</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)} size="lg">
              <PlusCircle className="h-5 w-5 mr-2" />
              Nouvelle Dépense Récurrente
            </Button>
          </div>
        </DialogHeader>

        {showForm && (
          <div className="border-2 border-primary/20 rounded-lg p-6 space-y-6 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Calculator className="h-6 w-6 text-primary" />
              <h3 className="font-bold text-lg">Nouvelle Configuration Récurrente</h3>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border space-y-4">
                <h4 className="font-semibold text-sm text-primary">Informations de Base</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Titre (Optionnel)</Label>
                    <Input
                      className="h-11"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Loyer Bureau Principal"
                    />
                    <p className="text-xs text-muted-foreground">Laissez vide pour générer automatiquement</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Catégorie *</Label>
                    <div className="flex gap-2">
                      <Select value={categoryId} onValueChange={setCategoryId}>
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
                      <CategoryCreator
                        companyId={companyId}
                        tableName="expense_categories"
                        onCategoryCreated={fetchCategories}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Bénéficiaire *</Label>
                    <Input
                      className="h-11"
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                      placeholder="Nom du fournisseur..."
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
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 p-5 rounded-lg border-2 border-blue-200 dark:border-blue-800 space-y-4">
                <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Calcul des Montants</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Montant HT *</Label>
                    <Input
                      type="text"
                      className="h-12 text-lg font-semibold"
                      value={totalHT}
                      onChange={(e) => {
                        const value = e.target.value.replace(",", ".")
                        setTotalHT(value)
                      }}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Taux TVA *</Label>
                    <Select value={tvaRate} onValueChange={setTvaRate}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TVA_RATES.map((r) => (
                          <SelectItem key={r} value={r.toString()}>
                            {r}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Total TTC (Calculé)</Label>
                    <Input
                      className="h-12 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-green-500"
                      value={totalTTC}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground font-medium">Dont TVA: {totalTVA}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border space-y-4">
                <h4 className="font-semibold text-sm text-primary">Récurrence et Paiement</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Fréquence de Récurrence *</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
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
                    <Label className="text-sm font-semibold">Prochaine Exécution *</Label>
                    <Input
                      className="h-11"
                      type="date"
                      value={nextExecutionDate}
                      onChange={(e) => setNextExecutionDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Méthode de Paiement *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Virement">💳 Virement Bancaire</SelectItem>
                        <SelectItem value="Chèque">🏦 Chèque</SelectItem>
                        <SelectItem value="Espèces">💵 Espèces</SelectItem>
                        <SelectItem value="Carte">💳 Carte Bancaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Référence</Label>
                    <Input
                      className="h-11"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Numéro de référence..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 p-5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-4">
                <div className="flex items-center space-x-3">
                  <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} id="withholding-toggle" />
                  <div>
                    <Label htmlFor="withholding-toggle" className="font-semibold cursor-pointer">
                      Retenue à la Source
                    </Label>
                    <p className="text-xs text-muted-foreground">Appliquer une retenue fiscale sur cette dépense</p>
                  </div>
                </div>
                {hasWithholdingTax && (
                  <div className="grid grid-cols-2 gap-4 ml-6 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Taux de Retenue</Label>
                      <Select value={withholdingTaxRate} onValueChange={setWithholdingTaxRate}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WITHHOLDING_TAX_RATES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Montant de la Retenue</Label>
                      <div className="h-11 flex items-center px-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-md">
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">
                          -{" "}
                          {formatCurrency(
                            (Number.parseFloat(totalHT.replace(",", ".")) || 0) *
                              (Number.parseFloat(withholdingTaxRate) / 100),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border space-y-3">
                <Label className="text-sm font-semibold">Notes & Commentaires</Label>
                <Textarea
                  className="min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ajouter des informations complémentaires..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="min-w-[120px]"
              >
                Annuler
              </Button>
              <Button size="lg" onClick={handleSave} className="min-w-[180px]">
                <PlusCircle className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Titre / Bénéficiaire</TableHead>
                  <TableHead className="font-bold">Montant TTC</TableHead>
                  <TableHead className="font-bold">Fréquence</TableHead>
                  <TableHead className="font-bold">Prochaine Échéance</TableHead>
                  <TableHead className="font-bold">Statut</TableHead>
                  <TableHead className="font-bold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringExpenses.map((exp) => (
                  <TableRow key={exp.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-semibold">{exp.title || exp.beneficiary}</div>
                        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded inline-block">
                          {exp.category}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold font-mono">
                        {formatCurrency(Number(exp.total_ttc || exp.amount), exp.currency || "TND")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{getFrequencyLabel(exp.frequency)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{format(new Date(exp.next_execution_date), "dd/MM/yyyy")}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.status === "ACTIVE" ? "default" : "secondary"} className="font-semibold">
                        {exp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleStatus(exp.id, exp.status)}
                          title={exp.status === "ACTIVE" ? "Mettre en pause" : "Réactiver"}
                        >
                          {exp.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                          onClick={() => handleDelete(exp.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {recurringExpenses.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <PlusCircle className="h-12 w-12 opacity-30" />
                        <p className="text-lg font-medium">Aucune dépense récurrente configurée</p>
                        <p className="text-sm">Cliquez sur "Nouvelle Dépense Récurrente" pour commencer</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
