"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import {
    FileText,
    Truck,
    CreditCard,
    Check,
    ChevronsUpDown,
    Trash2,
    Edit,
    ExternalLink,
    Loader2,
    Printer,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { useCompany } from "@/components/providers/company-provider"
import { Banknote } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type LineItem = {
    id: string
    date: string
    type: 'FACTURE' | 'BL' | 'PAIEMENT'
    reference: string
    amount: number
    paymentIds?: { invoicePaymentIds: string[], blPaymentIds: string[] }
    documentId?: string
}

export function GlobalCollectionsManager() {
    const supabase = createClient()
    const router = useRouter()
    const { selectedCompany } = useCompany()
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [customerName, setCustomerName] = useState("")
    const [customerDetails, setCustomerDetails] = useState<any>(null)
    const [currentBalance, setCurrentBalance] = useState<number | null>(null)
    const [items, setItems] = useState<LineItem[]>([])
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [itemToDelete, setItemToDelete] = useState<LineItem | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [itemToEdit, setItemToEdit] = useState<LineItem | null>(null)
    const [editAmount, setEditAmount] = useState<number>(0)
    const [editMethod, setEditMethod] = useState<string>("")
    const [editDate, setEditDate] = useState<string>("")
    const [isEditing, setIsEditing] = useState(false)

    const companyId = selectedCompany?.id || ""

    // Fetch Customers
    useEffect(() => {
        const fetchCustomers = async () => {
            if (!companyId) return
            const { data } = await supabase
                .from("customers")
                .select("id, name")
                .eq("company_id", companyId)
                .order("name")
            if (data) setCustomers(data)
        }
        fetchCustomers()
    }, [companyId, supabase])

    // Fetch Data when customer changes
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedCustomerId) {
                setItems([])
                setCurrentBalance(null)
                setCustomerDetails(null)
                return
            }
            setIsLoading(true)
            try {
                // 1. Customer Name & Balance
                const { data: cust } = await supabase.from('customers').select('*').eq('id', selectedCustomerId).single()
                if (cust) {
                    setCustomerName(cust.name)
                    setCustomerDetails(cust)
                }

                const { data: balance } = await supabase.rpc('calculate_customer_balance', { p_customer_id: selectedCustomerId })
                setCurrentBalance(balance)

                // 2. Fetch Invoices
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('id, invoice_number, invoice_date, total_ttc')
                    .eq('customer_id', selectedCustomerId)

                // 3. Fetch BLs
                const { data: bls } = await supabase
                    .from('delivery_notes')
                    .select('id, delivery_note_number, delivery_date, created_at, total_ttc')
                    .eq('customer_id', selectedCustomerId)

                // 4. Fetch Payments from invoice_payments
                const { data: invPayments } = await supabase.from('invoice_payments')
                    .select('id, payment_date, amount, payment_method, invoice:invoices!inner(customer_id)')
                    .eq('invoice.customer_id', selectedCustomerId)

                // 5. Fetch Payments from delivery_note_payments  
                const { data: blPayments } = await supabase.from('delivery_note_payments')
                    .select('id, payment_date, amount, payment_method, delivery_note:delivery_notes!inner(customer_id)')
                    .eq('delivery_note.customer_id', selectedCustomerId)

                // Build unified list
                let allItems: LineItem[] = []

                // Invoices
                invoices?.forEach((inv: any) => {
                    allItems.push({
                        id: `inv-${inv.id}`,
                        date: inv.invoice_date,
                        type: 'FACTURE',
                        reference: inv.invoice_number,
                        amount: inv.total_ttc,
                        documentId: inv.id
                    })
                })

                // BLs
                bls?.forEach((bl: any) => {
                    allItems.push({
                        id: `bl-${bl.id}`,
                        date: bl.delivery_date || bl.created_at,
                        type: 'BL',
                        reference: bl.delivery_note_number,
                        amount: bl.total_ttc,
                        documentId: bl.id
                    })
                })

                // Regrouper les paiements par (date + méthode)
                const paymentGroups: { [key: string]: { date: string, method: string, total: number, invoicePaymentIds: string[], blPaymentIds: string[] } } = {}

                invPayments?.forEach((p: any) => {
                    const key = `${p.payment_date}_${p.payment_method}`
                    if (!paymentGroups[key]) {
                        paymentGroups[key] = { date: p.payment_date, method: p.payment_method, total: 0, invoicePaymentIds: [], blPaymentIds: [] }
                    }
                    paymentGroups[key].total += p.amount
                    paymentGroups[key].invoicePaymentIds.push(p.id)
                })

                blPayments?.forEach((p: any) => {
                    const key = `${p.payment_date}_${p.payment_method}`
                    if (!paymentGroups[key]) {
                        paymentGroups[key] = { date: p.payment_date, method: p.payment_method, total: 0, invoicePaymentIds: [], blPaymentIds: [] }
                    }
                    paymentGroups[key].total += p.amount
                    paymentGroups[key].blPaymentIds.push(p.id)
                })

                Object.entries(paymentGroups).forEach(([key, group]) => {
                    allItems.push({
                        id: `pay-${key}`,
                        date: group.date,
                        type: 'PAIEMENT',
                        reference: group.method,
                        amount: group.total,
                        paymentIds: { invoicePaymentIds: group.invoicePaymentIds, blPaymentIds: group.blPaymentIds }
                    })
                })

                // Sort by date descending
                allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                setItems(allItems)

            } catch (error) {
                console.error("Error fetching data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [selectedCustomerId, supabase, refreshTrigger])

    // Handle document click (navigate to invoice or BL in new tab)
    const handleDocumentClick = (item: LineItem) => {
        if (item.type === 'FACTURE' && item.documentId) {
            window.open(`/dashboard/invoices/${item.documentId}`, '_blank')
        } else if (item.type === 'BL' && item.documentId) {
            window.open(`/dashboard/delivery-notes/${item.documentId}`, '_blank')
        }
    }

    // Handle delete payment
    const handleDeletePayment = async () => {
        if (!itemToDelete || !itemToDelete.paymentIds) return
        setIsDeleting(true)
        try {
            const { invoicePaymentIds, blPaymentIds } = itemToDelete.paymentIds

            if (invoicePaymentIds.length > 0) {
                const { error: invError } = await supabase
                    .from('invoice_payments')
                    .delete()
                    .in('id', invoicePaymentIds)
                if (invError) throw invError
            }

            if (blPaymentIds.length > 0) {
                const { error: blError } = await supabase
                    .from('delivery_note_payments')
                    .delete()
                    .in('id', blPaymentIds)
                if (blError) throw blError
            }

            toast.success("Paiement supprimé avec succès")
            setRefreshTrigger(prev => prev + 1)
        } catch (error: any) {
            console.error("Delete error:", error)
            toast.error("Erreur lors de la suppression: " + error.message)
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
            setItemToDelete(null)
        }
    }

    // Handle edit payment
    const handleEditPayment = async () => {
        if (!itemToEdit || !itemToEdit.paymentIds || !selectedCustomerId) return
        setIsEditing(true)
        try {
            const { invoicePaymentIds, blPaymentIds } = itemToEdit.paymentIds

            if (invoicePaymentIds.length > 0) {
                await supabase.from('invoice_payments').delete().in('id', invoicePaymentIds)
            }
            if (blPaymentIds.length > 0) {
                await supabase.from('delivery_note_payments').delete().in('id', blPaymentIds)
            }

            const { error } = await supabase.rpc('record_global_payment', {
                p_customer_id: selectedCustomerId,
                p_amount: editAmount,
                p_payment_method: editMethod,
                p_notes: '',
                p_date: editDate
            })

            if (error) throw error

            toast.success("Paiement modifié avec succès")
            setRefreshTrigger(prev => prev + 1)
        } catch (error: any) {
            console.error("Edit error:", error)
            toast.error("Erreur lors de la modification: " + error.message)
        } finally {
            setIsEditing(false)
            setEditDialogOpen(false)
            setItemToEdit(null)
        }
    }

    const openEditDialog = (item: LineItem) => {
        setItemToEdit(item)
        setEditAmount(item.amount)
        setEditMethod(item.reference)
        setEditDate(item.date.split('T')[0])
        setEditDialogOpen(true)
    }

    const handlePrint = () => {
        window.print()
    }

    // Totals
    const totalFactures = items.filter(i => i.type === 'FACTURE').reduce((acc, i) => acc + i.amount, 0)
    const totalBLs = items.filter(i => i.type === 'BL').reduce((acc, i) => acc + i.amount, 0)
    const totalPaiements = items.filter(i => i.type === 'PAIEMENT').reduce((acc, i) => acc + i.amount, 0)

    if (!companyId) {
        return <div className="p-8 text-center bg-muted/20 rounded-lg">Veuillez sélectionner une entreprise.</div>
    }

    return (
        <>
            {/* ==================== PRINT VIEW ==================== */}
            <div className="hidden print:block font-serif text-black p-6 text-sm max-w-[210mm] mx-auto bg-white">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                    <div className="w-1/2">
                        <h1 className="text-2xl font-bold uppercase tracking-widest mb-2">{selectedCompany?.name || "SOCIÉTÉ"}</h1>
                        <div className="text-sm text-gray-700 space-y-0.5">
                            <p>{selectedCompany?.address}</p>
                            <p>{selectedCompany?.email} {selectedCompany?.phone && `| Tél: ${selectedCompany.phone}`}</p>
                            <p>MF: {selectedCompany?.fiscal_id || "N/A"}</p>
                        </div>
                    </div>
                    <div className="w-1/2 text-right">
                        <div className="inline-block text-left bg-gray-50 border border-gray-300 p-3 rounded min-w-[200px]">
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1 border-b border-gray-200 pb-1">Client</p>
                            <p className="font-bold text-lg">{customerName}</p>
                            {customerDetails && (
                                <div className="text-xs text-gray-600">
                                    <p>{customerDetails.address}</p>
                                    <p>{customerDetails.phone}</p>
                                    <p>MF: {customerDetails.tax_id}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Title & Balance */}
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 uppercase">Relevé de Compte</h2>
                            <p className="text-xs text-gray-500 mt-1">Édité le {format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
                        </div>
                        <div className="border-2 border-black p-3 bg-gray-50 min-w-[180px] text-center">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Solde Net</p>
                            <p className="text-xl font-bold">{(currentBalance || 0).toFixed(3)} <span className="text-sm font-normal">TND</span></p>
                        </div>
                    </div>

                    {/* Summary Strip */}
                    <div className="grid grid-cols-3 gap-0 border border-gray-300 rounded overflow-hidden text-center text-xs bg-white">
                        <div className="p-2 border-r border-gray-300 bg-gray-50">
                            <p className="text-gray-500 uppercase text-[10px] mb-1">Total Facturé</p>
                            <p className="font-bold text-base">{(totalFactures + totalBLs).toFixed(3)}</p>
                        </div>
                        <div className="p-2 border-r border-gray-300">
                            <p className="text-gray-500 uppercase text-[10px] mb-1">Total Payé</p>
                            <p className="font-bold text-base text-emerald-700">{totalPaiements.toFixed(3)}</p>
                        </div>
                        <div className="p-2 bg-gray-100">
                            <p className="text-gray-500 uppercase text-[10px] mb-1">Reste à Payer</p>
                            <p className="font-bold text-base">{(currentBalance || 0).toFixed(3)}</p>
                        </div>
                    </div>
                </div>

                {/* Print Table */}
                <table className="w-full text-xs border-collapse mb-6">
                    <thead>
                        <tr className="border-b-2 border-black text-left">
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 w-20">Date</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 w-24">Type</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600">Référence</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 text-right w-28">Montant</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-500 italic">Aucune transaction</td>
                            </tr>
                        ) : (
                            items.map((item, index) => (
                                <tr key={item.id} className={cn("border-b border-gray-200", index % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                                    <td className="py-2">{format(new Date(item.date), "dd/MM/yy")}</td>
                                    <td className="py-2 font-medium">
                                        {item.type === 'FACTURE' && 'Facture'}
                                        {item.type === 'BL' && 'Bon de Livraison'}
                                        {item.type === 'PAIEMENT' && 'Paiement'}
                                    </td>
                                    <td className="py-2">{item.reference}</td>
                                    <td className={cn("py-2 text-right font-mono font-medium", item.type === 'PAIEMENT' && "text-emerald-700")}>
                                        {item.type === 'PAIEMENT' ? '+' : ''}{item.amount.toFixed(3)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Footer */}
                <div className="text-center text-[10px] text-gray-400 pt-4 border-t border-gray-100">
                    <p>Document généré automatiquement</p>
                </div>
            </div>

            {/* ==================== SCREEN VIEW ==================== */}
            <div className="space-y-6 print:hidden">
                <PageHeader
                    title="Encaissement Global"
                    description="Vue simplifiée: factures, bons de livraison et paiements globaux."
                    icon={Banknote}
                >
                    {selectedCustomerId && (
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimer Relevé
                        </Button>
                    )}
                </PageHeader>

                {/* Customer Selector */}
                <div className="max-w-md">
                    <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCustomerCombobox}
                                className="w-full justify-between h-10"
                            >
                                {selectedCustomerId
                                    ? customers.find((c) => c.id === selectedCustomerId)?.name
                                    : "Sélectionner un client..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0">
                            <Command>
                                <CommandInput placeholder="Rechercher..." />
                                <CommandList>
                                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                                    <CommandGroup>
                                        {customers.map((c) => (
                                            <CommandItem
                                                key={c.id}
                                                value={c.name}
                                                onSelect={() => {
                                                    setSelectedCustomerId(c.id)
                                                    setOpenCustomerCombobox(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {c.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Content */}
                {selectedCustomerId && (
                    <>
                        {/* Summary Row */}
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="bg-muted/30 px-4 py-2 rounded border">
                                <span className="text-muted-foreground">Factures:</span>
                                <span className="font-mono font-bold ml-2">{totalFactures.toFixed(3)} TND</span>
                            </div>
                            <div className="bg-muted/30 px-4 py-2 rounded border">
                                <span className="text-muted-foreground">BL:</span>
                                <span className="font-mono font-bold ml-2">{totalBLs.toFixed(3)} TND</span>
                            </div>
                            <div className="bg-emerald-50 px-4 py-2 rounded border border-emerald-200">
                                <span className="text-emerald-600">Paiements:</span>
                                <span className="font-mono font-bold ml-2 text-emerald-700">{totalPaiements.toFixed(3)} TND</span>
                            </div>
                            <div className={cn(
                                "px-4 py-2 rounded border-2",
                                (currentBalance || 0) > 0 ? "bg-orange-50 border-orange-300" : "bg-emerald-50 border-emerald-300"
                            )}>
                                <span className={(currentBalance || 0) > 0 ? "text-orange-600" : "text-emerald-600"}>Solde:</span>
                                <span className={cn("font-mono font-bold ml-2", (currentBalance || 0) > 0 ? "text-orange-700" : "text-emerald-700")}>
                                    {(currentBalance || 0).toFixed(3)} TND
                                </span>
                            </div>
                        </div>

                        {/* Unified Table */}
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[120px]">Date</TableHead>
                                            <TableHead className="w-[100px]">Type</TableHead>
                                            <TableHead>Référence</TableHead>
                                            <TableHead className="text-right w-[150px]">Montant</TableHead>
                                            <TableHead className="w-[100px] text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    Chargement...
                                                </TableCell>
                                            </TableRow>
                                        ) : items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                    Aucune donnée
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item) => (
                                                <TableRow key={item.id} className="group">
                                                    <TableCell className="font-medium">
                                                        {format(new Date(item.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs gap-1",
                                                                item.type === 'PAIEMENT' && "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                            )}
                                                        >
                                                            {item.type === 'FACTURE' && <FileText className="h-3 w-3" />}
                                                            {item.type === 'BL' && <Truck className="h-3 w-3" />}
                                                            {item.type === 'PAIEMENT' && <CreditCard className="h-3 w-3" />}
                                                            {item.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{item.reference}</TableCell>
                                                    <TableCell className={cn(
                                                        "text-right font-mono font-bold",
                                                        item.type === 'PAIEMENT' ? "text-emerald-600" : ""
                                                    )}>
                                                        {item.type === 'PAIEMENT' ? '+' : ''}{item.amount.toFixed(3)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {item.type === 'PAIEMENT' ? (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7"
                                                                        onClick={() => openEditDialog(item)}
                                                                        title="Modifier"
                                                                    >
                                                                        <Edit className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                                        onClick={() => {
                                                                            setItemToDelete(item)
                                                                            setDeleteDialogOpen(true)
                                                                        }}
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => handleDocumentClick(item)}
                                                                    title="Consulter"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
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

                {!selectedCustomerId && (
                    <Card className="border-dashed">
                        <CardContent className="p-12 text-center text-muted-foreground">
                            <Banknote className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Sélectionnez un client pour voir ses transactions</p>
                        </CardContent>
                    </Card>
                )}

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Vous allez supprimer le paiement de <strong>{itemToDelete?.amount.toFixed(3)} TND</strong> du {itemToDelete && format(new Date(itemToDelete.date), "dd/MM/yyyy")}.
                                Cette action est irréversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeletePayment}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Edit Payment Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Modifier le paiement</DialogTitle>
                            <DialogDescription>
                                Modifiez les informations du paiement. L'allocation sera recalculée automatiquement.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-amount">Montant (TND)</Label>
                                <Input
                                    id="edit-amount"
                                    type="number"
                                    step="0.001"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-date">Date</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Mode de paiement</Label>
                                <Select value={editMethod} onValueChange={setEditMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ESPECES">Espèces</SelectItem>
                                        <SelectItem value="CHEQUE">Chèque</SelectItem>
                                        <SelectItem value="VIREMENT">Virement</SelectItem>
                                        <SelectItem value="TRAITE">Traite</SelectItem>
                                        <SelectItem value="CARTE_BANCAIRE">Carte Bancaire</SelectItem>
                                        <SelectItem value="AUTRE">Autre</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isEditing}>
                                Annuler
                            </Button>
                            <Button onClick={handleEditPayment} disabled={isEditing || editAmount <= 0}>
                                {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    )
}
