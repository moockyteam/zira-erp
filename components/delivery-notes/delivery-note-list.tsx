"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Package, Truck, XCircle } from "lucide-react"
import { CompanySelector } from "@/components/company-selector"
import { DnActions } from "./delivery-note-actions"

type Dn = {
  id: string
  delivery_note_number: string
  customers: { name: string } | null
  delivery_date: string
  status: "BROUILLON" | "LIVRE" | "ANNULE"
}

export function DeliveryNoteList({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState<Dn[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])
  useEffect(() => {
    if (selectedCompanyId) fetchDns(selectedCompanyId)
    else setDeliveryNotes([])
  }, [selectedCompanyId])

  const fetchDns = async (companyId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("delivery_notes")
      .select(`id, delivery_note_number, customers(name), delivery_date, status`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
    if (error) console.error("Erreur chargement BL:", error)
    else setDeliveryNotes(data as Dn[])
    setIsLoading(false)
  }

  const stats = {
    draft: deliveryNotes.filter((dn) => dn.status === "BROUILLON").length,
    delivered: deliveryNotes.filter((dn) => dn.status === "LIVRE").length,
    cancelled: deliveryNotes.filter((dn) => dn.status === "ANNULE").length,
    total: deliveryNotes.length,
  }

  const getStatusVariant = (status: Dn["status"]): "default" | "destructive" | "success" | "secondary" => {
    if (status === "LIVRE") return "success"
    if (status === "ANNULE") return "destructive"
    return "secondary"
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Gestion des Bons de Livraison</h1>
          <p className="text-indigo-100 mt-1">Créez et suivez vos livraisons clients.</p>
        </div>
        {selectedCompanyId && (
          <Link href={`/dashboard/delivery-notes/new?companyId=${selectedCompanyId}`} passHref>
            <Button className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-indigo-50 font-semibold shadow-md">
              <PlusCircle className="h-5 w-5 mr-2" /> Nouveau BL
            </Button>
          </Link>
        )}
      </div>

      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {selectedCompanyId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total BL</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                  </div>
                  <Package className="h-10 w-10 text-blue-500 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Brouillon</p>
                    <p className="text-3xl font-bold text-amber-600">{stats.draft}</p>
                  </div>
                  <Package className="h-10 w-10 text-amber-500 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Livrés</p>
                    <p className="text-3xl font-bold text-emerald-600">{stats.delivered}</p>
                  </div>
                  <Truck className="h-10 w-10 text-emerald-500 opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Annulés</p>
                    <p className="text-3xl font-bold text-red-600">{stats.cancelled}</p>
                  </div>
                  <XCircle className="h-10 w-10 text-red-500 opacity-70" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-indigo-100 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b-2 border-indigo-100">
              <CardTitle className="text-2xl text-indigo-900">Liste des Bons de Livraison</CardTitle>
              <CardDescription className="text-indigo-700">
                Historique de tous les BL pour cette entreprise.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-indigo-100 hover:bg-indigo-50/50">
                      <TableHead className="font-bold text-indigo-900">Numéro</TableHead>
                      <TableHead className="font-bold text-indigo-900">Client</TableHead>
                      <TableHead className="font-bold text-indigo-900">Date Livraison</TableHead>
                      <TableHead className="font-bold text-indigo-900">Statut</TableHead>
                      <TableHead className="font-bold text-indigo-900">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center p-8">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-muted-foreground">Chargement...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : deliveryNotes.length > 0 ? (
                      deliveryNotes.map((dn) => (
                        <TableRow
                          key={dn.id}
                          className="hover:bg-indigo-50/50 transition-colors border-b border-indigo-50"
                        >
                          <TableCell className="font-medium text-indigo-900">{dn.delivery_note_number}</TableCell>
                          <TableCell>{dn.customers?.name || "N/A"}</TableCell>
                          <TableCell>{new Date(dn.delivery_date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(dn.status)} className="font-semibold">
                              {dn.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DnActions dn={dn} onActionSuccess={() => fetchDns(selectedCompanyId!)} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center p-8 text-muted-foreground">
                          Aucun BL pour cette entreprise.
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
