"use client"

import { useEffect, useState, Fragment } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import {
    FileText,
    Truck,
    CreditCard,
    ChevronDown,
    ChevronUp,
    Printer,
    ArrowRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface CustomerPaymentOverviewProps {
    customerId: string
    refreshTrigger: number
    company?: any // We receive the full company object
}

type StatementItem = {
    id: string
    date: string
    type: 'INVOICE' | 'DELIVERY_NOTE' | 'PAYMENT'
    reference: string
    description: string
    debit: number
    credit: number
    balance: number
    linkedPayments?: any[]
    details?: any
}

export function CustomerPaymentOverview({ customerId, refreshTrigger, company }: CustomerPaymentOverviewProps) {
    const supabase = createClient()
    const [statement, setStatement] = useState<StatementItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [customerName, setCustomerName] = useState("")
    const [customerDetails, setCustomerDetails] = useState<any>(null)
    const [currentBalance, setCurrentBalance] = useState<number | null>(null)
    const [initialBalance, setInitialBalance] = useState<number>(0)
    const [balanceStartDate, setBalanceStartDate] = useState<string | null>(null)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId) return
            setIsLoading(true)
            try {
                // 1. Fetch Customer & Current Balance
                const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).single()
                if (cust) {
                    setCustomerName(cust.name)
                    setCustomerDetails(cust)
                    setInitialBalance(cust.initial_balance || 0)
                    setBalanceStartDate(cust.balance_start_date)
                }

                const { data: balance } = await supabase.rpc('calculate_customer_balance', { p_customer_id: customerId })
                setCurrentBalance(balance)

                // ... (rest of fetch logic remains same until render) ...

                // 2. Fetch Docs & Payments (Limit 50 for performance)
                const { data: invoices } = await supabase.from('invoices').select('*').eq('customer_id', customerId).order('invoice_date', { ascending: false }).limit(50)
                const { data: bls } = await supabase.from('delivery_notes').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(50)

                // 3. Fetch Linked Payments for these documents (for Details View)
                let invoicePayments: any[] = []
                if (invoices && invoices.length > 0) {
                    const invIds = invoices.map(i => i.id)
                    const { data } = await supabase.from('invoice_payments').select('*').in('invoice_id', invIds)
                    if (data) invoicePayments = data
                }

                let blPaymentsLinked: any[] = []
                if (bls && bls.length > 0) {
                    const blIds = bls.map(b => b.id)
                    const { data } = await supabase.from('delivery_note_payments').select('*').in('delivery_note_id', blIds)
                    if (data) blPaymentsLinked = data
                }

                // 4. Fetch Global Payments for the Credit Column (Pure Payments)
                const { data: invPayments, error: invError } = await supabase.from('invoice_payments')
                    .select('*, invoice:invoices!inner(customer_id, invoice_number)')
                    .eq('invoice.customer_id', customerId)
                    .order('payment_date', { ascending: false })
                    .limit(50)

                const { data: blPayments, error: blError } = await supabase.from('delivery_note_payments')
                    .select('*, delivery_note:delivery_notes!inner(customer_id, delivery_note_number)')
                    .eq('delivery_note.customer_id', customerId)
                    .order('payment_date', { ascending: false })
                    .limit(50)

                if (invError) console.error("Error fetching invoice payments:", invError)
                if (blError) console.error("Error fetching BL payments:", blError)

                // 5. Merge & Sort
                let tempItems: any[] = []

                invoices?.forEach((inv: any) => {
                    const linked = invoicePayments.filter(p => p.invoice_id === inv.id)
                    tempItems.push({
                        id: inv.id,
                        date: inv.invoice_date,
                        type: 'INVOICE',
                        reference: inv.invoice_number,
                        description: `Facture du ${format(new Date(inv.invoice_date), "dd/MM")}`,
                        amount: inv.total_ttc,
                        debit: inv.total_ttc,
                        credit: 0,
                        linkedPayments: linked,
                        details: inv
                    })
                })

                bls?.forEach((bl: any) => {
                    const linked = blPaymentsLinked.filter(p => p.delivery_note_id === bl.id)
                    tempItems.push({
                        id: bl.id,
                        date: bl.delivery_date || bl.created_at,
                        type: 'DELIVERY_NOTE',
                        reference: bl.delivery_note_number,
                        description: `BL du ${format(new Date(bl.delivery_date || bl.created_at), "dd/MM")}`,
                        amount: bl.total_ttc,
                        debit: bl.total_ttc,
                        credit: 0,
                        linkedPayments: linked,
                        details: bl
                    })
                })

                invPayments?.forEach((p: any) => {
                    tempItems.push({
                        id: `pay-inv-${p.id}`,
                        date: p.payment_date,
                        type: 'PAYMENT',
                        reference: `Paie ${p.payment_method}`,
                        description: `Règlement Facture`,
                        amount: p.amount,
                        debit: 0,
                        credit: p.amount,
                        details: p.notes
                    })
                })

                blPayments?.forEach((p: any) => {
                    tempItems.push({
                        id: `pay-bl-${p.id}`,
                        date: p.payment_date,
                        type: 'PAYMENT',
                        reference: `Paie ${p.payment_method}`,
                        description: `Règlement BL`,
                        amount: p.amount,
                        debit: 0,
                        credit: p.amount,
                        details: p.notes
                    })
                })

                // Sort Descending
                tempItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                // 6. Calculate Running Balance Backwards
                let runningBalance = balance || 0
                const finalStatement: StatementItem[] = []

                for (const item of tempItems) {
                    finalStatement.push({
                        ...item,
                        balance: runningBalance
                    })
                    runningBalance = runningBalance - item.debit + item.credit
                }

                setStatement(finalStatement)

            } catch (error) {
                console.error("Error fetching statement:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [customerId, refreshTrigger])

    // ... (rest of methods)

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedRows(newSet)
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <>
            {/* --------------------------------------------------------------------------------
               PRINT VIEW (Hidden on screen, Visible on print)
               -------------------------------------------------------------------------------- */}
            <div className="hidden print:block font-serif text-black p-6 text-sm max-w-[210mm] mx-auto bg-white min-h-0 h-auto">
                {/* Header - Unchanged */}
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                    <div className="w-1/2">
                        <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">{company?.name || "NOM DE LA SOCIÉTÉ"}</h1>
                        <div className="text-sm text-gray-700 space-y-1">
                            <p>{company?.address || "Adresse de la société"}</p>
                            <p>{company?.email} {company?.phone && `| Tél: ${company.phone}`}</p>
                            <p>Matricule Fiscal: {company?.fiscal_id || "N/A"}</p>
                        </div>
                    </div>
                    <div className="w-1/2 text-right">
                        <div className="inline-block text-left bg-gray-50 border border-gray-300 p-4 rounded min-w-[250px]">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2 border-b border-gray-200 pb-1">Client</p>
                            <p className="font-bold text-xl mb-1">{customerName}</p>
                            {customerDetails && (
                                <div className="text-sm text-gray-600 leading-snug">
                                    <p>{customerDetails.address}</p>
                                    <p>{customerDetails.phone}</p>
                                    <p>MF: {customerDetails.tax_id}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Document Title & Summary */}
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 uppercase">Relevé de Compte</h2>
                            <p className="text-sm text-gray-500 mt-1">Date d'édition : {format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
                        </div>
                        <div className="text-right">
                            {/* Big Current Balance Box */}
                            <div className="border-[3px] border-black p-3 bg-gray-50 min-w-[200px] text-center shadow-sm">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Solde Net à Payer</p>
                                <p className="text-2xl font-bold text-black">
                                    {(currentBalance || 0).toFixed(3)} <span className="text-base font-normal text-gray-600">TND</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary Strip */}
                    {statement.length > 0 && (
                        <div className="grid grid-cols-4 gap-0 border border-gray-300 rounded overflow-hidden text-center text-xs bg-white mt-4">
                            <div className="p-2 border-r border-gray-300 bg-gray-50">
                                <p className="text-gray-500 uppercase text-[10px] mb-1">Solde Initial {balanceStartDate && `(${format(new Date(balanceStartDate), 'dd/MM/yy')})`}</p>
                                <p className="font-bold text-base">
                                    {initialBalance.toFixed(3)}
                                </p>
                            </div>
                            <div className="p-2 border-r border-gray-300">
                                <p className="text-gray-500 uppercase text-[10px] mb-1">Total Débit (Facturé)</p>
                                <p className="font-bold text-base">
                                    {statement.reduce((acc, item) => acc + (Number(item.debit) || 0), 0).toFixed(3)}
                                </p>
                            </div>
                            <div className="p-2 border-r border-gray-300">
                                <p className="text-gray-500 uppercase text-[10px] mb-1">Total Crédit (Payé)</p>
                                <p className="font-bold text-emerald-700 text-base">
                                    {statement.reduce((acc, item) => acc + (Number(item.credit) || 0), 0).toFixed(3)}
                                </p>
                            </div>
                            <div className="p-2 bg-gray-100">
                                <p className="text-gray-500 uppercase text-[10px] mb-1">Balance Période</p>
                                <p className="font-bold text-base">
                                    {(statement.reduce((acc, item) => acc + (Number(item.debit) || 0) - (Number(item.credit) || 0), 0)).toFixed(3)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Print Table */}
                <table className="w-full text-xs border-collapse mb-8">
                    <thead>
                        <tr className="border-b-2 border-black text-left">
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 w-20">Date</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600">Libellé & Référence</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 text-right w-24">Débit</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 text-right w-24">Crédit</th>
                            <th className="py-2 font-bold uppercase text-[10px] text-gray-600 text-right w-28 bg-gray-50">Solde Prog.</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800">
                        {statement.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-500 italic">Aucune écriture trouvée.</td>
                            </tr>
                        ) : (
                            statement.map((item, index) => (
                                <Fragment key={item.id}>
                                    <tr className={cn(
                                        "border-b border-gray-200 break-inside-avoid",
                                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50" // Zebra striping for readability
                                    )}>
                                        <td className="py-2 align-top font-medium">{format(new Date(item.date), "dd/MM/yy")}</td>
                                        <td className="py-2 align-top">
                                            <div className="font-bold text-black">{item.type === 'PAYMENT' ? 'Règlement' : (item.type === 'INVOICE' ? 'Facture' : 'Bon de Livraison')}</div>
                                            <div className="text-gray-600 text-[10px]">{item.reference}</div>
                                            {/* Minimal description */}
                                        </td>
                                        <td className="py-2 align-top text-right font-mono">
                                            {item.debit > 0 ? item.debit.toFixed(3) : ""}
                                        </td>
                                        <td className="py-2 align-top text-right font-mono text-emerald-700 font-medium">
                                            {item.credit > 0 ? item.credit.toFixed(3) : ""}
                                        </td>
                                        <td className="py-2 align-top text-right font-mono font-bold bg-gray-50">
                                            {item.balance.toFixed(3)}
                                        </td>
                                    </tr>
                                    {/* Linked Payments Sub-row (Simplified) */}
                                    {item.linkedPayments && item.linkedPayments.length > 0 && (
                                        <tr className="bg-white break-inside-avoid">
                                            <td colSpan={5} className="pt-0 pb-2 pl-4 pr-32">
                                                <div className="ml-8 pl-4 border-l-2 border-gray-200 text-[10px] text-gray-500 mt-1">
                                                    {item.linkedPayments.map((p: any, idx) => (
                                                        <div key={idx} className="flex justify-between py-0.5">
                                                            <span>↳ Réglé le {format(new Date(p.payment_date), "dd/MM/yyyy")} ({p.payment_method})</span>
                                                            <span>{p.amount.toFixed(3)} TND</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Footer */}
                <div className="text-center text-[10px] text-gray-400 mt-8 pt-4 border-t border-gray-100">
                    <p>Ce document est généré automatiquement par le système de gestion.</p>
                </div>
            </div>

            {/* --------------------------------------------------------------------------------
               SCREEN VIEW (Existing App Interaction) - HIDDEN ON PRINT
               -------------------------------------------------------------------------------- */}
            <Card className="h-full shadow-md border-t-4 border-t-indigo-500 print:hidden">


                <CardHeader className="pb-4 border-b flex flex-col gap-4 print:hidden">
                    <div className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">Relevé de Compte : {customerName}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Aperçu de la situation financière du client.
                            </p>
                        </div>
                        <Button variant="outline" size="icon" onClick={handlePrint} title="Imprimer">
                            <Printer className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Quick Stats Bar */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="bg-muted/30 px-3 py-2 rounded border flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium uppercase">Solde Initial {balanceStartDate && `(${format(new Date(balanceStartDate), 'dd/MM/yy')})`}</span>
                            <span className="font-mono font-bold">{initialBalance.toFixed(3)} TND</span>
                        </div>

                        <div className="bg-emerald-50/50 px-3 py-2 rounded border border-emerald-100 flex flex-col">
                            <span className="text-xs text-emerald-600 font-medium uppercase">Total Payé</span>
                            <span className="font-mono font-bold text-emerald-700">
                                {statement.reduce((acc, item) => acc + (Number(item.credit) || 0), 0).toFixed(3)} TND
                            </span>
                        </div>

                        <div className={cn(
                            "px-3 py-2 rounded border flex flex-col",
                            (currentBalance || 0) > 0 ? "bg-orange-50 border-orange-100" : "bg-emerald-50 border-emerald-100"
                        )}>
                            <span className={cn("text-xs font-medium uppercase", (currentBalance || 0) > 0 ? "text-orange-600" : "text-emerald-600")}>Solde Actuel</span>
                            <span className={cn("font-mono font-bold", (currentBalance || 0) > 0 ? "text-orange-700" : "text-emerald-700")}>
                                {(currentBalance || 0).toFixed(3)} TND
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[600px] overflow-y-auto print:overflow-visible print:max-h-none">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 sticky top-0 z-10 shadow-sm print:hidden">
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead>Libellé & Réf</TableHead>
                                    <TableHead className="text-right w-[120px] text-muted-foreground">Débit</TableHead>
                                    <TableHead className="text-right w-[120px] text-emerald-600">Crédit</TableHead>
                                    <TableHead className="text-right w-[140px] font-bold">Solde</TableHead>
                                </TableRow>
                                {/* Print-only Header (Simpler) */}
                                <TableRow className="hidden print:table-row border-b-2 border-black">
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead className="font-bold text-black">Date</TableHead>
                                    <TableHead className="font-bold text-black">Libellé & Réf</TableHead>
                                    <TableHead className="text-right font-bold text-black">Débit</TableHead>
                                    <TableHead className="text-right font-bold text-black">Crédit</TableHead>
                                    <TableHead className="text-right font-bold text-black">Solde</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statement.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Aucune écriture trouvée sur la période récente.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    statement.map(item => (
                                        <Fragment key={item.id}>
                                            <TableRow
                                                className="hover:bg-muted/50 transition-colors cursor-pointer break-inside-avoid"
                                                onClick={() => toggleRow(item.id)}
                                            >
                                                <TableCell>
                                                    {item.type !== 'PAYMENT' && (
                                                        <span className="print:hidden">
                                                            {expandedRows.has(item.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs font-medium">
                                                    {format(new Date(item.date), "dd/MM/yy")}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium flex items-center gap-2">
                                                            {item.type === 'INVOICE' && <FileText className="h-3 w-3 text-indigo-500 print:text-black" />}
                                                            {item.type === 'DELIVERY_NOTE' && <Truck className="h-3 w-3 text-blue-500 print:text-black" />}
                                                            {item.type === 'PAYMENT' && <CreditCard className="h-3 w-3 text-emerald-500 print:text-black" />}
                                                            {item.reference}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground hidden sm:inline-block print:inline-block">
                                                            {item.type === 'PAYMENT' ? (item.details || item.description) : item.description}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm text-muted-foreground print:text-black">
                                                    {item.debit > 0 ? item.debit.toFixed(3) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm text-emerald-600 font-medium print:text-black">
                                                    {item.credit > 0 ? item.credit.toFixed(3) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm font-bold bg-muted/20 print:bg-transparent">
                                                    {item.balance.toFixed(3)}
                                                </TableCell>
                                            </TableRow>

                                            {/* EXPANDED DETAILS: Visible if Expanded OR if Printing */}
                                            {item.type !== 'PAYMENT' && (
                                                <TableRow
                                                    className={cn(
                                                        "bg-muted/20 print:bg-transparent print:border-b print:border-dashed print:border-gray-300",
                                                        expandedRows.has(item.id) ? "" : "hidden print:table-row"
                                                    )}
                                                >
                                                    <TableCell colSpan={6} className="p-0">
                                                        <div className="p-4 pl-12 space-y-2 print:pl-8 print:py-2">
                                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 print:hidden">
                                                                Paiements liés à ce document
                                                            </div>
                                                            {item.linkedPayments && item.linkedPayments.length > 0 ? (
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {item.linkedPayments.map((p: any) => (
                                                                        <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border text-sm print:border-none print:p-0 print:py-1">
                                                                            <div className="flex gap-2 items-center">
                                                                                <Badge variant="outline" className="text-[10px] print:border-black print:text-black">{format(new Date(p.payment_date), "dd/MM/yyyy")}</Badge>
                                                                                <span className="text-xs text-muted-foreground print:text-black">{p.payment_method}</span>
                                                                            </div>
                                                                            <span className="font-mono font-bold text-emerald-600 print:text-black">
                                                                                Reçu: {p.amount.toFixed(3)} TND
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex justify-end pt-2 border-t mt-1 print:border-black">
                                                                        <span className="text-xs font-medium mr-2">Total Payé:</span>
                                                                        <span className="font-mono font-bold">
                                                                            {item.linkedPayments.reduce((acc: number, curr: any) => acc + curr.amount, 0).toFixed(3)} TND
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground italic flex items-center gap-2 print:hidden">
                                                                    <ArrowRight className="h-3 w-3" /> Aucun paiement lié directement.
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
                    </div>
                </CardContent>
            </Card>
        </>
    )
}

function cn(...inputs: (string | undefined | null | false)[]) {
    return inputs.filter(Boolean).join(" ")
}
