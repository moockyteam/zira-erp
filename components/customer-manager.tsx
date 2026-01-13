"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Info, ArrowUpDown, ChevronUp, ChevronDown, CreditCard, History, Users, PlusCircle, Download, Upload } from "lucide-react"
import * as XLSX from "xlsx"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompany } from "@/components/providers/company-provider"
import { CustomerImportDialog } from "@/components/customer-import-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FilterToolbar } from "@/components/ui/filter-toolbar"
import { GlobalPaymentDialog } from "./customers/global-payment-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Customer = {
  id: string
  name: string
  customer_type: 'PARTICULIER' | 'ENTREPRISE'
  contact_person: string | null
  email: string | null
  phone_number: string | null
  matricule_fiscal: string | null
  balance: number | null
  calculated_balance?: number | null
}

type SortConfig = {
  key: keyof Customer | 'balance'
  direction: 'asc' | 'desc'
}

export function CustomerManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const { selectedCompany } = useCompany()

  const selectedCompanyId = selectedCompany?.id
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(false)

  // -- FILTER & SORT STATE --
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' })

  // -- PAYMENT STATE --
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<{ id: string, name: string } | null>(null)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchCustomers = async (companyId: string) => {
    setIsInitialLoading(true)
    const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order('name')
    if (error) {
      toast.error("Impossible de charger les clients.")
      console.error("fetchCustomers Error:", JSON.stringify(error, null, 2))
    } else {
      const mappedData = data.map((c: any) => ({
        ...c,
        // Balance is now a real column updated by triggers
        balance: c.balance || 0
      }))
      setCustomers(mappedData as Customer[])
    }
    setIsInitialLoading(false)
  }

  // -- FILTERED & SORTED DATA --
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers]

    // 1. Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter(c =>
        c.name?.toLowerCase().includes(lowerTerm) ||
        c.email?.toLowerCase().includes(lowerTerm) ||
        c.contact_person?.toLowerCase().includes(lowerTerm) ||
        c.matricule_fiscal?.toLowerCase().includes(lowerTerm)
      )
    }

    // 2. Sort
    result.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue === bValue) return 0

      // Handle nulls always last or first? Let's treat null as empty/zero
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })

    return result
  }, [customers, searchTerm, sortConfig])


  const handleSort = (key: keyof Customer | 'balance') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground opacity-50" />
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-1 h-3 w-3 text-primary" />
  }

  const handleEditClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`)
  }

  const handleAddNewClick = () => {
    router.push("/dashboard/customers/new")
  }

  const handleHistoryClick = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation()
    router.push(`/dashboard/customers/${customerId}?tab=history`)
  }

  const handlePaymentClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    setPaymentCustomer({ id: customer.id, name: customer.name })
    setPaymentOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation(); // Prevent row click
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.")) {
      const { error } = await supabase.from('customers').delete().eq('id', customerId)
      if (error) {
        toast.error("Erreur lors de la suppression.")
      } else {
        toast.success("Client supprimé.")
        await fetchCustomers(selectedCompanyId!)
      }
    }
  }

  const handleExport = () => {
    const exportData = filteredAndSortedCustomers.map(c => ({
      "Nom": c.name,
      "Type": c.customer_type,
      "Contact": c.contact_person,
      "Email": c.email,
      "Téléphone": c.phone_number,
      "Matricule Fiscal": c.matricule_fiscal,
      "Solde": c.balance,
      "Identifiant": c.id
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Clients")
    XLSX.writeFile(wb, "liste_clients.xlsx")
  }

  return (
    <div className="space-y-6">
      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent><p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses clients.</p></CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          <PageHeader
            title="Liste des Clients"
            description="Gérez vos clients et leurs adresses."
            icon={Users}
          >
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>

              <CustomerImportDialog
                companyId={selectedCompanyId}
                onImportSuccess={() => fetchCustomers(selectedCompanyId!)}
                trigger={
                  <Button variant="outline" size="sm" className="h-9">
                    <Upload className="mr-2 h-4 w-4" />
                    Importer
                  </Button>
                }
              />

              <Button size="lg" className="shadow-sm" onClick={handleAddNewClick}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Ajouter un client
              </Button>
            </div>
          </PageHeader>

          <FilterToolbar
            className="mb-4"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Rechercher par nom, email, contact..."
            resultCount={filteredAndSortedCustomers.length}
            resultLabel={filteredAndSortedCustomers.length > 1 ? "clients trouvés" : "client trouvé"}
            onReset={() => { setSearchTerm(""); setSortConfig({ key: 'name', direction: 'asc' }); }}
            showReset={!!searchTerm || sortConfig.key !== 'name' || sortConfig.direction !== 'asc'}
          />

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">Nom {renderSortIcon('name')}</div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => handleSort('contact_person')}>
                      <div className="flex items-center">Contact {renderSortIcon('contact_person')}</div>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Matricule</TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('balance')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Solde {renderSortIcon('balance')}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Solde = Total Facturé (Non annulé) - Total Payé + Solde Initial.<br />Un solde positif indique un montant dû par le client.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInitialLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-[70px] ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredAndSortedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        {searchTerm ? "Aucun client ne correspond à votre recherche." : (
                          <>
                            Aucun client trouvé.
                            <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                              Ajoutez votre premier client.
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedCustomers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEditClick(customer.id)}
                      >
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell><Badge variant={customer.customer_type === 'ENTREPRISE' ? 'default' : 'secondary'}>{customer.customer_type}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col text-sm">
                            <span>{customer.contact_person}</span>
                            <span className="text-muted-foreground text-xs">{customer.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{customer.matricule_fiscal || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {customer.balance != null ? (
                            <span className={
                              customer.balance > 0.001
                                ? "text-destructive font-bold" // Customer owes money
                                : customer.balance < -0.001
                                  ? "text-emerald-600 font-bold" // Company owes money (Credit)
                                  : "text-muted-foreground" // Zero
                            }>
                              {customer.balance.toFixed(3)}
                              {customer.balance < -0.001 && <span className="text-[10px] ml-1 uppercase text-emerald-600/70">(Crédit)</span>}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => handlePaymentClick(e, customer)} className="text-muted-foreground hover:text-emerald-600">
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Paiement Global</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => handleHistoryClick(e, customer.id)} className="text-muted-foreground hover:text-blue-600">
                                    <History className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Historique</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, customer.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}


      {/* Global Payment Dialog */}
      <GlobalPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        customerId={paymentCustomer?.id || ""}
        customerName={paymentCustomer?.name || ""}
        onPaymentComplete={() => {
          // Refresh list
          if (selectedCompanyId) fetchCustomers(selectedCompanyId)
        }}
      />
    </div >
  )
}
