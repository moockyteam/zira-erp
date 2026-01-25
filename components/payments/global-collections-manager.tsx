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

// Type pour les mouvements du relevé de compte
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
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    // Tri: true = chronologique (ancien→récent), false = anti-chronologique
    const [sortAscending, setSortAscending] = useState(true)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingPayment, setEditingPayment] = useState<any>(null)
    const [editAmount, setEditAmount] = useState(0)
    const [isEditing, setIsEditing] = useState(false)

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingPayment, setDeletingPayment] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState(false)

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

    // Calculer les mouvements triés avec solde courant
    const sortedMovementsWithBalance = useMemo(() => {
        // Toujours trier chronologiquement pour calculer le solde courant
        const chronological = [...movements].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Calculer le solde courant cumulatif
        let runningBalance = 0
        const withBalance = chronological.map(m => {
            runningBalance = runningBalance + m.debit - m.credit
            return { ...m, balance: runningBalance }
        })

        // Appliquer le tri choisi par l'utilisateur
        return sortAscending ? withBalance : [...withBalance].reverse()
    }, [movements, sortAscending])

    // Totaux
    const totalDebit = movements.reduce((acc, m) => acc + m.debit, 0)
    const totalCredit = movements.reduce((acc, m) => acc + m.credit, 0)
    const currentBalance = totalDebit - totalCredit

    const handlePrint = () => {
        window.print()
    }

    // Handle Edit Payment
    const handleEditPayment = async () => {
        if (!editingPayment || editAmount <= 0) return
        setIsEditing(true)
        try {
            const { data, error } = await supabase.rpc('update_global_payment', {
                p_entry_id: editingPayment.id,
                p_new_amount: editAmount
            })
            if (error) throw error
            toast.success(`Paiement modifié : ${editAmount.toFixed(3)} TND`)
            setEditDialogOpen(false)
            setRefreshTrigger(r => r + 1)
        } catch (err: any) {
            toast.error("Erreur: " + err.message)
        } finally {
            setIsEditing(false)
        }
    }

    // Handle Delete Payment
    const handleDeletePayment = async () => {
        if (!deletingPayment) return
        setIsDeleting(true)
        try {
            const { error } = await supabase.rpc('delete_global_payment', {
                p_entry_id: deletingPayment.id
            })
            if (error) throw error
            toast.success(`Paiement supprimé`)
            setDeleteDialogOpen(false)
            setRefreshTrigger(r => r + 1)
        } catch (err: any) {
            toast.error("Erreur: " + err.message)
        } finally {
            setIsDeleting(false)
        }
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
                            <th className="text-right py-2">Débit</th>
                            <th className="text-right py-2">Crédit</th>
                            <th className="text-right py-2">Solde</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedMovementsWithBalance.map((m: any) => (
                            <tr key={m.id} className="border-b border-gray-200">
                                <td className="py-1">{format(new Date(m.date), "dd/MM/yy")}</td>
                                <td className="py-1">{m.reference}</td>
                                <td className="py-1 text-right">{m.debit > 0 ? m.debit.toFixed(3) : '-'}</td>
                                <td className="py-1 text-right">{m.credit > 0 ? m.credit.toFixed(3) : '-'}</td>
                                <td className="py-1 text-right font-bold">{m.balance.toFixed(3)}</td>
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
                    description="Vue consolidée des mouvements : factures, BL, paiements et solde courant."
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
                                    Total Débit
                                </div>
                                <p className="font-mono font-bold text-lg text-red-700">{totalDebit.toFixed(3)} TND</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg">
                                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                                    <TrendingDown className="h-4 w-4" />
                                    Total Crédit
                                </div>
                                <p className="font-mono font-bold text-lg text-emerald-700">{totalCredit.toFixed(3)} TND</p>
                            </div>
                            <div className={cn(
                                "px-4 py-3 rounded-lg border-2 col-span-2",
                                currentBalance > 0 ? "bg-orange-50 border-orange-300" : "bg-emerald-50 border-emerald-300"
                            )}>
                                <div className={cn("text-sm", currentBalance > 0 ? "text-orange-600" : "text-emerald-600")}>
                                    Solde Actuel
                                </div>
                                <p className={cn("font-mono font-bold text-2xl", currentBalance > 0 ? "text-orange-700" : "text-emerald-700")}>
                                    {currentBalance.toFixed(3)} TND
                                </p>
                            </div>
                        </div>

                        {/* Sort Toggle */}
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSortAscending(!sortAscending)}
                            >
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                {sortAscending ? "Plus ancien → Plus récent" : "Plus récent → Plus ancien"}
                            </Button>
                        </div>

                        {/* Movements Table */}
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[100px]">Date</TableHead>
                                            <TableHead className="w-[100px]">Type</TableHead>
                                            <TableHead>Libellé</TableHead>
                                            <TableHead className="text-right w-[120px]">Débit</TableHead>
                                            <TableHead className="text-right w-[120px]">Crédit</TableHead>
                                            <TableHead className="text-right w-[130px]">Solde</TableHead>
                                            <TableHead className="w-[80px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    Chargement...
                                                </TableCell>
                                            </TableRow>
                                        ) : sortedMovementsWithBalance.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                                                    Aucun mouvement
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedMovementsWithBalance.map((m: any) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(m.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs gap-1",
                                                                m.type === 'PAIEMENT' && "border-emerald-300 bg-emerald-50 text-emerald-700",
                                                                m.type === 'CREDIT' && "border-blue-300 bg-blue-50 text-blue-700",
                                                                m.type === 'FACTURE' && "border-indigo-300 bg-indigo-50 text-indigo-700",
                                                                m.type === 'BL' && "border-slate-300 bg-slate-50 text-slate-700",
                                                                m.type === 'SOLDE_INITIAL' && "border-gray-300 bg-gray-100 text-gray-700"
                                                            )}
                                                        >
                                                            {m.type === 'FACTURE' && <FileText className="h-3 w-3" />}
                                                            {m.type === 'BL' && <Truck className="h-3 w-3" />}
                                                            {m.type === 'PAIEMENT' && <CreditCard className="h-3 w-3" />}
                                                            {m.type === 'CREDIT' && <CreditCard className="h-3 w-3" />}
                                                            {m.type === 'SOLDE_INITIAL' ? 'INITIAL' : m.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{m.reference}</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">
                                                        {m.debit > 0 ? m.debit.toFixed(3) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-600">
                                                        {m.credit > 0 ? m.credit.toFixed(3) : '-'}
                                                    </TableCell>
                                                    <TableCell className={cn(
                                                        "text-right font-mono font-bold",
                                                        m.balance > 0 ? "text-orange-600" : "text-emerald-600"
                                                    )}>
                                                        {m.balance.toFixed(3)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.type === 'PAIEMENT' && (
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => {
                                                                        const paymentId = m.id.replace('gpay-', '')
                                                                        setEditingPayment({ id: paymentId, amount: m.credit, reference: m.reference })
                                                                        setEditAmount(m.credit)
                                                                        setEditDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                                    onClick={() => {
                                                                        const paymentId = m.id.replace('gpay-', '')
                                                                        setDeletingPayment({ id: paymentId, amount: m.credit, reference: m.reference })
                                                                        setDeleteDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
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
                                {editingPayment?.amount?.toFixed(3)} TND ({editingPayment?.reference})
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
                            <strong>{deletingPayment?.amount?.toFixed(3)} TND</strong> ?
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
        </>
    )
}
