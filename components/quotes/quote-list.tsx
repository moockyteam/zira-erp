// components/quotes/quote-list.tsx
"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, FileText, Clock, CheckCircle, XCircle } from "lucide-react"
import { CompanySelector } from "@/components/company-selector"
import { QuoteActions } from "./quote-actions"

type CompanyForList = { id: string; name: string; logo_url: string | null }
type QuoteStatus = "BROUILLON" | "ENVOYE" | "CONFIRME" | "REFUSE"
type Quote = {
  id: string
  quote_number: string
  customer_id: string | null
  prospect_name: string | null
  customers: { name: string } | null
  quote_date: string
  total_ttc: number
  status: QuoteStatus
}

export function QuoteList({ userCompanies }: { userCompanies: CompanyForList[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (userCompanies && userCompanies.length === 1) {
      setSelectedCompanyId(userCompanies[0].id)
    }
  }, [userCompanies])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchQuotes(selectedCompanyId)
    } else {
      setQuotes([])
    }
  }, [selectedCompanyId])

  const fetchQuotes = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("quotes")
      .select(`id, quote_number, customer_id, prospect_name, customers ( name ), quote_date, total_ttc, status`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) console.error("Erreur chargement devis:", error)
    else setQuotes(data as Quote[])

    setIsLoading(false)
  }

  const handleStatusChange = (quoteId: string, newStatus: QuoteStatus) => {
    setQuotes((currentQuotes) =>
      currentQuotes.map((quote) => (quote.id === quoteId ? { ...quote, status: newStatus } : quote)),
    )
  }

  const stats = useMemo(() => {
    const total = quotes.reduce((sum, q) => sum + q.total_ttc, 0)
    const brouillons = quotes.filter((q) => q.status === "BROUILLON").length
    const envoyes = quotes.filter((q) => q.status === "ENVOYE").length
    const confirmes = quotes.filter((q) => q.status === "CONFIRME").length
    const refuses = quotes.filter((q) => q.status === "REFUSE").length
    const montantConfirmes = quotes.filter((q) => q.status === "CONFIRME").reduce((sum, q) => sum + q.total_ttc, 0)

    return { total, brouillons, envoyes, confirmes, refuses, montantConfirmes }
  }, [quotes])

  const getStatusVariant = (status: QuoteStatus) => {
    switch (status) {
      case "BROUILLON":
        return "secondary"
      case "ENVOYE":
        return "default"
      case "CONFIRME":
        return "success"
      case "REFUSE":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12 border-2 border-dashed">
          <CardContent>
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour voir ses devis.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">Total Devis</CardDescription>
                  <FileText className="h-4 w-4 text-indigo-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                  {stats.total.toFixed(3)} TND
                </div>
                <p className="text-xs text-muted-foreground mt-1">{quotes.length} devis au total</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">En Attente</CardDescription>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {stats.brouillons + stats.envoyes}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.brouillons} brouillon{stats.brouillons > 1 ? "s" : ""}, {stats.envoyes} envoyé
                  {stats.envoyes > 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">Confirmés</CardDescription>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {stats.montantConfirmes.toFixed(3)} TND
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.confirmes} devis confirmé{stats.confirmes > 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">Refusés</CardDescription>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.refuses}</div>
                <p className="text-xs text-muted-foreground mt-1">devis refusé{stats.refuses > 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b-2 border-indigo-100 dark:border-indigo-900">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Liste des Devis
                  </CardTitle>
                  <CardDescription className="mt-1 font-medium">
                    Historique de tous les devis pour cette entreprise
                  </CardDescription>
                </div>
                <Link href={`/dashboard/quotes/new?companyId=${selectedCompanyId}`} passHref>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nouveau Devis
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-bold">Numéro</TableHead>
                      <TableHead className="font-bold">Client / Prospect</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Statut</TableHead>
                      <TableHead className="text-right font-bold">Montant TTC</TableHead>
                      <TableHead className="font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                            <p className="text-muted-foreground">Chargement des devis...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : quotes.length > 0 ? (
                      quotes.map((quote) => (
                        <TableRow
                          key={quote.id}
                          className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
                        >
                          <TableCell className="font-semibold text-indigo-700 dark:text-indigo-400">
                            {quote.quote_number}
                          </TableCell>
                          <TableCell className="font-medium">{quote.customers?.name || quote.prospect_name}</TableCell>
                          <TableCell>{new Date(quote.quote_date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(quote.status)} className="font-medium">
                              {quote.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-lg">
                            {quote.total_ttc.toFixed(3)} TND
                          </TableCell>
                          <TableCell>
                            <QuoteActions
                              quoteId={quote.id}
                              currentStatus={quote.status}
                              onStatusChange={(newStatus) => handleStatusChange(quote.id, newStatus)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">Aucun devis pour cette entreprise.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
