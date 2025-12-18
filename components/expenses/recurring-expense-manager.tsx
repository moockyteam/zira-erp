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
import { PlusCircle, Pause, Play, Trash2, Calculator } from "lucide-react"
import { format } from "date-fns"

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
    const ht = parseFloat(totalHT) || 0
    const rate = parseFloat(tvaRate) || 0
    const tva = ht * (rate / 100)
    const ttc = ht + tva

    setTotalTVA(tva.toFixed(3))
    setTotalTTC(ttc.toFixed(3))
  }, [totalHT, tvaRate])
  // -------------------------

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
      ? (parseFloat(totalHT) || 0) * (parseFloat(withholdingTaxRate) / 100)
      : 0

    // Construction du titre automatique si vide
    const categoryName = categories.find(c => c.id === categoryId)?.name || "Dépense"
    const finalTitle = title || `${beneficiary} - ${categoryName}`

    const payload = {
      company_id: companyId,
      category_id: categoryId || null,
      category: categoryName, // Sécurité
      title: finalTitle,
      beneficiary,
      total_ht: parseFloat(totalHT) || 0,
      total_tva: parseFloat(totalTVA) || 0,
      total_ttc: parseFloat(totalTTC) || 0,
      amount: parseFloat(totalTTC) || 0, // Pour compatibilité
      has_withholding_tax: hasWithholdingTax,
      withholding_tax_amount: withholdingAmount,
      frequency,
      next_execution_date: nextExecutionDate,
      payment_method: paymentMethod,
      reference,
      description: notes,
      status: "ACTIVE",
      currency: "TND"
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
            <h3 className="font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4"/> Nouvelle Configuration
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Ligne 1 */}
              <div>
                <Label>Titre (Optionnel)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Loyer Bureau A" />
              </div>
              <div>
                <Label>Catégorie</Label>
                <div className="flex gap-2">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <CategoryCreator companyId={companyId} tableName="expense_categories" onCategoryCreated={fetchCategories} />
                </div>
              </div>

              {/* Ligne 2 : Montants avec calcul auto */}
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded border">
                  <div>
                    <Label>Montant HT</Label>
                    <Input type="number" value={totalHT} onChange={(e) => setTotalHT(e.target.value)} placeholder="0.000" />
                  </div>
                  <div>
                    <Label>Taux TVA</Label>
                    <Select value={tvaRate} onValueChange={setTvaRate}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {TVA_RATES.map(r => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Total TTC (Calculé)</Label>
                    <Input value={totalTTC} disabled className="font-bold bg-slate-50" />
                    <p className="text-xs text-muted-foreground mt-1">Dont TVA: {totalTVA}</p>
                  </div>
              </div>

              {/* Ligne 3 */}
              <div>
                <Label>Bénéficiaire</Label>
                <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
              </div>
              <div>
                <Label>Fréquence</Label>
                <Select value={frequency} onValueChange={setFrequency}>
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

              {/* Ligne 4 */}
              <div>
                <Label>Prochaine exécution</Label>
                <Input type="date" value={nextExecutionDate} onChange={(e) => setNextExecutionDate(e.target.value)} />
              </div>
              <div>
                 <Label>Méthode Paiement</Label>
                 <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Virement">Virement</SelectItem>
                        <SelectItem value="Chèque">Chèque</SelectItem>
                        <SelectItem value="Espèces">Espèces</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </div>

            {/* Retenue */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Switch checked={hasWithholdingTax} onCheckedChange={setHasWithholdingTax} />
                <Label>Retenue à la source</Label>
              </div>
              {hasWithholdingTax && (
                <div className="ml-6 flex gap-4 items-center">
                  <Select value={withholdingTaxRate} onValueChange={setWithholdingTaxRate}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{WITHHOLDING_TAX_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-sm font-medium text-destructive">
                    - {((parseFloat(totalHT) || 0) * (parseFloat(withholdingTaxRate) / 100)).toFixed(3)} TND
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Annuler</Button>
              <Button onClick={handleSave}>Enregistrer</Button>
            </div>
          </div>
        )}

        {/* LISTE EXISTANTE */}
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre / Bénéficiaire</TableHead>
                <TableHead>Montant TTC</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Prochaine Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringExpenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>
                    <div className="font-medium">{exp.title || exp.beneficiary}</div>
                    <div className="text-xs text-muted-foreground">{exp.category}</div>
                  </TableCell>
                  <TableCell className="font-mono">{Number(exp.total_ttc || exp.amount).toFixed(3)} TND</TableCell>
                  <TableCell className="text-sm">{getFrequencyLabel(exp.frequency)}</TableCell>
                  <TableCell>{format(new Date(exp.next_execution_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={exp.status === "ACTIVE" ? "default" : "secondary"}>{exp.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toggleStatus(exp.id, exp.status)}>
                        {exp.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {recurringExpenses.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune dépense récurrente configurée.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}