//components/returns/return-voucher-manager.tsx
"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { CompanySelector } from "@/components/company-selector"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Package, PackageX, TrendingDown } from "lucide-react"
import { ReturnVoucherActions } from "./return-voucher-actions"
import { ReturnVoucherForm } from "./return-voucher-form"
import { Skeleton } from "@/components/ui/skeleton"

export function ReturnVoucherManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [returns, setReturns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReturn, setEditingReturn] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])

  useEffect(() => {
    if (selectedCompanyId) fetchReturns(selectedCompanyId)
    else {
      setReturns([])
      setIsLoading(false)
    }
  }, [selectedCompanyId])

  const fetchReturns = async (companyId: string) => {
    setIsLoading(true)
    // --- LA CORRECTION EST ICI ---
    // On demande explicitement de récupérer aussi les lignes associées
    const { data, error } = await supabase
      .from("return_vouchers")
      .select(`
        *, 
        customers(id, name),
        return_voucher_lines(*)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur lors du chargement des bons de retour:", error);
      // Gérer l'erreur avec un toast serait une bonne pratique
    } else {
      setReturns(data || [])
    }
    // --- FIN DE LA CORRECTION ---
    setIsLoading(false)
  }

  const handleOpenForm = (returnVoucher: any | null) => {
    setEditingReturn(returnVoucher)
    setIsFormOpen(true)
  }

  const filteredReturns = useMemo(() => {
    if (!returns) return []
    return returns.filter(r =>
      r.return_voucher_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [returns, searchTerm])

  const totalReturns = returns.length
  const thisMonthReturns = returns.filter((r) => {
    const returnDate = new Date(r.return_date)
    const now = new Date()
    return returnDate.getMonth() === now.getMonth() && returnDate.getFullYear() === now.getFullYear()
  }).length
  const totalItems = returns.reduce((sum, r) => sum + (r.return_voucher_lines?.length || 0), 0)

  return (
    <div className="space-y-6">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />

      {selectedCompanyId && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Retours</CardTitle>
                <Package className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {totalReturns}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tous les bons de retour</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ce Mois</CardTitle>
                <TrendingDown className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{thisMonthReturns}</div>
                <p className="text-xs text-muted-foreground mt-1">Retours du mois en cours</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Articles Retournés</CardTitle>
                <PackageX className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{totalItems}</div>
                <p className="text-xs text-muted-foreground mt-1">Total d'articles retournés</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-b-2 border-indigo-200/50">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Historique des Bons de Retour
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Liste de toutes les marchandises retournées par vos clients
                  </CardDescription>
                </div>
                <Button onClick={() => handleOpenForm(null)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all">
                  <PlusCircle className="h-4 w-4 mr-2" /> Nouveau Bon de Retour
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-4">
                <SearchInput placeholder="Rechercher par N° ou client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClear={() => setSearchTerm("")} wrapperClassName="max-w-sm" />
              </div>
              <div className="rounded-lg border-2 border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-950/30 dark:hover:to-purple-950/30">
                      <TableHead className="font-semibold border-r-2">Numéro</TableHead>
                      <TableHead className="font-semibold border-r-2">Client</TableHead>
                      <TableHead className="font-semibold border-r-2">Date</TableHead>
                      <TableHead className="font-semibold border-r-2">Statut</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                    ) : filteredReturns.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun bon de retour.</TableCell></TableRow>
                    ) : (
                      filteredReturns.map((r) => (
                        <TableRow
                          key={r.id}
                          className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors border-b-2"
                        >
                          <TableCell className="font-medium border-r-2">{r.return_voucher_number}</TableCell>
                          <TableCell className="border-r-2">{r.customers?.name}</TableCell>
                          <TableCell className="border-r-2">
                            {new Date(r.return_date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="border-r-2"><Badge variant={r.status === 'RETOURNE' ? 'success' : 'secondary'}>{r.status}</Badge></TableCell>
                          <TableCell>
                            <ReturnVoucherActions returnVoucher={r} onEdit={() => handleOpenForm(r)} onActionSuccess={() => fetchReturns(selectedCompanyId!)} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isFormOpen && (
        <ReturnVoucherForm
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          companyId={selectedCompanyId!}
          initialData={editingReturn}
          onSuccess={() => fetchReturns(selectedCompanyId!)}
        />
      )}
    </div>
  )
}
