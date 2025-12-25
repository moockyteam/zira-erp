// components/purchase-orders/po-list.tsx

"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { useCompany } from "@/components/providers/company-provider" // Add import
// import { CompanySelector } from "@/components/company-selector" // REMOVE
import { PurchaseOrderActions } from "./po-actions"

type Company = { id: string; name: string }
type POStatus = "BROUILLON" | "ENVOYE" | "RECU" | "ANNULE"
type PurchaseOrder = {
  id: string
  po_number: string
  suppliers: { name: string } | null
  order_date: string
  total_ttc: number
  status: POStatus
}

export function PurchaseOrderList({ userCompanies }: { userCompanies: Company[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany() // Context usage

  // const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null) // Remove local state
  const selectedCompanyId = selectedCompany?.id

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Remove props sync effect
  /*
  useEffect(() => {
    if (userCompanies && userCompanies.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])
  */

  useEffect(() => {
    if (selectedCompanyId) fetchPOs(selectedCompanyId)
    else setPurchaseOrders([])
  }, [selectedCompanyId])

  const fetchPOs = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`id, po_number, suppliers ( name ), order_date, total_ttc, status`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) console.error("Erreur chargement BC:", error)
    else setPurchaseOrders(data as PurchaseOrder[])
    setIsLoading(false)
  }

  const handleStatusChange = (poId: string, newStatus: POStatus) => {
    setPurchaseOrders(currentPOs =>
      currentPOs.map(po => (po.id === poId ? { ...po, status: newStatus } : po)),
    )
  }

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po =>
      po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.suppliers?.name && po.suppliers.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [purchaseOrders, searchTerm])

  const getStatusVariant = (status: POStatus) => {
    switch (status) {
      case "BROUILLON": return "secondary"
      case "ENVOYE": return "default"
      case "RECU": return "success"
      case "ANNULE": return "destructive"
      default: return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bons de Commande</h1>
        {selectedCompanyId && (
          <Link href={`/dashboard/purchase-orders/new?companyId=${selectedCompanyId}`} passHref>
            <Button>Nouveau Bon de Commande</Button>
          </Link>
        )}
      </div>

      {/* <CompanySelector companies={userCompanies} selectedCompanyId={selectedCompanyId} onCompanySelect={setSelectedCompanyId} /> */}

      {selectedCompanyId && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des commandes</CardTitle>
            <CardDescription>Liste de toutes les commandes passées pour cette entreprise.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <SearchInput placeholder="Rechercher par N° ou fournisseur..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClear={() => setSearchTerm("")} wrapperClassName="max-w-sm" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Chargement...</TableCell></TableRow>
                ) : filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>{po.suppliers?.name || '-'}</TableCell>
                      <TableCell>{new Date(po.order_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(po.status)}>{po.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{po.total_ttc.toFixed(3)} TND</TableCell>
                      <TableCell>
                        <PurchaseOrderActions
                          poId={po.id}
                          currentStatus={po.status}
                          onStatusChange={handleStatusChange}
                          onActionSuccess={() => fetchPOs(selectedCompanyId!)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">Aucun bon de commande trouvé.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
