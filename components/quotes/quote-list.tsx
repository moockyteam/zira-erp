// components/quotes/quote-list.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle } from "lucide-react"
import { CompanySelector } from "@/components/company-selector"
import { QuoteActions } from "./quote-actions";

// Définition des types
type CompanyForList = { id: string; name: string; logo_url: string | null; }
type QuoteStatus = 'BROUILLON' | 'ENVOYE' | 'CONFIRME' | 'REFUSE';
type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  prospect_name: string | null;
  customers: { name: string } | null;
  quote_date: string;
  total_ttc: number;
  status: QuoteStatus; // <-- J'utilise mon type
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
      .order('created_at', { ascending: false })
    
    if (error) console.error("Erreur chargement devis:", error)
    else setQuotes(data as Quote[])
    
    setIsLoading(false)
  }

  // --- NOUVELLE FONCTION POUR LA MISE À JOUR LOCALE DE L'UI ---
  const handleStatusChange = (quoteId: string, newStatus: QuoteStatus) => {
    setQuotes(currentQuotes =>
      currentQuotes.map(quote =>
        quote.id === quoteId ? { ...quote, status: newStatus } : quote
      )
    );
  };

  const getStatusVariant = (status: QuoteStatus) => {
    switch (status) {
      case 'BROUILLON': return 'secondary'
      case 'ENVOYE': return 'default'
      case 'CONFIRME': return 'success'
      case 'REFUSE': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-8">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour voir ses devis.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Liste des Devis</CardTitle>
              <CardDescription>Historique de tous les devis pour cette entreprise.</CardDescription>
            </div>
            <Link href={`/dashboard/quotes/new?companyId=${selectedCompanyId}`} passHref>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Nouveau Devis
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client / Prospect</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Chargement...</TableCell></TableRow>
                ) : quotes.length > 0 ? (
                  quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number}</TableCell>
                      <TableCell>{quote.customers?.name || quote.prospect_name}</TableCell>
                      <TableCell>{new Date(quote.quote_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(quote.status)}>{quote.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{quote.total_ttc.toFixed(3)} TND</TableCell>
                      <TableCell>
                       {/* --- J'ai mis à jour les props passées à QuoteActions --- */}
                       <QuoteActions
                          quoteId={quote.id}
                          currentStatus={quote.status}
                          onStatusChange={(newStatus) => handleStatusChange(quote.id, newStatus)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center">Aucun devis pour cette entreprise.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}