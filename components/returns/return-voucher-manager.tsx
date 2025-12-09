"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { CompanySelector } from "@/components/company-selector"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Package, PackageX, TrendingDown } from "lucide-react"
import { ReturnVoucherActions } from "./return-voucher-actions"

export function ReturnVoucherManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [returns, setReturns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (userCompanies?.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])
  useEffect(() => {
    if (selectedCompanyId) fetchReturns(selectedCompanyId)
    else setReturns([])
  }, [selectedCompanyId])

  const fetchReturns = async (companyId: string) => {
    setIsLoading(true)
    const { data } = await supabase
      .from("return_vouchers")
      .select(`*, customers(name)`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
    setReturns(data || [])
    setIsLoading(false)
  }

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
                <Link href={`/dashboard/returns/new?companyId=${selectedCompanyId}`} passHref>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all">
                    <PlusCircle className="h-4 w-4 mr-2" /> Nouveau Bon de Retour
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border-2 border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-950/30 dark:hover:to-purple-950/30">
                      <TableHead className="font-semibold border-r-2">Numéro</TableHead>
                      <TableHead className="font-semibold border-r-2">Client</TableHead>
                      <TableHead className="font-semibold border-r-2">Date</TableHead>
                      <TableHead className="font-semibold border-r-2">Réf. Document</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Chargement...
                        </TableCell>
                      </TableRow>
                    ) : returns.length > 0 ? (
                      returns.map((r) => (
                        <TableRow
                          key={r.id}
                          className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors border-b-2"
                        >
                          <TableCell className="font-medium border-r-2">{r.return_voucher_number}</TableCell>
                          <TableCell className="border-r-2">{r.customers?.name}</TableCell>
                          <TableCell className="border-r-2">
                            {new Date(r.return_date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="border-r-2">{r.source_document_ref || "-"}</TableCell>
                          <TableCell>
                            <ReturnVoucherActions returnVoucher={r} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Aucun bon de retour pour le moment
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
