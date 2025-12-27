
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
import { Input } from "@/components/ui/input"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type HistoryItem = {
    id: string
    date: string
    type: 'INVOICE' | 'DELIVERY_NOTE' | 'PAYMENT'
    reference: string
    amount: number
    status?: string
    details?: any[] // Lines or notes
    payment_method?: string
}

export function CustomerHistory({ customerId }: { customerId: string }) {
    const supabase = createClient()
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>("ALL")
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    // LOG ON RENDER
    console.log("RENDER CustomerHistory. ID:", customerId)

    useEffect(() => {
        console.log("MOUNT CustomerHistory. ID:", customerId)
        if (customerId) {
            fetchHistory()
        } else {
            console.error("NO CUSTOMER ID provided to CustomerHistory!")
        }
    }, [customerId])

    const fetchHistory = async () => {
        setIsLoading(true)
        console.log("DEBUG: fetching history for", customerId)
        try {
            // 1. Fetch Invoices (Main)
            const { data: invoices, error: invError } = await supabase
                .from('invoices')
                .select('*')
                .eq('customer_id', customerId)

            console.log("DEBUG: Invoices:", invoices, "Error:", invError)
            if (invError) throw invError

            // 1.1 Fetch Invoice Lines
            let invoiceLines: any[] = []
            if (invoices && invoices.length > 0) {
                const invIds = invoices.map(i => i.id)
                const { data: lines, error: linesError } = await supabase
                    .from('invoice_lines')
                    .select('*')
                    .in('invoice_id', invIds)

                console.log("DEBUG: Invoice Lines:", lines, "Error:", linesError)
                if (!linesError && lines) invoiceLines = lines
            }

            // 2. Fetch Delivery Notes (Main)
            const { data: bls, error: blError } = await supabase
                .from('delivery_notes')
                .select('*')
                .eq('customer_id', customerId)

            console.log("DEBUG: BLs:", bls, "Error:", blError)
            if (blError) throw blError

            // 2.1 Fetch Delivery Note Lines
            let blLines: any[] = []
            if (bls && bls.length > 0) {
                const blIds = bls.map(b => b.id)
                const { data: lines, error: linesError } = await supabase
                    .from('delivery_note_lines')
                    .select('*')
                    .in('delivery_note_id', blIds)

                if (!linesError && lines) blLines = lines
            }

            // 3. Fetch Payments
            let payments: any[] = []
            if (invoices && invoices.length > 0) {
                const invIds = invoices.map(i => i.id)
                const { data: payData, error: payError } = await supabase
                    .from('payments')
                    .select('*, invoice:invoices(invoice_number)')
                    .in('invoice_id', invIds)

                if (!payError && payData) payments = payData
            }

            // 4. Combine and Normalize
            const historyItems: HistoryItem[] = []

            invoices?.forEach((inv: any) => {
                const myLines = invoiceLines.filter(l => l.invoice_id === inv.id)
                historyItems.push({
                    id: inv.id,
                    date: inv.invoice_date,
                    type: 'INVOICE',
                    reference: inv.invoice_number,
                    amount: inv.total_ttc,
                    status: inv.status,
                    details: myLines
                })
            })

            bls?.forEach((bl: any) => {
                const myLines = blLines.filter(l => l.delivery_note_id === bl.id)
                historyItems.push({
                    id: bl.id,
                    date: bl.delivery_date || bl.created_at,
                    type: 'DELIVERY_NOTE',
                    reference: bl.delivery_note_number, // Correct column name from schema
                    amount: bl.total_ttc || 0,
                    status: bl.status,
                    details: myLines
                })
            })

            payments.forEach((pay: any) => {
                historyItems.push({
                    id: pay.id,
                    date: pay.payment_date,
                    type: 'PAYMENT',
                    reference: `PAY-${pay.id.substring(0, 8)}`,
                    amount: pay.amount,
                    payment_method: pay.payment_method,
                    status: 'COMPLETED',
                    details: [{ description: `Paiement pour facture ${pay.invoice?.invoice_number || 'N/A'}`, note: pay.notes }]
                })
            })

            // Sort by date desc
            historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            setHistory(historyItems)

        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setExpandedRows(newSet)
    }

    const filteredHistory = history.filter(item => {
        if (filterType === "ALL") return true
        return item.type === filterType
    })

    // Calculations for KPI
    const totalInvoiced = history.filter(h => h.type === 'INVOICE' && h.status !== 'BROUILLON' && h.status !== 'ANNULEE').reduce((sum, h) => sum + h.amount, 0)
    const totalPaid = history.filter(h => h.type === 'PAYMENT').reduce((sum, h) => sum + h.amount, 0)
    const totalDue = totalInvoiced - totalPaid // Rough estimate

    console.log("DEBUG TOTALS:", { totalInvoiced, totalPaid, totalDue })

    const handlePrint = () => {
        const printContent = document.getElementById("history-print-area")
        if (printContent) {
            const originalContents = document.body.innerHTML
            document.body.innerHTML = printContent.innerHTML
            window.print()
            document.body.innerHTML = originalContents
            window.location.reload() // Reload to restore state listeners
        }
    }

    return (
        <div className="space-y-6">
            {/* DEBUG SECTION - TO BE REMOVED */}
            <div className="p-4 bg-red-100 border-2 border-red-500 text-red-900 rounded-md text-sm font-mono mb-4">
                <p className="font-bold underline">DEBUG DIAGNOSTIC:</p>
                <p><strong>Customer ID Prop:</strong> {customerId ? `"${customerId}"` : "UNDEFINED/NULL"}</p>
                <p><strong>Is Loading:</strong> {isLoading ? 'YES' : 'NO'}</p>
                <p><strong>Items Count:</strong> {history.length}</p>
                <p><strong>Current Filter:</strong> {filterType}</p>
                <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
            </div>
            {/* END DEBUG SECTION */}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Facturé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInvoiced.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Payé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{totalPaid.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">TND</span></div>
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
                                        Aucune opération trouvée.
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
                                            <TableCell>{format(new Date(item.date), "dd/MM/yyyy")}</TableCell>
                                            <TableCell>
                                                {item.type === 'INVOICE' && <Badge variant="outline" className="border-indigo-500 text-indigo-500"><FileText className="mr-1 h-3 w-3" /> Facture</Badge>}
                                                {item.type === 'DELIVERY_NOTE' && <Badge variant="outline" className="border-blue-500 text-blue-500"><Truck className="mr-1 h-3 w-3" /> BL</Badge>}
                                                {item.type === 'PAYMENT' && <Badge variant="outline" className="border-emerald-500 text-emerald-500"><CreditCard className="mr-1 h-3 w-3" /> Paiement</Badge>}
                                            </TableCell>
                                            <TableCell className="font-medium">{item.reference}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {item.type === 'PAYMENT' ? (
                                                    <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                                                        <ArrowDownLeft className="h-3 w-3" />
                                                        {item.amount.toFixed(3)}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-end gap-1">
                                                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                                        {item.amount.toFixed(3)}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{item.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                        {expandedRows.has(item.id) && (
                                            <TableRow className="bg-muted/30">
                                                <TableCell colSpan={6} className="p-4">
                                                    <div className="pl-8 text-sm">
                                                        <h4 className="font-semibold mb-2">Détails :</h4>
                                                        {item.type === 'PAYMENT' ? (
                                                            <div className="grid grid-cols-2 gap-4 max-w-lg">
                                                                <div><span className="text-muted-foreground">Méthode:</span> {item.payment_method || '-'}</div>
                                                                <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {item.details?.[0]?.note || '-'}</div>
                                                                <div className="col-span-2 text-muted-foreground italic">{item.details?.[0]?.description}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="border rounded-md overflow-hidden bg-background">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="h-8">
                                                                            <TableHead className="py-1">Article / Description</TableHead>
                                                                            <TableHead className="py-1 text-right">Qté</TableHead>
                                                                            <TableHead className="py-1 text-right">Prix U.</TableHead>
                                                                            <TableHead className="py-1 text-right">Total HT</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {item.details?.map((line: any, idx: number) => (
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
