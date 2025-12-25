
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, Info, Check, X, MapPin } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompany } from "@/components/providers/company-provider"
import { CustomerImportDialog } from "@/components/customer-import-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

export function CustomerManager({ userCompanies }: { userCompanies: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const { selectedCompany } = useCompany()

  const selectedCompanyId = selectedCompany?.id
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(false)

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchCustomers = async (companyId: string) => {
    setIsInitialLoading(true)
    const { data, error } = await supabase.from("customers_with_balance").select("*").eq("company_id", companyId).order('name')
    if (error) {
      toast.error("Impossible de charger les clients.")
      console.error("fetchCustomers Error:", JSON.stringify(error, null, 2))
    } else {
      const mappedData = data.map((c: any) => ({
        ...c,
        balance: c.calculated_balance !== undefined ? c.calculated_balance : c.balance
      }))
      setCustomers(mappedData as Customer[])
    }
    setIsInitialLoading(false)
  }

  const handleEditClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`)
  }

  const handleAddNewClick = () => {
    router.push("/dashboard/customers/new")
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

  return (
    <div className="space-y-8">
      {!selectedCompanyId && userCompanies.length > 1 && (
        <Card className="text-center py-12">
          <CardContent><p className="text-muted-foreground">Veuillez sélectionner une entreprise pour gérer ses clients.</p></CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Liste des Clients</CardTitle>
              <CardDescription>Gérez vos clients et leurs adresses de livraison.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <CustomerImportDialog companyId={selectedCompanyId} onImportSuccess={() => fetchCustomers(selectedCompanyId!)} />
              <Button onClick={handleAddNewClick}>Ajouter un client</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      Solde
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Solde = Total Facturé (Non annulé) - Total Payé.<br />Un solde positif indique un montant dû par le client.</p>
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
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Aucun client trouvé.
                      <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                        Ajoutez votre premier client.
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
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
                        <span className={customer.balance && customer.balance > 0 ? "text-destructive font-bold" : ""}>
                          {customer.balance != null ? customer.balance.toFixed(3) : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, customer.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
