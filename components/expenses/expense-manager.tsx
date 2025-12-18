"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import { CompanySelector } from "@/components/company-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { DateRange } from "react-day-picker"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { PlusCircle, Download, FileUp, Calendar, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseDashboard } from "./expense-dashboard"
import { RecurringExpenseManager } from "./recurring-expense-manager"
import { ExpenseScheduleManager } from "./expense-schedule-manager"

export function ExpenseManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [searchTerm, setSearchTerm] = useState("")

  // Dialogs
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [selectedExpenseForSchedule, setSelectedExpenseForSchedule] = useState<any>(null)

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchExpenses(selectedCompanyId)
      fetchCategories(selectedCompanyId)
    } else {
      setExpenses([])
    }
  }, [selectedCompanyId])

  const fetchExpenses = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .eq("company_id", companyId)
      .order("payment_date", { ascending: false })

    if (error) toast.error("Impossible de charger les dépenses")
    setExpenses(data || [])
    setIsLoading(false)
  }

  const fetchCategories = async (companyId: string) => {
    const { data } = await supabase.from("expense_categories").select("*").eq("company_id", companyId)
    setCategories(data || [])
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Date filter
      if (dateRange?.from) {
        const expenseDate = new Date(e.payment_date)
        const to = dateRange.to || dateRange.from
        if (expenseDate < dateRange.from || expenseDate > to) return false
      }

      // Status filter
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false

      // Category filter
      if (categoryFilter !== "ALL" && e.category_id !== categoryFilter) return false

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return (
          e.beneficiary?.toLowerCase().includes(search) ||
          e.reference?.toLowerCase().includes(search) ||
          e.expense_categories?.name?.toLowerCase().includes(search)
        )
      }

      return true
    })
  }, [expenses, dateRange, statusFilter, categoryFilter, searchTerm])

  const handleExport = () => {
    toast.info("La fonctionnalité d'exportation sera bientôt disponible")
  }

  return (
    <div className="space-y-6">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {selectedCompanyId && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Gestion des Dépenses</h2>
              <p className="text-muted-foreground">Suivez et gérez toutes vos dépenses</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowRecurringDialog(true)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Dépenses Récurrentes
              </Button>
              <Link href={`/dashboard/expenses/new?companyId=${selectedCompanyId}`}>
                <Button size="lg">
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Nouvelle Dépense
                </Button>
              </Link>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
              <TabsTrigger value="list">Liste Complète</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <ExpenseDashboard companyId={selectedCompanyId} />
            </TabsContent>

            <TabsContent value="list">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Historique des Dépenses</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tous les statuts</SelectItem>
                        <SelectItem value="PAYE">Payé</SelectItem>
                        <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Toutes catégories</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="md:col-span-2"
                    />
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right">HT</TableHead>
                        <TableHead className="text-right">TVA</TableHead>
                        <TableHead className="text-right">TTC</TableHead>
                        <TableHead>Échéancier</TableHead>
                        <TableHead>Pièce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center">
                            Chargement...
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExpenses.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{new Date(p.payment_date).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell className="font-medium">{p.beneficiary}</TableCell>
                            <TableCell>{p.expense_categories?.name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === "PAYE" ? "default" : "destructive"}>{p.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{p.currency || "TND"}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number.parseFloat(p.total_ht).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number.parseFloat(p.total_tva).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {Number.parseFloat(p.total_ttc).toFixed(3)}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedExpenseForSchedule(p)}>
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell>
                              {p.attachment_url && (
                                <a href={p.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="icon">
                                    <FileUp className="h-4 w-4" />
                                  </Button>
                                </a>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className="mt-4 text-sm text-muted-foreground">
                    {filteredExpenses.length} dépense(s) affichée(s)
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <RecurringExpenseManager
        isOpen={showRecurringDialog}
        onOpenChange={setShowRecurringDialog}
        companyId={selectedCompanyId || ""}
      />

      {selectedExpenseForSchedule && (
        <ExpenseScheduleManager
          isOpen={!!selectedExpenseForSchedule}
          onOpenChange={(open) => !open && setSelectedExpenseForSchedule(null)}
          expense={selectedExpenseForSchedule}
          onSuccess={() => fetchExpenses(selectedCompanyId!)}
        />
      )}
    </div>
  )
}
