"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Trash2, Wand2, Check } from "lucide-react"
import { format, addDays } from "date-fns"
import { NumericInput } from "@/components/ui/numeric-input"

interface ExpenseScheduleManagerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  expense: any
  onSuccess: () => void
}

export function ExpenseScheduleManager({ isOpen, onOpenChange, expense, onSuccess }: ExpenseScheduleManagerProps) {
  const supabase = createClient()
  const [schedules, setSchedules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Manual form
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [paymentMethod, setPaymentMethod] = useState("Chèque")
  const [reference, setReference] = useState("")

  // Auto generator
  const [genCount, setGenCount] = useState("3")
  const [genStartDate, setGenStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [genInterval, setGenInterval] = useState("30")

  useEffect(() => {
    if (isOpen && expense?.id) fetchSchedules()
  }, [isOpen, expense])

  const fetchSchedules = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("expense_schedules")
      .select("*")
      .eq("expense_id", expense.id)
      .order("due_date", { ascending: true })

    if (error) {
      // Table doesn't exist yet
      if (error.code === "42P01") {
        toast.error("Table 'expense_schedules' non créée. Créez-la manuellement dans Supabase.")
        setSchedules([])
      } else {
        toast.error("Erreur de chargement")
      }
    } else {
      setSchedules(data || [])
    }
    setIsLoading(false)
  }

  const totalScheduled = schedules.reduce((sum, s) => sum + Number.parseFloat(s.amount), 0)
  const remaining = (expense?.total_ttc || 0) - totalScheduled

  const handleAddManual = async () => {
    const payload = {
      expense_id: expense.id,
      schedule_number: schedules.length + 1,
      due_date: dueDate,
      amount: Number.parseFloat(amount),
      payment_method: paymentMethod,
      reference,
      status: "EN_ATTENTE",
    }

    const { error } = await supabase.from("expense_schedules").insert(payload)

    if (error) {
      toast.error("Erreur: " + error.message)
    } else {
      toast.success("Échéance ajoutée")
      setAmount("")
      setReference("")
      fetchSchedules()
    }
  }

  const handleGenerateAuto = async () => {
    const count = Number.parseInt(genCount)
    const interval = Number.parseInt(genInterval)
    const totalToSplit = remaining

    if (count <= 0 || totalToSplit <= 0) {
      toast.error("Paramètres invalides")
      return
    }

    const partAmount = Math.floor((totalToSplit / count) * 1000) / 1000
    const lastPartAmount = Number.parseFloat((totalToSplit - partAmount * (count - 1)).toFixed(3))

    try {
      for (let i = 0; i < count; i++) {
        const currentAmount = i === count - 1 ? lastPartAmount : partAmount
        const currentDueDate = format(addDays(new Date(genStartDate), i * interval), "yyyy-MM-dd")

        const payload = {
          expense_id: expense.id,
          schedule_number: schedules.length + i + 1,
          due_date: currentDueDate,
          amount: currentAmount,
          payment_method: "Chèque",
          reference: `Échéance ${i + 1}/${count}`,
          status: "EN_ATTENTE",
        }

        const { error } = await supabase.from("expense_schedules").insert(payload)
        if (error) throw error
      }

      toast.success(`${count} échéances générées`)
      fetchSchedules()
    } catch (error: any) {
      toast.error("Erreur: " + error.message)
    }
  }

  const markAsPaid = async (scheduleId: string) => {
    const { error } = await supabase
      .from("expense_schedules")
      .update({
        status: "PAYE",
        payment_date: format(new Date(), "yyyy-MM-dd"),
      })
      .eq("id", scheduleId)

    if (error) toast.error("Erreur")
    else {
      toast.success("Marqué comme payé")
      fetchSchedules()
    }
  }

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Supprimer cette échéance ?")) return

    const { error } = await supabase.from("expense_schedules").delete().eq("id", scheduleId)

    if (error) toast.error("Erreur")
    else {
      toast.success("Supprimée")
      fetchSchedules()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Échéancier de Paiement - {expense?.beneficiary}</DialogTitle>
          <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold">{Number.parseFloat(expense?.total_ttc || 0).toFixed(3)} TND</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Planifié</p>
              <p className="font-bold text-emerald-600">{totalScheduled.toFixed(3)} TND</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Reste</p>
              <p className="font-bold text-destructive">{remaining.toFixed(3)} TND</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="list">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Liste ({schedules.length})</TabsTrigger>
            <TabsTrigger value="manual">Ajouter Manuel</TabsTrigger>
            <TabsTrigger value="auto">
              <Wand2 className="h-4 w-4 mr-2" />
              Générateur Auto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date d'échéance</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.schedule_number}</TableCell>
                    <TableCell>{format(new Date(s.due_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono font-bold">{Number.parseFloat(s.amount).toFixed(3)} TND</TableCell>
                    <TableCell>{s.payment_method}</TableCell>
                    <TableCell className="text-sm">{s.reference}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "PAYE" ? "default" : "outline"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.status === "EN_ATTENTE" && (
                          <Button size="icon" variant="ghost" onClick={() => markAsPaid(s.id)}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 py-4 border p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant</Label>
                <NumericInput
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={remaining.toFixed(3)}
                  decimals={3}
                />
              </div>
              <div>
                <Label>Date d'échéance</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Méthode de paiement</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                    <SelectItem value="Traite">Traite</SelectItem>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Référence</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° Chèque..." />
              </div>
            </div>
            <Button onClick={handleAddManual} className="w-full">
              <PlusCircle className="h-4 w-4 mr-2" />
              Ajouter cette échéance
            </Button>
          </TabsContent>

          <TabsContent
            value="auto"
            className="space-y-4 py-4 border-2 border-indigo-100 p-4 rounded-lg bg-indigo-50/30"
          >
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Nombre d'échéances</Label>
                <NumericInput value={genCount} onChange={(e) => setGenCount(e.target.value)} decimals={0} />
              </div>
              <div>
                <Label>Date 1ère échéance</Label>
                <Input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Intervalle (jours)</Label>
                <NumericInput value={genInterval} onChange={(e) => setGenInterval(e.target.value)} decimals={0} />
              </div>
            </div>
            <div className="bg-white p-3 rounded border text-sm text-indigo-700">
              💡 Créera <strong>{genCount || 0}</strong> échéances de{" "}
              <strong>{genCount && remaining > 0 ? (remaining / Number.parseInt(genCount)).toFixed(3) : 0} TND</strong>
            </div>
            <Button onClick={handleGenerateAuto} className="w-full bg-indigo-600 hover:bg-indigo-700">
              <Wand2 className="h-4 w-4 mr-2" />
              Générer automatiquement
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onSuccess()
              onOpenChange(false)
            }}
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
