"use client"

import { useEffect, useState, Fragment } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    FileText,
    Truck,
    CreditCard,
    Download,
    Printer,
    ChevronDown,
    ChevronUp,
    Search,
    ArrowUpRight,
    ArrowDownLeft
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type HistoryItem = {
    id: string
    date: string
    type: 'INVOICE' | 'DELIVERY_NOTE' | 'PAYMENT' | 'CREDIT'
    reference: string
    amount: number
    status?: string
    details?: any[] // Lines
    linkedPayments?: any[] // Associated payments
}

export function CustomerHistory({ customerId }: { customerId: string }) {
    const supabase = createClient()
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>("ALL")
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    const [initialBalance, setInitialBalance] = useState(0)

    useEffect(() => {
        if (customerId) {
            fetchHistory()
        }
    }, [customerId])

    const fetchHistory = async () => {
        setIsLoading(true)
        try {
            // 0. Fetch Customer Details (Initial Balance)
            const { data: customer } = await supabase
                .from('customers')
                .select('initial_balance')
                .eq('id', customerId)
                .single()

            setInitialBalance(customer?.initial_balance || 0)

            // 1. Fetch Invoices
            const { data: invoices } = await supabase
                .from('invoices')
                .select('*')
                .eq('customer_id', customerId)
                .not('status', 'in', '("BROUILLON","ANNULEE")') // Filter out Drafts/Cancelled to avoid noise

            // 1.1 Fetch Invoice Lines
            let invoiceLines: any[] = []
            if (invoices && invoices.length > 0) {
                const invIds = invoices.map(i => i.id)
                const { data: lines } = await supabase
                    .from('invoice_lines')
                    .select('*')
                    .in('invoice_id', invIds)
                if (lines) invoiceLines = lines
            }

            // 2. Fetch Delivery Notes (LIVRE only or all? Let's take filtered)
            // Usually history shows everything, but for balance check we focus on 'LIVRE' for Unbilled.
            // But History should show ALL valid docs.
            const { data: bls } = await supabase
                .from('delivery_notes')
                .select('*')
                .eq('customer_id', customerId)
                .neq('status', 'BROUILLON')

            // 2.1 Fetch BL Lines
            let blLines: any[] = []
            if (bls && bls.length > 0) {
                const blIds = bls.map(b => b.id)
                const { data: lines } = await supabase
                    .from('delivery_note_lines')
                    .select('*')
                    .in('delivery_note_id', blIds)
                if (lines) blLines = lines
            }

            // 3. Fetch Payments (INVOICES)
            let payments: any[] = []
            if (invoices && invoices.length > 0) {
                const invIds = invoices.map(i => i.id)
                const { data: payData } = await supabase
                    .from('invoice_payments')
                    .select('*, invoice:invoices(invoice_number)')
                    .in('invoice_id', invIds)
                if (payData) payments = payData
            }

            // 3.1 Fetch Payments (DELIVERY NOTES)
            let blPayments: any[] = []
            if (bls && bls.length > 0) {
                const blIds = bls.map(b => b.id)
                const { data: blPayData } = await supabase
                    .from('delivery_note_payments')
                    .select('*, delivery_note:delivery_notes(delivery_note_number)')
                    .in('delivery_note_id', blIds)
                if (blPayData) blPayments = blPayData
            }

            // 3.2 Fetch Customer Credits
            const { data: credits } = await supabase
                .from('customer_credits')
                .select('*')
                .eq('customer_id', customerId)

            // 4. Combine
            const historyItems: HistoryItem[] = []

            invoices?.forEach((inv: any) => {
                const myLines = invoiceLines.filter(l => l.invoice_id === inv.id)
                const myPayments = payments.filter(p => p.invoice_id === inv.id)

                historyItems.push({
                    id: inv.id,
                    date: inv.invoice_date || inv.created_at, // Fallback
                    type: 'INVOICE',
                    reference: inv.invoice_number || 'N/A',
                    amount: Number(inv.total_ttc) || 0,
                    status: inv.status,
                    details: myLines,
                    linkedPayments: myPayments
                })

                // Separate Payment Items
                myPayments.forEach((pay: any) => {
                    historyItems.push({
                        id: `PAY-INV-${pay.id}`,
                        date: pay.payment_date || pay.created_at,
                        type: 'PAYMENT',
                        reference: `Paie ${inv.invoice_number}`,
                        amount: Number(pay.amount) || 0,
                        status: pay.payment_method,
                        details: [{ description: `Règlement Facture ${inv.invoice_number}`, quantity: 1, unit_price_ht: pay.amount }],
                        linkedPayments: []
                    })
                })
            })

            bls?.forEach((bl: any) => {
                const myLines = blLines.filter(l => l.delivery_note_id === bl.id)
                const myPayments = blPayments.filter(p => p.delivery_note_id === bl.id)

                historyItems.push({
                    id: bl.id,
                    date: bl.delivery_date || bl.created_at,
                    type: 'DELIVERY_NOTE',
                    reference: bl.delivery_note_number || 'N/A',
                    amount: Number(bl.total_ttc) || 0,
                    status: bl.status,
                    details: myLines,
                    linkedPayments: myPayments
                })

                myPayments.forEach((pay: any) => {
                    historyItems.push({
                        id: `PAY-BL-${pay.id}`,
                        date: pay.payment_date || pay.created_at,
                        type: 'PAYMENT',
                        reference: `Paie ${bl.delivery_note_number}`,
                        amount: Number(pay.amount) || 0,
                        status: pay.payment_method,
                        details: [{ description: `Règlement BL ${bl.delivery_note_number}`, quantity: 1, unit_price_ht: pay.amount }],
                        linkedPayments: []
                    })
                })
            })

            credits?.forEach((credit: any) => {
                historyItems.push({
                    id: `CREDIT-${credit.id}`,
                    date: credit.payment_date || credit.created_at,
                    type: 'CREDIT',
                    reference: `Avance ${credit.payment_method || ''}`,
                    amount: Number(credit.amount) || 0,
                    status: 'ENCAISSE',
                    details: [{ description: credit.notes || "Avance / Crédit Client", quantity: 1, unit_price_ht: credit.amount }],
                    linkedPayments: []
                })
            })

            // SAFE SORT
            historyItems.sort((a, b) => {
                const dateA = new Date(a.date).getTime()
                const dateB = new Date(b.date).getTime()
                return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA) // Handle invalid dates safely
            })

            setHistory(historyItems)

        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedRows(newSet)
    }

    const filteredHistory = history.filter(item => {
        if (filterType === "ALL") return true
        return item.type === filterType
    })

    // Totals Calculation
    const totalInvoiced = history.filter(h => h.type === 'INVOICE').reduce((sum, h) => sum + (h.amount || 0), 0)
    const totalBlValued = history.filter(h => h.type === 'DELIVERY_NOTE' && h.status === 'LIVRE').reduce((sum, h) => sum + (h.amount || 0), 0)
    const totalPaid = history.filter(h => h.type === 'PAYMENT').reduce((sum, h) => sum + (h.amount || 0), 0)
    const totalCredits = history.filter(h => h.type === 'CREDIT').reduce((sum, h) => sum + (h.amount || 0), 0)

    const totalDue = (initialBalance + totalInvoiced + totalBlValued) - (totalPaid + totalCredits)

    const handlePrint = () => {
        const printContent = document.getElementById("history-print-area")
        if (printContent) {
            const originalContents = document.body.innerHTML
            document.body.innerHTML = printContent.innerHTML
            window.print()
            document.body.innerHTML = originalContents
            window.location.reload()
        }
    }

    // Helper for safe Date formatting
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-"
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return "-"
        return format(d, "dd/MM/yyyy")
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Solde Initial</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{initialBalance.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Facturé (+ BL)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(totalInvoiced + totalBlValued).toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Payé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{(totalPaid + totalCredits).toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Reste à Payer (Estimé)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{totalDue.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrer par type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tout l'historique</SelectItem>
                            <SelectItem value="INVOICE">Factures</SelectItem>
                            <SelectItem value="DELIVERY_NOTE">Bons de Livraison</SelectItem>
                            <SelectItem value="PAYMENT">Paiements</SelectItem>
                            <SelectItem value="CREDIT">Avances / Crédits</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimer / PDF
                </Button>
            </div>

            <Card id="history-print-area">
                <CardHeader>
                    <CardTitle>Historique des Opérations</CardTitle>
                    <CardDescription>Relevé détaillé des factures, BL et paiements.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Référence</TableHead>
                                <TableHead className="text-right">Montant (TND)</TableHead>
                                <TableHead className="text-center">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        {isLoading ? "Chargement..." : "Aucune opération trouvée."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredHistory.map(item => (
                                    <Fragment key={item.id}>
                                        <TableRow
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => toggleRow(item.id)}
                                        >
                                            <TableCell>
                                                {expandedRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </TableCell>
                                            <TableCell>{formatDate(item.date)}</TableCell>
                                            <TableCell>
                                                {item.type === 'INVOICE' && <Badge variant="outline" className="border-indigo-500 text-indigo-500"><FileText className="mr-1 h-3 w-3" /> Facture</Badge>}
                                                {item.type === 'DELIVERY_NOTE' && <Badge variant="outline" className="border-blue-500 text-blue-500"><Truck className="mr-1 h-3 w-3" /> BL</Badge>}
                                                {item.type === 'PAYMENT' && <Badge variant="outline" className="border-emerald-500 text-emerald-500"><CreditCard className="mr-1 h-3 w-3" /> Paiement</Badge>}
                                                {item.type === 'CREDIT' && <Badge variant="outline" className="border-teal-500 text-teal-500 bg-teal-50"><CreditCard className="mr-1 h-3 w-3" /> Avance</Badge>}
                                            </TableCell>
                                            <TableCell className="font-medium">{item.reference}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                <span className="flex items-center justify-end gap-1">
                                                    <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                                    {item.amount?.toFixed(3)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{item.status || '-'}</Badge>
                                            </TableCell>
                                        </TableRow>
                                        {expandedRows.has(item.id) && (
                                            <TableRow className="bg-muted/30">
                                                <TableCell colSpan={6} className="p-4">
                                                    <div className="pl-8 text-sm space-y-6">
                                                        {/* Articles Section */}
                                                        {item.details && item.details.length > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                                    Détails des Articles
                                                                </h4>
                                                                <div className="border rounded-md overflow-hidden bg-background">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="h-8 bg-muted/50">
                                                                                <TableHead className="py-1">Article / Description</TableHead>
                                                                                <TableHead className="py-1 text-right">Qté</TableHead>
                                                                                <TableHead className="py-1 text-right">Prix U.</TableHead>
                                                                                <TableHead className="py-1 text-right">Total HT</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {item.details.map((line: any, idx: number) => (
                                                                                <TableRow key={idx} className="h-8 border-none hover:bg-transparent">
                                                                                    <TableCell className="py-1">{line.description}</TableCell>
                                                                                    <TableCell className="py-1 text-right">{line.quantity}</TableCell>
                                                                                    <TableCell className="py-1 text-right">{line.unit_price_ht?.toFixed(3)}</TableCell>
                                                                                    <TableCell className="py-1 text-right">{(line.quantity * line.unit_price_ht).toFixed(3)}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Payments Section */}
                                                        {item.type !== 'PAYMENT' && item.type !== 'CREDIT' && (
                                                            <div>
                                                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                                    <CreditCard className="h-4 w-4 text-emerald-600" />
                                                                    Historique des Paiements
                                                                </h4>
                                                                {item.linkedPayments && item.linkedPayments.length > 0 ? (
                                                                    <div className="border rounded-md overflow-hidden bg-emerald-50/30 border-emerald-100">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow className="h-8 bg-emerald-100/50">
                                                                                    <TableHead className="py-1 text-xs">Date</TableHead>
                                                                                    <TableHead className="py-1 text-xs">Méthode</TableHead>
                                                                                    <TableHead className="py-1 text-xs">Notes/Ref</TableHead>
                                                                                    <TableHead className="py-1 text-right text-xs">Montant</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {item.linkedPayments.map((pay: any) => (
                                                                                    <TableRow key={pay.id} className="h-8 hover:bg-transparent">
                                                                                        <TableCell className="py-1 text-xs">{formatDate(pay.payment_date)}</TableCell>
                                                                                        <TableCell className="py-1 text-xs">{pay.payment_method}</TableCell>
                                                                                        <TableCell className="py-1 text-xs max-w-[200px] truncate" title={pay.notes}>
                                                                                            {pay.notes || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell className="py-1 text-right text-xs font-mono font-bold text-emerald-700">
                                                                                            {pay.amount?.toFixed(3)} TND
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                                <TableRow className="h-9 bg-emerald-100/30 font-medium">
                                                                                    <TableCell colSpan={3} className="py-1 text-xs text-right text-emerald-900">Total Payé :</TableCell>
                                                                                    <TableCell className="py-1 text-right text-xs font-mono text-emerald-700">
                                                                                        {item.linkedPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0).toFixed(3)} TND
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-muted-foreground italic pl-2 border-l-2 border-muted">
                                                                        Aucun paiement enregistré pour ce document.
                                                                    </div>
                                                                )}

                                                                {/* Reste à payer */}
                                                                <div className="flex justify-end pt-2 border-t mt-4">
                                                                    <div className="text-right">
                                                                        <div className="text-xs text-muted-foreground">Reste à payer sur ce document</div>
                                                                        <div className={`text-lg font-bold font-mono ${(item.amount - (item.linkedPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0)) > 0.001
                                                                            ? "text-orange-600"
                                                                            : "text-emerald-600"
                                                                            }`}>
                                                                            {(item.amount - (item.linkedPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0)).toFixed(3)} TND
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
