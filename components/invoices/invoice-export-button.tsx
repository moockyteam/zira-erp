import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, CalendarIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, setMonth, setYear } from "date-fns"
import { fr } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InvoiceExportButtonProps {
    companyId: string
    search?: string
    status?: string // "ALL" or specific status
}

export function InvoiceExportButton({ companyId, search, status }: InvoiceExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const supabase = createClient()

    const currentYear = new Date().getFullYear()
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
    const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())

    const handleExport = async () => {
        if (!companyId) return
        setIsExporting(true)

        try {
            // Calculate date range for the selected month
            const baseDate = new Date()
            const targetDate = setYear(setMonth(baseDate, parseInt(selectedMonth)), parseInt(selectedYear))

            const start = startOfMonth(targetDate)
            const end = endOfMonth(targetDate)

            const formattedStart = format(start, 'yyyy-MM-dd')
            const formattedEnd = format(end, 'yyyy-MM-dd')

            const validStatuses = ["ENVOYE", "PAYEE", "PARTIELLEMENT_PAYEE"]

            let query = supabase
                .from("invoices")
                .select(`
          id, 
          invoice_number, 
          invoice_date, 
          status, 
          total_ht, 
          total_tva, 
          total_ttc, 
          has_stamp,
          total_fodec,
          currency,
          withholding_tax_amount,
          customers ( name ),
          invoice_lines (
            quantity,
            unit_price_ht,
            tva_rate,
            remise_percentage
          )
        `)
                .eq("company_id", companyId)
                .in("status", validStatuses)
                .gte('invoice_date', formattedStart)
                .lte('invoice_date', formattedEnd)

            if (search) {
                // Optional: Add search filter if needed, though usually export by month is sufficient
            }

            const { data: invoices, error } = await query

            if (error) throw error
            if (!invoices || invoices.length === 0) {
                toast.info(`Aucune facture trouvée pour ${format(targetDate, 'MMMM yyyy', { locale: fr })}`)
                setIsExporting(false)
                return
            }

            // 2. Process Data
            const exportRows = invoices.map((inv: any) => {
                const taxAnalysis = {
                    base0: 0,
                    base7: 0,
                    base13: 0,
                    base19: 0,
                    vat7: 0,
                    vat13: 0,
                    vat19: 0,
                    totalFodec: inv.total_fodec || 0
                }

                const lines = inv.invoice_lines || []

                lines.forEach((line: any) => {
                    const lineAmount = line.quantity * line.unit_price_ht
                    const discountAmount = line.remise_percentage ? (lineAmount * line.remise_percentage / 100) : 0
                    const netHt = lineAmount - discountAmount

                    const rate = line.tva_rate || 0
                    if (rate === 0) taxAnalysis.base0 += netHt
                    else if (rate === 7) {
                        taxAnalysis.base7 += netHt
                        taxAnalysis.vat7 += (netHt * 0.07)
                    } else if (rate === 13) {
                        taxAnalysis.base13 += netHt
                        taxAnalysis.vat13 += (netHt * 0.13)
                    } else if (rate === 19) {
                        taxAnalysis.base19 += netHt
                        taxAnalysis.vat19 += (netHt * 0.19)
                    }
                })

                return {
                    "N° Facture": inv.invoice_number,
                    "Date": format(new Date(inv.invoice_date), "dd/MM/yyyy"),
                    "Client": inv.customers?.name || "Client Inconnu",
                    "Status": inv.status,
                    "Devise": inv.currency || "TND",
                    "Total HT": inv.total_ht,
                    "Base 0%": taxAnalysis.base0,
                    "Base 7%": taxAnalysis.base7,
                    "TVA 7%": taxAnalysis.vat7,
                    "Base 13%": taxAnalysis.base13,
                    "TVA 13%": taxAnalysis.vat13,
                    "Base 19%": taxAnalysis.base19,
                    "TVA 19%": taxAnalysis.vat19,
                    "FODEC": taxAnalysis.totalFodec,
                    "Timbre": inv.has_stamp ? 1.000 : 0,
                    "Retenue à la source": inv.withholding_tax_amount || 0,
                    "Total TVA": inv.total_tva,
                    "Total TTC": inv.total_ttc
                }
            })

            // 3. Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(exportRows)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Factures")

            // 4. Download
            XLSX.writeFile(workbook, `Journal_Ventes_${format(targetDate, 'MM-yyyy')}.xlsx`)
            toast.success("Export réussi !")
            setIsOpen(false)

        } catch (err: any) {
            console.error("Export Error Detail:", JSON.stringify(err, null, 2))
            toast.error(`Erreur lors de l'export: ${err.message || "Erreur inconnue"}`)
        } finally {
            setIsExporting(false)
        }
    }

    const months = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ]
    const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter Excel
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Exporter les ventes</h4>
                        <p className="text-sm text-muted-foreground">
                            Sélectionnez le mois et l'année pour l'export.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label>Mois</Label>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map((m, i) => (
                                            <SelectItem key={i} value={i.toString()}>
                                                {m}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Année</Label>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button onClick={handleExport} disabled={isExporting} className="w-full">
                            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                            Télécharger
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
