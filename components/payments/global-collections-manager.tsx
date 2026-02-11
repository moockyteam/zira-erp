"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import {
    FileText,
    Truck,
    CreditCard,
    Check,
    ChevronsUpDown,
    Printer,
    ArrowUpDown,
    Banknote,
    TrendingUp,
    TrendingDown,
    Edit,
    Trash2,
    AlertCircle,
    Wallet,
    Calendar,
    ArrowRightCircle,
    Copy,
    ListFilter
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { useCompany } from "@/components/providers/company-provider"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
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
import { toast } from "sonner"


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Type pour les paiements globaux
type GlobalPayment = {
    id: string
    amount: number
    payment_date: string
    payment_method: string
    notes: string
    created_at: string
    allocations: {
        invoices: { invoice_number: string, amount: number }[]
        bls: { delivery_note_number: string, amount: number }[]
        credits: number
    }
}
type AccountMovement = {
    id: string
    date: string
    type: 'SOLDE_INITIAL' | 'FACTURE' | 'BL' | 'PAIEMENT' | 'CREDIT'
    reference: string
    debit: number   // Ce qui augmente la dette (factures, BL)
    credit: number  // Ce qui diminue la dette (paiements)
}

export function GlobalCollectionsManager() {
    const supabase = createClient()
    const { selectedCompany } = useCompany()
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [customerName, setCustomerName] = useState("")
    const [customerDetails, setCustomerDetails] = useState<any>(null)
    const [movements, setMovements] = useState<AccountMovement[]>([])
    const [globalPayments, setGlobalPayments] = useState<GlobalPayment[]>([])
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [activeTab, setActiveTab] = useState("movements")

    // Tri: true = chronologique (ancien→récent), false = anti-chronologique
    const [sortAscending, setSortAscending] = useState(true)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingPayment, setEditingPayment] = useState<any>(null)
    const [editAmount, setEditAmount] = useState(0)
    const [isEditing, setIsEditing] = useState(false)

    // Edit Global Payment Dialog
    const [editGlobalDialogOpen, setEditGlobalDialogOpen] = useState(false)
    const [editingGlobalPayment, setEditingGlobalPayment] = useState<GlobalPayment | null>(null)
    const [editGlobalAmount, setEditGlobalAmount] = useState(0)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingPayment, setDeletingPayment] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Delete Global Payment Dialog
    const [deleteGlobalDialogOpen, setDeleteGlobalDialogOpen] = useState(false)
    const [deletingGlobalPayment, setDeletingGlobalPayment] = useState<GlobalPayment | null>(null)

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

    // Fetch Account Movements
    useEffect(() => {
        const fetchMovements = async () => {
            if (!selectedCustomerId) {
                setMovements([])
                setCustomerDetails(null)
                return
            }
            setIsLoading(true)
            try {
                // 1. Customer Info
                const { data: cust } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', selectedCustomerId)
                    .single()

                if (cust) {
                    setCustomerName(cust.name)
                    setCustomerDetails(cust)
                }

                let allMovements: AccountMovement[] = []

                // 2. Solde Initial (si existe)
                if (cust?.initial_balance && cust.initial_balance > 0) {
                    allMovements.push({
                        id: 'initial',
                        date: cust.balance_start_date || '1900-01-01',
                        type: 'SOLDE_INITIAL',
                        reference: 'Solde Initial',
                        debit: cust.initial_balance,
                        credit: 0
                    })
                }

                // 3. Factures (augmentent la dette)
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('id, invoice_number, invoice_date, total_ttc')
                    .eq('customer_id', selectedCustomerId)
                    .select('id, invoice_number, invoice_date, total_ttc')
                    .eq('customer_id', selectedCustomerId)
                    .not('status', 'in', '("BROUILLON","ANNULEE")')

                // Fetch linked payments for invoices (Directly by Customer ID)
                const { data: invoicePayments } = await supabase
                    .from('invoice_payments')
                    .select('*, invoice:invoices!inner(customer_id, invoice_number)')
                    .eq('invoice.customer_id', selectedCustomerId)
                    .order('payment_date', { ascending: true })

                // Loop Invoices
                invoices?.forEach((inv: any) => {
                    allMovements.push({
                        id: `inv-${inv.id}`,
                        date: inv.invoice_date,
                        type: 'FACTURE',
                        reference: inv.invoice_number,
                        debit: inv.total_ttc,
                        credit: 0
                    })
                })

                // 4. BL non facturés (augmentent la dette)
                const { data: bls } = await supabase
                    .from('delivery_notes')
                    .select('id, delivery_note_number, delivery_date, created_at, total_ttc')
                    .eq('customer_id', selectedCustomerId)
                    .eq('status', 'LIVRE')
                    .is('invoice_id', null)

                // Fetch linked payments for BLs (Directly by Customer ID)
                const { data: blPayments } = await supabase
                    .from('delivery_note_payments')
                    .select('*, delivery_note:delivery_notes!inner(customer_id, delivery_note_number)')
                    .eq('delivery_note.customer_id', selectedCustomerId)
                    .order('payment_date', { ascending: true })

                // Loop BLs
                bls?.forEach((bl: any) => {
                    if (bl.total_ttc > 0) {
                        allMovements.push({
                            id: `bl-${bl.id}`,
                            date: bl.delivery_date || bl.created_at?.split('T')[0],
                            type: 'BL',
                            reference: bl.delivery_note_number,
                            debit: bl.total_ttc,
                            credit: 0
                        })
                    }
                })

                // 5. PAIEMENTS (Factures et BLs uniquement - Alignement avec Paiements)

                // 5.1 PAIEMENTS LIES AUX FACTURES
                invoicePayments?.forEach((p: any) => {
                    allMovements.push({
                        id: `pay-inv-${p.id}`,
                        date: p.payment_date,
                        type: 'PAIEMENT',
                        reference: `Paiement ${p.invoice?.invoice_number || ''}`,
                        debit: 0,
                        credit: p.amount
                    })
                })

                // 5.2 PAIEMENTS LIES AUX BLs
                blPayments?.forEach((p: any) => {
                    allMovements.push({
                        id: `pay-bl-${p.id}`,
                        date: p.payment_date,
                        type: 'PAIEMENT',
                        reference: `Paiement ${p.delivery_note?.delivery_note_number || ''}`,
                        debit: 0,
                        credit: p.amount
                    })
                })

                // 6. Crédits/Avances (diminuent la dette)
                const { data: credits } = await supabase
                    .from('customer_credits')
                    .select('id, payment_date, amount, payment_method')
                    .eq('customer_id', selectedCustomerId)

                credits?.forEach((c: any) => {
                    allMovements.push({
                        id: `credit-${c.id}`,
                        date: c.payment_date,
                        type: 'CREDIT',
                        reference: `Avance ${c.payment_method}`,
                        debit: 0,
                        credit: c.amount
                    })
                })

                setMovements(allMovements)

            } catch (error) {
                console.error("Error fetching movements:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchMovements()
    }, [selectedCustomerId, supabase, refreshTrigger])

    // Fetch Global Payments
    useEffect(() => {
        const fetchGlobalPayments = async () => {
            if (!selectedCustomerId) {
                setGlobalPayments([])
                return
            }
            try {
                const { data, error } = await supabase.rpc('get_customer_global_payments', {
                    p_customer_id: selectedCustomerId
                })
                if (error) throw error
                if (data) setGlobalPayments(data)
            } catch (err) {
                console.error("Error fetching global payments:", err)
            }
        }
        fetchGlobalPayments()
    }, [selectedCustomerId, supabase, refreshTrigger])

    // ========== GLOBAL PAYMENT MANAGEMENT HANDLERS ==========

    const openEditGlobalDialog = (payment: GlobalPayment) => {
        setEditingGlobalPayment(payment)
        setEditGlobalAmount(payment.amount)
        setEditGlobalDialogOpen(true)
    }

    const handleEditGlobalPayment = async () => {
        if (!editingGlobalPayment || editGlobalAmount <= 0) return

        setIsEditing(true)
        try {
            const { data, error } = await supabase.rpc('update_global_payment', {
                p_global_payment_id: editingGlobalPayment.id,
                p_new_amount: editGlobalAmount
            })

            if (error) throw error

            toast.success(
                `Paiement global modifié avec succès. Nouvelle allocation effectuée.`
            )
            setEditGlobalDialogOpen(false)
            setRefreshTrigger(r => r + 1)
        } catch (err: any) {
            console.error('Error editing global payment:', err)
            toast.error("Erreur: " + (err.message || 'Impossible de modifier le paiement'))
        } finally {
            setIsEditing(false)
        }
    }

    const openDeleteGlobalDialog = (payment: GlobalPayment) => {
        setDeletingGlobalPayment(payment)
        setDeleteGlobalDialogOpen(true)
    }

    const handleDeleteGlobalPayment = async () => {
        if (!deletingGlobalPayment) return

        setIsDeleting(true)
        try {
            const { data, error } = await supabase.rpc('delete_global_payment', {
                p_global_payment_id: deletingGlobalPayment.id
            })

            if (error) throw error

            toast.success("Paiement global supprimé avec succès.")
            setDeleteGlobalDialogOpen(false)
            setRefreshTrigger(r => r + 1)
        } catch (err: any) {
            console.error('Error deleting global payment:', err)
            toast.error("Erreur: " + (err.message || 'Impossible de supprimer le paiement'))
        } finally {
            setIsDeleting(false)
        }
    }

    // ========== PAYMENT MANAGEMENT HANDLERS ==========

    const openEditDialog = (movement: AccountMovement) => {
        setEditingPayment(movement)
        setEditAmount(movement.credit) // credit est le montant du paiement
        setEditDialogOpen(true)
    }

    const handleEditPayment = async () => {
        if (!editingPayment || editAmount <= 0) return

        setIsEditing(true)
        try {
            // Déterminer le type de paiement depuis l'ID
            let paymentType = ''
            let actualId = ''

            if (editingPayment.id.startsWith('pay-inv-')) {
                paymentType = 'INVOICE'
                actualId = editingPayment.id.replace('pay-inv-', '')
            } else if (editingPayment.id.startsWith('pay-bl-')) {
                paymentType = 'DELIVERY_NOTE'
                actualId = editingPayment.id.replace('pay-bl-', '')
            } else if (editingPayment.id.startsWith('credit-')) {
                paymentType = 'CREDIT'
                actualId = editingPayment.id.replace('credit-', '')
            } else {
                throw new Error('Type de paiement non reconnu')
            }

            const { data, error } = await supabase.rpc('update_global_payment_amount', {
                p_payment_type: paymentType,
                p_payment_id: actualId,
                p_new_amount: editAmount
            })

            if (error) throw error

            toast.success(
                `Paiement modifié: ${editAmount.toFixed(3)} TND (${data.difference > 0 ? '+' : ''}${data.difference.toFixed(3)} TND)`
            )
            setEditDialogOpen(false)
            setRefreshTrigger(r => r + 1) // Refresh data
        } catch (err: any) {
            console.error('Error editing payment:', err)
            toast.error("Erreur: " + (err.message || 'Impossible de modifier le paiement'))
        } finally {
            setIsEditing(false)
        }
    }

    const openDeleteDialog = (movement: AccountMovement) => {
        setDeletingPayment(movement)
        setDeleteDialogOpen(true)
    }

    const handleDeletePayment = async () => {
        if (!deletingPayment) return

        setIsDeleting(true)
        try {
            // Déterminer le type de paiement depuis l'ID
            let paymentType = ''
            let actualId = ''

            if (deletingPayment.id.startsWith('pay-inv-')) {
                paymentType = 'INVOICE'
                actualId = deletingPayment.id.replace('pay-inv-', '')
            } else if (deletingPayment.id.startsWith('pay-bl-')) {
                paymentType = 'DELIVERY_NOTE'
                actualId = deletingPayment.id.replace('pay-bl-', '')
            } else if (deletingPayment.id.startsWith('credit-')) {
                paymentType = 'CREDIT'
                actualId = deletingPayment.id.replace('credit-', '')
            } else {
                throw new Error('Type de paiement non reconnu')
            }

            const { data, error } = await supabase.rpc('delete_global_payment_allocation', {
                p_payment_type: paymentType,
                p_payment_id: actualId
            })

            if (error) throw error

            toast.success(
                `Paiement supprimé: ${deletingPayment.credit.toFixed(3)} TND`
            )
            setDeleteDialogOpen(false)
            setRefreshTrigger(r => r + 1) // Refresh data
        } catch (err: any) {
            console.error('Error deleting payment:', err)
            toast.error("Erreur: " + (err.message || 'Impossible de supprimer le paiement'))
        } finally {
            setIsDeleting(false)
        }
    }

    // Grouper les mouvements par date
    const groupedMovementsByDate = useMemo(() => {
        // Trier chronologiquement d'abord
        const chronological = [...movements].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Grouper par date
        const grouped = new Map<string, {
            date: string
            debitTotal: number
            creditTotal: number
            debitDetails: string[]
            creditDetails: string[]
        }>()

        chronological.forEach(m => {
            const dateKey = m.date
            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, {
                    date: dateKey,
                    debitTotal: 0,
                    creditTotal: 0,
                    debitDetails: [],
                    creditDetails: []
                })
            }

            const group = grouped.get(dateKey)!

            if (m.debit > 0) {
                group.debitTotal += m.debit
                group.debitDetails.push(`${m.reference}: ${m.debit.toFixed(3)} TND`)
            }

            if (m.credit > 0) {
                group.creditTotal += m.credit
                group.creditDetails.push(`${m.reference}: ${m.credit.toFixed(3)} TND`)
            }
        })

        // Calculer le solde courant pour chaque groupe de date
        let runningBalance = 0
        const groupsWithBalance = Array.from(grouped.values()).map(group => {
            runningBalance = runningBalance + group.debitTotal - group.creditTotal
            return { ...group, balance: runningBalance }
        })

        // Appliquer le tri choisi par l'utilisateur
        return sortAscending ? groupsWithBalance : [...groupsWithBalance].reverse()
    }, [movements, sortAscending])

    // Totaux
    const totalDebit = movements.reduce((acc, m) => acc + m.debit, 0)
    const totalCredit = movements.reduce((acc, m) => acc + m.credit, 0)
    const currentBalance = totalDebit - totalCredit

    const handlePrint = () => {
        window.print()
    }



    if (!companyId) {
        return <div className="p-8 text-center bg-muted/20 rounded-lg">Veuillez sélectionner une entreprise.</div>
    }

    return (
        <>
            {/* ==================== PRINT VIEW ==================== */}
            <div className="hidden print:block font-serif text-black p-6 text-sm max-w-[210mm] mx-auto bg-white">
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold uppercase">{selectedCompany?.name || "SOCIÉTÉ"}</h1>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{customerName}</p>
                    </div>
                </div>
                <h2 className="text-xl font-bold mb-4">Relevé de Compte</h2>
                <p className="text-xs mb-4">Édité le {format(new Date(), "dd/MM/yyyy à HH:mm")}</p>

                <table className="w-full text-xs border-collapse mb-4">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-2">Date</th>
                            <th className="text-left py-2">Libellé</th>
                            <th className="text-right py-2">Facturé</th>
                            <th className="text-right py-2">Payé</th>
                            <th className="text-right py-2">Reste à Payer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedMovementsByDate.map((group: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-1">{format(new Date(group.date), "dd/MM/yy")}</td>
                                <td className="py-1">
                                    {group.debitDetails.length > 0 && <div className="text-xs">{group.debitDetails.join(', ')}</div>}
                                    {group.creditDetails.length > 0 && <div className="text-xs">{group.creditDetails.join(', ')}</div>}
                                </td>
                                <td className="py-1 text-right">{group.debitTotal > 0 ? group.debitTotal.toFixed(3) : '-'}</td>
                                <td className="py-1 text-right">{group.creditTotal > 0 ? group.creditTotal.toFixed(3) : '-'}</td>
                                <td className="py-1 text-right font-bold">{group.balance.toFixed(3)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black font-bold">
                            <td colSpan={2} className="py-2">TOTAUX</td>
                            <td className="py-2 text-right">{totalDebit.toFixed(3)}</td>
                            <td className="py-2 text-right">{totalCredit.toFixed(3)}</td>
                            <td className="py-2 text-right">{currentBalance.toFixed(3)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ==================== SCREEN VIEW ==================== */}
            <div className="space-y-6 print:hidden">
                <PageHeader
                    title="Relevé de Compte Client"
                    description="Vue simplifiée des mouvements groupés par date pour une revue rapide des débits et crédits."
                    icon={Banknote}
                >
                    {selectedCustomerId && (
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimer
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
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                                <div className="flex items-center gap-2 text-red-600 text-sm">
                                    <TrendingUp className="h-4 w-4" />
                                    Total Facturé
                                </div>
                                <p className="font-mono font-bold text-lg text-red-700">{totalDebit.toFixed(3)} TND</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg">
                                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                                    <TrendingDown className="h-4 w-4" />
                                    Total Payé
                                </div>
                                <p className="font-mono font-bold text-lg text-emerald-700">{totalCredit.toFixed(3)} TND</p>
                            </div>
                            <div className={cn(
                                "px-4 py-3 rounded-lg border-2 col-span-2",
                                currentBalance > 0 ? "bg-orange-50 border-orange-300" : "bg-emerald-50 border-emerald-300"
                            )}>
                                <div className={cn("text-sm", currentBalance > 0 ? "text-orange-600" : "text-emerald-600")}>
                                    Reste à Payer
                                </div>
                                <p className={cn("font-mono font-bold text-2xl", currentBalance > 0 ? "text-orange-700" : "text-emerald-700")}>
                                    {currentBalance.toFixed(3)} TND
                                </p>
                            </div>
                        </div>

                        {/* Sort Toggle (Specific to Movements Tab) */}
                        {activeTab === 'movements' && (
                            <div className="flex justify-end mb-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSortAscending(!sortAscending)}
                                >
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                    {sortAscending ? "Plus ancien → Plus récent" : "Plus récent → Plus ancien"}
                                </Button>
                            </div>
                        )}

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="movements">Vue d'ensemble & Mouvements</TabsTrigger>
                                <TabsTrigger value="global_payments">Historique des Paiements Globaux</TabsTrigger>
                            </TabsList>

                            <TabsContent value="movements">
                                {/* Movements Table */}
                                <Card>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-[120px]">Date</TableHead>
                                                    <TableHead className="w-[140px]">Mouvements</TableHead>
                                                    <TableHead className="text-right w-[130px]">Montant Facturé</TableHead>
                                                    <TableHead className="text-right w-[130px]">Montant Payé</TableHead>
                                                    <TableHead className="text-right w-[130px]">Reste à Payer</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                            Chargement...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : groupedMovementsByDate.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                            Aucun mouvement
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    groupedMovementsByDate.map((group: any, idx: number) => (
                                                        <TableRow key={idx} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium">
                                                                {format(new Date(group.date), "dd/MM/yyyy")}
                                                            </TableCell>
                                                            <TableCell>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex gap-2 text-xs cursor-help">
                                                                                {group.debitDetails.length > 0 && (
                                                                                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                                                                        {group.debitDetails.length} Facture{group.debitDetails.length > 1 ? 's' : ''}
                                                                                    </Badge>
                                                                                )}
                                                                                {group.creditDetails.length > 0 && (
                                                                                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                                                                        {group.creditDetails.length} Paiement{group.creditDetails.length > 1 ? 's' : ''}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="max-w-md">
                                                                            <div className="space-y-2">
                                                                                {group.debitDetails.length > 0 && (
                                                                                    <div>
                                                                                        <p className="font-semibold text-red-600 mb-1">Facturé:</p>
                                                                                        <ul className="text-xs space-y-0.5">
                                                                                            {group.debitDetails.map((d: string, i: number) => (
                                                                                                <li key={i}>• {d}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}
                                                                                {group.creditDetails.length > 0 && (
                                                                                    <div>
                                                                                        <p className="font-semibold text-emerald-600 mb-1">Payé:</p>
                                                                                        <ul className="text-xs space-y-0.5">
                                                                                            {group.creditDetails.map((c: string, i: number) => (
                                                                                                <li key={i}>• {c}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-semibold text-red-600">
                                                                {group.debitTotal > 0 ? group.debitTotal.toFixed(3) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-semibold text-emerald-600">
                                                                {group.creditTotal > 0 ? group.creditTotal.toFixed(3) : '-'}
                                                            </TableCell>
                                                            <TableCell className={cn(
                                                                "text-right font-mono font-bold text-lg",
                                                                group.balance > 0 ? "text-orange-600" : "text-emerald-600"
                                                            )}>
                                                                {group.balance.toFixed(3)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* ==================== DETAILED MOVEMENTS WITH ACTIONS ==================== */}
                                <Card className="mt-6">
                                    <CardContent className="p-0">
                                        <div className="p-4 bg-muted/30 border-b">
                                            <h4 className="font-semibold"><CreditCard className="inline h-4 w-4 mr-2" />Détail des Paiements</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Gérer les paiements individuellement</p>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Référence</TableHead>
                                                    <TableHead className="text-right">Montant</TableHead>
                                                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {movements
                                                    .filter(m => m.type === 'PAIEMENT' || m.type === 'CREDIT')
                                                    .map((movement) => (
                                                        <TableRow key={movement.id}>
                                                            <TableCell className="text-sm">
                                                                {format(new Date(movement.date), "dd/MM/yyyy")}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {movement.type === 'PAIEMENT' ? (
                                                                        <><CreditCard className="h-3 w-3 mr-1 inline" />Paiement</>
                                                                    ) : (
                                                                        <><Banknote className="h-3 w-3 mr-1 inline" />Avance</>
                                                                    )}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-sm">
                                                                {movement.reference}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-semibold text-emerald-600">
                                                                {movement.credit.toFixed(3)} TND
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex gap-1 justify-end">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={() => openEditDialog(movement)}
                                                                                >
                                                                                    <Edit className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Modifier le montant</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                                                                                    onClick={() => openDeleteDialog(movement)}
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Supprimer le paiement</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                {movements.filter(m => m.type === 'PAIEMENT' || m.type === 'CREDIT').length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                            Aucun paiement à afficher
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="global_payments">
                                <Card>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-[120px]">Date</TableHead>
                                                    <TableHead>Mode</TableHead>
                                                    <TableHead>Ref / Notes</TableHead>
                                                    <TableHead className="text-right">Montant Total</TableHead>
                                                    <TableHead>Détails d'Allocation</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {globalPayments.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                            Aucun paiement global enregistré pour ce client.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    globalPayments.map((payment) => (
                                                        <TableRow key={payment.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium align-top">
                                                                {format(new Date(payment.payment_date), "dd/MM/yyyy")}
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {payment.payment_method}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="align-top text-sm text-muted-foreground max-w-[200px] truncate">
                                                                {payment.notes || "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-emerald-600 align-top">
                                                                {payment.amount.toFixed(3)} TND
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="space-y-1 text-xs">
                                                                    {payment.allocations?.invoices?.length > 0 && (
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="font-semibold text-muted-foreground">Factures:</span>
                                                                            {payment.allocations.invoices.map((inv, i) => (
                                                                                <div key={i} className="flex justify-between w-full max-w-[250px] bg-slate-50 px-2 py-1 rounded border">
                                                                                    <span>{inv.invoice_number}</span>
                                                                                    <span className="font-mono">{inv.amount.toFixed(3)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {payment.allocations?.bls?.length > 0 && (
                                                                        <div className="flex flex-col gap-1 mt-2">
                                                                            <span className="font-semibold text-muted-foreground">BLs:</span>
                                                                            {payment.allocations.bls.map((bl, i) => (
                                                                                <div key={i} className="flex justify-between w-full max-w-[250px] bg-sky-50 px-2 py-1 rounded border border-sky-100">
                                                                                    <span>{bl.delivery_note_number}</span>
                                                                                    <span className="font-mono">{bl.amount.toFixed(3)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {(payment.allocations?.credits || 0) > 0.001 && (
                                                                        <div className="mt-2 flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit">
                                                                            <Wallet className="h-3 w-3" />
                                                                            <span>Solde Créditeur: <span className="font-mono font-bold">{(payment.allocations?.credits || 0).toFixed(3)}</span></span>
                                                                        </div>
                                                                    )}
                                                                    {(!payment.allocations || (
                                                                        (payment.allocations.invoices?.length || 0) === 0 &&
                                                                        (payment.allocations.bls?.length || 0) === 0 &&
                                                                        (payment.allocations.credits || 0) <= 0.001
                                                                    )) && (
                                                                            <span className="text-muted-foreground italic">Non alloué</span>
                                                                        )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right align-top">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => openEditGlobalDialog(payment)}
                                                                    >
                                                                        <Edit className="h-3 w-3 mr-1" />
                                                                        Modifier
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => openDeleteGlobalDialog(payment)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
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
                            </TabsContent>
                        </Tabs>
                    </>
                )}

                {!selectedCustomerId && (
                    <Card className="border-dashed">
                        <CardContent className="p-12 text-center text-muted-foreground">
                            <Banknote className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Sélectionnez un client pour voir son relevé de compte</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ==================== EDIT DIALOG ==================== */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifier le Paiement</DialogTitle>
                        <DialogDescription>
                            Modifiez le montant. L'allocation sera automatiquement recalculée.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Montant actuel</Label>
                            <p className="text-sm text-muted-foreground">
                                {editingPayment?.credit?.toFixed(3)} TND ({editingPayment?.reference})
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editAmount">Nouveau montant (TND)</Label>
                            <Input
                                id="editAmount"
                                type="number"
                                step="0.001"
                                value={editAmount}
                                onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                                placeholder="Nouveau montant..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleEditPayment} disabled={isEditing || editAmount <= 0}>
                            {isEditing ? "Modification..." : "Modifier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== DELETE DIALOG ==================== */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Supprimer le Paiement</DialogTitle>
                        <DialogDescription>
                            Cette action est irréversible. Le solde du client sera restauré.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm">
                            Êtes-vous sûr de vouloir supprimer le paiement de{" "}
                            <strong>{deletingPayment?.credit?.toFixed(3)} TND</strong> ?
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button variant="destructive" onClick={handleDeletePayment} disabled={isDeleting}>
                            {isDeleting ? "Suppression..." : "Supprimer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ==================== GLOBAL PAYMENT EDIT DIALOG ==================== */}
            <Dialog open={editGlobalDialogOpen} onOpenChange={setEditGlobalDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifier le Paiement Global</DialogTitle>
                        <DialogDescription>
                            Modifiez le montant total. Le système recalculera automatiquement la répartition sur les factures et BL (FIFO).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Montant actuel</Label>
                            <p className="text-sm text-muted-foreground">
                                {editingGlobalPayment?.amount?.toFixed(3)} TND ({editingGlobalPayment?.payment_method})
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editGlobalAmount">Nouveau montant total (TND)</Label>
                            <Input
                                id="editGlobalAmount"
                                type="number"
                                step="0.001"
                                value={editGlobalAmount}
                                onChange={(e) => setEditGlobalAmount(parseFloat(e.target.value) || 0)}
                                className="font-bold text-lg"
                            />
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-md text-xs flex gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>
                                Attention : Modifier ce montant va <strong>annuler toutes les allocations actuelles</strong> de ce paiement et les recréer sur les documents les plus anciens impayés.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditGlobalDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleEditGlobalPayment} disabled={isEditing || editGlobalAmount <= 0}>
                            {isEditing ? "Enregistrement..." : "Enregistrer les modifications"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== GLOBAL PAYMENT DELETE DIALOG ==================== */}
            <Dialog open={deleteGlobalDialogOpen} onOpenChange={setDeleteGlobalDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Supprimer le paiement global ?</DialogTitle>
                        <DialogDescription>
                            Cette action supprimera le paiement ainsi que <strong>toutes ses allocations</strong> sur les factures et BL.
                        </DialogDescription>
                    </DialogHeader>
                    {deletingGlobalPayment && (
                        <div className="py-4 text-sm text-center bg-red-50 rounded-lg border border-red-100">
                            <p className="font-bold text-red-600 mb-1 text-lg">{deletingGlobalPayment.amount.toFixed(3)} TND</p>
                            <p className="text-muted-foreground">du {format(new Date(deletingGlobalPayment.payment_date), "dd/MM/yyyy")}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {deletingGlobalPayment.allocations.invoices.length} facture(s), {deletingGlobalPayment.allocations.bls.length} BL(s) impactés.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteGlobalDialogOpen(false)}>Annuler</Button>
                        <Button variant="destructive" onClick={handleDeleteGlobalPayment} disabled={isDeleting}>
                            {isDeleting ? "Suppression..." : "Confirmer la suppression"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
