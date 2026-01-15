"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, CalendarIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns"
import { fr } from "date-fns/locale"
import { useCompany } from "@/components/providers/company-provider" // Assuming this exists based on expense-manager.tsx

export function ExpenseExportButton() {
    const { selectedCompany } = useCompany()
    const [isExporting, setIsExporting] = useState(false)
    const [date, setDate] = useState<Date>(new Date())
    const [isOpen, setIsOpen] = useState(false)

    const handleExport = async () => {
        if (!selectedCompany) return

        try {
            setIsExporting(true)
            const supabase = createClient()

            const startDate = startOfMonth(date).toISOString()
            const endDate = endOfMonth(date).toISOString()

            // Fetch expenses
            // Filter: Company, Date Range, Status (PAID or PARTIAL)
            const { data: expenses, error } = await supabase
                .from("expenses")
                .select(`
          *,
          expense_categories (
            name
          )
        `)
                .eq("company_id", selectedCompany.id)
                .gte("payment_date", startDate)
                .lte("payment_date", endDate)
                .order("payment_date", { ascending: true })

            if (error) throw error

            // Filter locally to handle various status codes (French/English)
            const validStatuses = ["PAYE", "PARTIEL", "PAID", "PARTIAL"]
            const filteredExpenses = (expenses || []).filter(e =>
                e.status && validStatuses.includes(e.status.toUpperCase())
            )

            if (filteredExpenses.length === 0) {
                toast.info("Aucune dépense trouvée pour cette période (Payée ou Partiellement payée).")
                setIsExporting(false)
                return
            }

            // Group expenses
            const withTva: any[] = []
            const withholdingOnly: any[] = []
            const noTvaNoWithholding: any[] = []

            filteredExpenses.forEach((exp) => {
                const hasTva = exp.total_tva && exp.total_tva > 0
                const hasWithholding = exp.has_withholding_tax || (exp.withholding_tax_amount && exp.withholding_tax_amount > 0)

                if (hasTva) {
                    withTva.push(exp)
                } else if (hasWithholding) {
                    withholdingOnly.push(exp)
                } else {
                    noTvaNoWithholding.push(exp)
                }
            })

            // Helper to format currency
            const formatCurrency = (amount: number) => {
                return amount || 0
            }

            // Helper to prepare row data
            const prepareRow = (exp: any) => {
                const totalTTC = exp.total_ttc || 0
                const withholding = exp.withholding_tax_amount || 0
                const netToPay = totalTTC - withholding

                return {
                    "Date": format(new Date(exp.payment_date), "dd/MM/yyyy"),
                    "Bénéficiaire": exp.beneficiary_name || "",
                    "Catégorie": exp.expense_categories?.name || exp.category || "", // Fallback if join fails or is empty
                    "Mode de Paiement": exp.payment_method || "",
                    "Référence": exp.reference || "",
                    "Total HT": formatCurrency(exp.total_ht),
                    "Total TVA": formatCurrency(exp.total_tva),
                    "Total TTC": formatCurrency(totalTTC),
                    "Retenue à la source": formatCurrency(withholding),
                    "Net à payer": formatCurrency(netToPay),
                }
            }

            // Create workbook
            const wb = XLSX.utils.book_new()

            // Sheet 1: Avec TVA
            if (withTva.length > 0) {
                const wsTva = XLSX.utils.json_to_sheet(withTva.map(prepareRow))
                XLSX.utils.book_append_sheet(wb, wsTva, "Avec TVA")
            } else {
                // Create empty sheet with headers if no data
                const wsTva = XLSX.utils.json_to_sheet([{ "Date": "" }], { header: ["Date", "Bénéficiaire", "Catégorie", "Mode de Paiement", "Référence", "Total HT", "Total TVA", "Total TTC", "Retenue à la source", "Net à payer"], skipHeader: false })
                XLSX.utils.book_append_sheet(wb, wsTva, "Avec TVA")
            }

            // Sheet 2: Retenue à la source Uniquement
            if (withholdingOnly.length > 0) {
                const wsWithholding = XLSX.utils.json_to_sheet(withholdingOnly.map(prepareRow))
                XLSX.utils.book_append_sheet(wb, wsWithholding, "Retenue Source")
            } else {
                const wsWithholding = XLSX.utils.json_to_sheet([{ "Date": "" }], { header: ["Date", "Bénéficiaire", "Catégorie", "Mode de Paiement", "Référence", "Total HT", "Total TVA", "Total TTC", "Retenue à la source", "Net à payer"], skipHeader: false })
                XLSX.utils.book_append_sheet(wb, wsWithholding, "Retenue Source")
            }

            // Sheet 3: Sans TVA ni Retenue
            if (noTvaNoWithholding.length > 0) {
                const wsNone = XLSX.utils.json_to_sheet(noTvaNoWithholding.map(prepareRow))
                XLSX.utils.book_append_sheet(wb, wsNone, "Sans TVA-Retenue")
            } else {
                const wsNone = XLSX.utils.json_to_sheet([{ "Date": "" }], { header: ["Date", "Bénéficiaire", "Catégorie", "Mode de Paiement", "Référence", "Total HT", "Total TVA", "Total TTC", "Retenue à la source", "Net à payer"], skipHeader: false })
                XLSX.utils.book_append_sheet(wb, wsNone, "Sans TVA-Retenue")
            }

            // Generate filename
            const fileName = `Journal_Depenses_${format(date, "MM-yyyy")}.xlsx`

            // Write file
            XLSX.writeFile(wb, fileName)

            toast.success("Export réussi")
            setIsOpen(false)
        } catch (error) {
            console.error("Export error:", error)
            toast.error("Erreur lors de l'export")
        } finally {
            setIsExporting(false)
        }
    }

    const nextMonth = () => setDate(addMonths(date, 1))
    const prevMonth = () => setDate(subMonths(date, 1))

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Download className="h-4 w-4" />
                    Exporter
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Exporter les dépenses</h4>
                        <p className="text-sm text-muted-foreground">
                            Sélectionnez le mois à exporter.
                        </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <Button variant="outline" size="icon" onClick={prevMonth}>
                            {"<"}
                        </Button>
                        <div className="flex items-center gap-2 font-medium">
                            <CalendarIcon className="h-4 w-4" />
                            {format(date, "MMMM yyyy", { locale: fr })}
                        </div>
                        <Button variant="outline" size="icon" onClick={nextMonth}>
                            {">"}
                        </Button>
                    </div>
                    <Button
                        className="w-full"
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Exporter Excel
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
