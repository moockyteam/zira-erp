"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { FileText, Truck, CreditCard, RefreshCcw, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

interface PaymentHistoryListProps {
    companyId: string
    refreshTrigger: number
}

type PaymentItem = {
    id: string
    date: string
    amount: number
    method: string
    notes: string | null
    type: 'INVOICE' | 'DELIVERY_NOTE'
    reference: string
    customerName: string
}

export function PaymentHistoryList({ companyId, refreshTrigger }: PaymentHistoryListProps) {
    const supabase = createClient()
    const [payments, setPayments] = useState<PaymentItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    const fetchHistory = async () => {
        setIsLoading(true)
        try {
            // 1. Fetch Invoice Payments
            const { data: invPayments, error: invError } = await supabase
                .from('invoice_payments')
                .select(`
                    id, payment_date, amount, payment_method, notes,
                    invoice:invoices!inner(
                        invoice_number,
                        company_id,
                        customer:customers(name)
                    )
                `)
                .eq('invoice.company_id', companyId)
                .order('payment_date', { ascending: false })
                .limit(50)

            // 2. Fetch BL Payments
            const { data: blPayments, error: blError } = await supabase
                .from('delivery_note_payments')
                .select(`
                    id, payment_date, amount, payment_method, notes,
                    delivery_note:delivery_notes!inner(
                        delivery_note_number,
                        company_id,
                        customer:customers(name)
                    )
                `)
                .eq('delivery_note.company_id', companyId)
                .order('payment_date', { ascending: false })
                .limit(50)

            if (invError) console.error("Inv Pay Error", invError)
            if (blError) console.error("BL Pay Error", blError)

            // 3. Merge and Normalize
            let all: PaymentItem[] = []

            if (invPayments) {
                // Supabase joins can return arrays or objects. We know it's a single invoice per payment.
                // Using 'any' for the joined part to avoid complex type definition matching for now.
                const invMapped = invPayments.map((p: any) => {
                    const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
                    const cust = Array.isArray(inv?.customer) ? inv.customer[0] : inv?.customer

                    return {
                        id: `inv-${p.id}`,
                        date: p.payment_date,
                        amount: p.amount,
                        method: p.payment_method,
                        notes: p.notes,
                        type: 'INVOICE' as const,
                        reference: inv?.invoice_number || "???",
                        customerName: cust?.name || "Client Inconnu"
                    }
                })
                all = [...all, ...invMapped]
            }

            if (blPayments) {
                const blMapped = blPayments.map((p: any) => {
                    const bl = Array.isArray(p.delivery_note) ? p.delivery_note[0] : p.delivery_note
                    const cust = Array.isArray(bl?.customer) ? bl.customer[0] : bl?.customer

                    return {
                        id: `bl-${p.id}`,
                        date: p.payment_date,
                        amount: p.amount,
                        method: p.payment_method,
                        notes: p.notes,
                        type: 'DELIVERY_NOTE' as const,
                        reference: bl?.delivery_note_number || "???",
                        customerName: cust?.name || "Client Inconnu"
                    }
                })
                all = [...all, ...blMapped]
            }

            // 4. Sort
            all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setPayments(all)

        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (companyId) {
            fetchHistory()
        }
    }, [companyId, refreshTrigger])

    // Filter Logic
    const filteredPayments = useMemo(() => {
        if (!searchTerm) return payments
        const lower = searchTerm.toLowerCase()
        return payments.filter(p =>
            p.customerName.toLowerCase().includes(lower) ||
            p.reference.toLowerCase().includes(lower) ||
            (p.notes && p.notes.toLowerCase().includes(lower))
        )
    }, [payments, searchTerm])

    return (
        <Card className="h-full shadow-md border-none bg-transparent">
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold">Derniers Encaissements</h3>
                    <p className="text-sm text-muted-foreground">Flux de trésorerie récent (Global)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={isLoading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Actualiser
                </Button>
            </div>

            <FilterToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Rechercher par client, référence..."
                resultCount={filteredPayments.length}
                resultLabel="paiements"
                className="mb-4"
            />

            <Card className="border bg-card">
                <CardContent className="p-0">
                    <div className="rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Document</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead className="text-right">Montant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                                            {searchTerm ? "Aucun paiement trouvé pour cette recherche." : "Aucun paiement récent trouvé."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPayments.map((payment) => (
                                        <TableRow key={payment.id} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-xs">
                                                {format(new Date(payment.date), "dd/MM/yyyy")}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {payment.customerName}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-[10px] gap-1">
                                                    {payment.type === 'INVOICE' ? <FileText className="h-3 w-3 text-indigo-500" /> : <Truck className="h-3 w-3 text-blue-500" />}
                                                    {payment.reference}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {payment.method}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold text-emerald-600">
                                                +{payment.amount.toFixed(3)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </Card>
    )
}
