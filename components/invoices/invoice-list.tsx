// Placez ce code dans : components/invoices/invoice-list.tsx

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle } from "lucide-react"
import { InvoiceActions } from "./invoice-actions"
import { CompanySelector } from "@/components/company-selector"

type CompanyForList = { id: string; name: string; logo_url: string | null; }
type InvoiceStatus = 'BROUILLON' | 'ENVOYE' | 'PAYEE' | 'PARTIELLEMENT_PAYEE' | 'ANNULEE';

type Invoice = {
  id: string;
  invoice_number: string;
  customers: { name: string } | null;
  invoice_date: string;
  due_date: string;
  total_ttc: number;
  status: InvoiceStatus;
  total_paid: number;
  amount_due: number;
}

export function InvoiceList({ userCompanies }: { userCompanies: CompanyForList[] }) {
  const supabase = createClient()

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)

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
      .select(`id, invoice_number, customers ( name ), invoice_date, due_date, total_ttc, status, total_paid, amount_due`)
      .eq("company_id", companyId)
      .order('created_at', { ascending: false })
    
    if (error) {
        console.error("Erreur lors du chargement des factures:", error)
    } else {
        setInvoices(data as Invoice[])
    }
    
    setIsLoading(false)
  }

  const getStatusVariant = (status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case 'BROUILLON': return 'secondary'
      case 'ENVOYE': return 'default'
      case 'PARTIELLEMENT_PAYEE': return 'outline'
      case 'PAYEE': return 'success'
      case 'ANNULEE': return 'destructive'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
              <h1 className="text-2xl font-bold">Gestion des Factures</h1>
              <p className="text-muted-foreground">
                  Créez, envoyez et suivez le paiement de vos factures.
              </p>
          </div>
          {selectedCompanyId && (
              <Link href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`} passHref>
                  <Button className="w-full sm:w-auto">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Nouvelle Facture
                  </Button>
              </Link>
          )}
      </div>

      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise pour voir ses factures.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card>
          <CardHeader>
            <CardTitle>Liste des Factures</CardTitle>
            <CardDescription>Historique de toutes les factures pour l'entreprise sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date Facture</TableHead>
                  <TableHead>Date Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center p-8">Chargement...</TableCell></TableRow>
                ) : invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customers?.name || 'N/A'}</TableCell>
                      <TableCell>{new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(invoice.status)}>{invoice.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{invoice.total_ttc.toFixed(3)} TND</TableCell>
                      <TableCell>
                       <InvoiceActions 
                           invoice={invoice} 
                           onActionSuccess={() => fetchInvoices(selectedCompanyId!)}
                         />
                       </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center p-8">
                        Aucune facture trouvée pour cette entreprise.
                        <Link href={`/dashboard/invoices/new?companyId=${selectedCompanyId}`} className="ml-2 text-primary underline">
                            Créez la première !
                        </Link>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}