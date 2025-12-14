// components/invoices/invoice-list.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react"
import { InvoiceActions } from "./invoice-actions"
import { CompanySelector } from "@/components/company-selector"
import { useSearchParams } from "next/navigation" // NOUVEAU


type CompanyForList = { id: string; name: string; logo_url: string | null }
type InvoiceStatus = "BROUILLON" | "ENVOYE" | "PAYEE" | "PARTIELLEMENT_PAYEE" | "ANNULEE"

type Invoice = {
  id: string
  invoice_number: string
  customers: { name: string } | null
  invoice_date: string
  due_date: string
  total_ttc: number
  status: InvoiceStatus
  total_paid: number
  amount_due: number
}

export function InvoiceList({ userCompanies }: { userCompanies: CompanyForList[] }) {
  const supabase = createClient()
 const searchParams = useSearchParams() 
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 })
  useEffect(() => {
    const customerIdFromUrl = searchParams.get('customerId')
    if (customerIdFromUrl) {
      // Ici, vous pourriez pré-filtrer la liste si vous le souhaitez,
      // ou simplement afficher la page normalement.
      // Pour l'instant, on ne fait rien de plus, mais le lien fonctionnera.
    }
  }, [searchParams])
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies, selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchInvoices(selectedCompanyId)
    } else {
      setInvoices([])
    }
  }, [selectedCompanyId])

  const fetchInvoices = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("invoices_with_totals")
      .select(
        `id, invoice_number, customers ( name ), invoice_date, due_date, total_ttc, status, total_paid, amount_due`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur lors du chargement des factures:", error)
    } else {
      setInvoices(data as Invoice[])
      const totalAmount = data.reduce((sum, inv) => sum + inv.total_ttc, 0)
      const paidAmount = data.filter((inv) => inv.status === "PAYEE").reduce((sum, inv) => sum + inv.total_ttc, 0)
      const pendingAmount = data
        .filter((inv) => inv.status === "ENVOYE" || inv.status === "PARTIELLEMENT_PAYEE")
        .reduce((sum, inv) => sum + inv.amount_due, 0)
      const overdueCount = data.filter(
        (inv) =>
          (inv.status === "ENVOYE" || inv.status === "PARTIELLEMENT_PAYEE") && new Date(inv.due_date) < new Date(),
      ).length

      setStats({ total: totalAmount, paid: paidAmount, pending: pendingAmount, overdue: overdueCount })
    }

    setIsLoading(false)
  }

  const getStatusVariant = (status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case "BROUILLON":
        return "secondary"
      case "ENVOYE":
        return "default"
      case "PARTIELLEMENT_PAYEE":
        return "outline"
      case "PAYEE":
        return "success"
      case "ANNULEE":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 dark:from-indigo-950/20 dark:via-background dark:to-emerald-950/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-900/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 dark:from-indigo-400 dark:to-emerald-400 bg-clip-text text-transparent">
                Gestion des Factures
              </h1>
            </div>
            <p className="text-muted-foreground ml-12">
              Créez, envoyez et suivez le paiement de vos factures en temps réel.
            </p>
          </div>
          {selectedCompanyId && (
            <Link href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`} passHref>
              <Button
                size="lg"
                className="w-full sm:w-auto shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                Nouvelle Facture
              </Button>
            </Link>
          )}
        </div>
      </div>

      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {selectedCompanyId && invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Facturé</p>
                  <p className="text-2xl font-bold mt-1">{stats.total.toFixed(0)} TND</p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payé</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                    {stats.paid.toFixed(0)} TND
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">En Attente</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                    {stats.pending.toFixed(0)} TND
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-full">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">En Retard</p>
                  <p className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">{stats.overdue}</p>
                </div>
                <div className="p-3 bg-rose-100 dark:bg-rose-900/20 rounded-full">
                  <FileText className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour voir ses factures.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
            <CardTitle>Liste des Factures</CardTitle>
            <CardDescription>Historique de toutes les factures pour l'entreprise sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Numéro</TableHead>
                    <TableHead className="font-semibold">Client</TableHead>
                    <TableHead className="font-semibold">Date Facture</TableHead>
                    <TableHead className="font-semibold">Date Échéance</TableHead>
                    <TableHead className="font-semibold">Statut</TableHead>
                    <TableHead className="text-right font-semibold">Montant TTC</TableHead>
                    <TableHead className="text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center p-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
                          <p className="text-muted-foreground">Chargement des factures...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <TableCell className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell className="font-medium">{invoice.customers?.name || "N/A"}</TableCell>
                        <TableCell>{new Date(invoice.invoice_date).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(invoice.status)} className="font-medium">
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg">
                          {invoice.total_ttc.toFixed(3)} TND
                        </TableCell>
                        <TableCell className="text-center">
                          <InvoiceActions invoice={invoice} onActionSuccess={() => fetchInvoices(selectedCompanyId!)} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center p-12">
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium mb-1">Aucune facture trouvée</p>
                            <Link
                              href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                              Créez votre première facture →
                            </Link>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
