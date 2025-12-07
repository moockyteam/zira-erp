// Créez le dossier et le fichier : components/delivery-notes/delivery-note-list.tsx

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
import { DnActions } from "./delivery-note-actions"; 

type Dn = {
  id: string;
  delivery_note_number: string;
  customers: { name: string } | null;
  delivery_date: string;
  status: 'BROUILLON' | 'LIVRE' | 'ANNULE';
}

export function DeliveryNoteList({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState<Dn[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => { if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id) }, [userCompanies])
  useEffect(() => { if (selectedCompanyId) fetchDns(selectedCompanyId); else setDeliveryNotes([]); }, [selectedCompanyId])

  const fetchDns = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase.from("delivery_notes").select(`id, delivery_note_number, customers(name), delivery_date, status`).eq("company_id", companyId).order('created_at', { ascending: false })
    if (error) console.error("Erreur chargement BL:", error)
    else setDeliveryNotes(data as Dn[])
    setIsLoading(false)
  }

  const getStatusVariant = (status: Dn['status']): "default" | "destructive" | "success" | "secondary" => {
    if (status === 'LIVRE') return 'success'
    if (status === 'ANNULE') return 'destructive'
    return 'secondary'
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
              <h1 className="text-2xl font-bold">Gestion des Bons de Livraison</h1>
              <p className="text-muted-foreground">Créez et suivez vos livraisons.</p>
          </div>
          {selectedCompanyId && <Link href={`/dashboard/delivery-notes/new?companyId=${selectedCompanyId}`} passHref><Button className="w-full sm:w-auto"><PlusCircle className="h-4 w-4 mr-2" /> Nouveau BL</Button></Link>}
      </div>

      <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} />

      {selectedCompanyId && (
        <Card>
          <CardHeader>
            <CardTitle>Liste des Bons de Livraison</CardTitle>
            <CardDescription>Historique de tous les BL pour cette entreprise.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Numéro</TableHead><TableHead>Client</TableHead><TableHead>Date Livraison</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5} className="text-center p-8">Chargement...</TableCell></TableRow> :
                 deliveryNotes.length > 0 ? deliveryNotes.map((dn) => (
                    <TableRow key={dn.id}>
                      <TableCell className="font-medium">{dn.delivery_note_number}</TableCell>
                      <TableCell>{dn.customers?.name || 'N/A'}</TableCell>
                      <TableCell>{new Date(dn.delivery_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(dn.status)}>{dn.status}</Badge></TableCell>
                      <TableCell><DnActions dn={dn} onActionSuccess={() => fetchDns(selectedCompanyId!)} /></TableCell>
                    </TableRow>
                 )) : <TableRow><TableCell colSpan={5} className="text-center p-8">Aucun BL pour cette entreprise.</TableCell></TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}