"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CategoryCreator } from "@/components/category-creator"
import { PlusCircle, Pause, Play, Trash2 } from "lucide-react"
import { format } from "date-fns"

interface RecurringExpenseManagerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

export function RecurringExpenseManager({ isOpen, onOpenChange, companyId }: RecurringExpenseManagerProps) {
  const supabase = createClient()
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [categoryId, setCategoryId] = useState("")
  const [beneficiary, setBeneficiary] = useState("")
  const [totalHT, setTotalHT] = useState("")
  const [totalTVA, setTotalTVA] = useState("")
  const [hasWithholdingTax, setHasWithholdingTax] = useState(false)
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("1.5")
  const [frequency, setFrequency] = useState("MENSUEL")
  const [nextExecutionDate, setNextExecutionDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [paymentMethod, setPaymentMethod] = useState("Virement")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  const WITHHOLDING_TAX_RATES = [
    { value: "15", label: "15%" },
    { value: "10", label: "10%" },
    { value: "1.5", label: "1.5%" },
    { value: "1", label: "1%" },
    { value: "0.5", label: "0.5%" },
  ]

  useEffect(() => {
    if (isOpen) {
      fetchRecurringExpenses()
      fetchCategories()
    }
  }, [isOpen])

  const fetchRecurringExpenses = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .order("next_execution_date", { ascending: true })

    if (error) {
      // Table doesn't exist yet
      if (error.code === "42P01") {
        toast.error("Table 'recurring_expenses' non créée. Créez-la manuellement dans Supabase.")
        setRecurringExpenses([])
      } else {
        toast.error("Erreur de chargement")
      }
    } else {
      setRecurringExpenses(data || [])
    }
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
    const totalTTC = (Number.parseFloat(totalHT) || 0) + (Number.parseFloat(totalTVA) || 0)
    const withholdingAmount = hasWithholdingTax
      ? (Number.parseFloat(totalHT) || 0) * (Number.parseFloat(withholdingTaxRate) / 100)
      : 0

    const payload = {
      company_id: companyId,
      category_id: categoryId || null,
      beneficiary,
      total_ht: Number.parseFloat(totalHT) || 0,
      total_tva: Number.parseFloat(totalTVA) || 0,
      total_ttc: totalTTC,
      has_withholding_tax: hasWithholdingTax,
      withholding_tax_amount: withholdingAmount,
      frequency,
      next_execution_date: nextExecutionDate,
      payment_method: paymentMethod,
      reference,
      status: "ACTIVE",
      notes,
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
    setTotalTVA("")
    setHasWithholdingTax(false)
    setWithholdingTaxRate("1.5")
    setFrequency("MENSUEL")
    setNextExecutionDate(format(new Date(), "yyyy-MM-dd"))
    setPaymentMethod("Virement")
    setReference("")
    setNotes("")
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    const { error } = await supabase.from("recurring_expenses").update({ status: newStatus }).eq("id", id)

    if (error) toast.error("Erreur")
    else {
      toast.success(newStatus === "ACTIVE" ? "Réactivée" : "Mise en pause")
      fetchRecurringExpenses()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette dépense récurrente ?")) return

    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id)

    if (error) toast.error("Erreur")
    else {
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
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Gestion des Dépenses Récurrentes</DialogTitle>
            <Button onClick={() => setShowForm(!showForm)} size="sm">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nouvelle dépense récurrente
            </Button>
          </div>
        </DialogHeader>

        {showForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h3 className="font-semibold">Créer une Dépense Récurrente</h3>
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
              <div>
                <Label>Montant HT</Label>
                <Input type="number" value={totalHT} onChange={(e) => setTotalHT(e.target.value)} />
              </div>
              <div>
                <Label>Montant TVA</Label>
                <Input type="number" value={totalTVA} onChange={(e) => setTotalTVA(e.target.value)} />
              </div>
              <div>
                <Label>Fréquence</Label>
                <Select value={frequency} onValueChange={setFrequency}>
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
                <Input type="date" value={nextExecutionDate} onChange={(e) => setNextExecutionDate(e.target.value)} />
              </div>
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
                    {((Number.parseFloat(totalHT) || 0) * (Number.parseFloat(withholdingTaxRate) / 100)).toFixed(3)} TND
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
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleSave}>Enregistrer</Button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bénéficiaire</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Prochaine</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringExpenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">{exp.beneficiary}</TableCell>
                  <TableCell>{exp.expense_categories?.name || "-"}</TableCell>
                  <TableCell className="font-mono">{Number.parseFloat(exp.total_ttc).toFixed(3)} TND</TableCell>
                  <TableCell className="text-sm">{getFrequencyLabel(exp.frequency)}</TableCell>
                  <TableCell>{format(new Date(exp.next_execution_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={exp.status === "ACTIVE" ? "default" : "secondary"}>{exp.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleStatus(exp.id, exp.status)}
                        title={exp.status === "ACTIVE" ? "Pause" : "Activer"}
                      >
                        {exp.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
