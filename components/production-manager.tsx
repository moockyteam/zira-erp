"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Factory, History, PlusCircle, Package, TrendingUp, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCompany } from "@/components/providers/company-provider"
import { ProductionDialog } from "@/components/production-dialog"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type ProductionHistory = {
    id: string
    created_at: string
    quantity: number
    unit_price: number
    item: { name: string; unit_of_measure: string | null; type: string }
    notes: string | null
}

export function ProductionManager() {
    const supabase = createClient()
    const { selectedCompany } = useCompany()

    const [history, setHistory] = useState<ProductionHistory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProductionOpen, setIsProductionOpen] = useState(false)

    // Filter state
    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilter, setTypeFilter] = useState("all") // 'all', 'product', 'semi_finished'

    useEffect(() => {
        if (selectedCompany) {
            fetchHistory()
        } else {
            setHistory([])
            setIsLoading(false)
        }
    }, [selectedCompany])

    const fetchHistory = async () => {
        setIsLoading(true)

        const { data, error } = await supabase
            .from("stock_movements")
            .select(`
                id, 
                created_at, 
                quantity, 
                unit_price, 
                notes,
                item:items!item_id (name, unit_of_measure, type)
            `)
            .eq("company_id", selectedCompany!.id)
            .eq("movement_type", "ENTREE")
            .ilike("notes", "%Sortie de Production%")
            .order("created_at", { ascending: false })
            .limit(100)

        if (error) {
            console.error(error)
        } else {
            setHistory(data as any || [])
        }
        setIsLoading(false)
    }

    // Filter Logic
    const filteredHistory = useMemo(() => {
        let result = history

        // 1. Text Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase()
            result = result.filter(h =>
                h.item.name.toLowerCase().includes(lowerTerm) ||
                (h.notes && h.notes.toLowerCase().includes(lowerTerm))
            )
        }

        // 2. Type Filter
        if (typeFilter !== "all") {
            result = result.filter(h => h.item.type === typeFilter)
        }

        return result
    }, [history, searchTerm, typeFilter])

    // Stats Logic
    const stats = useMemo(() => {
        const totalProductions = filteredHistory.length // Stats reflect filtered view
        const totalQuantity = filteredHistory.reduce((acc, curr) => acc + Number(curr.quantity), 0)
        const totalValue = filteredHistory.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.unit_price || 0)), 0)

        return {
            totalProductions,
            totalQuantity,
            totalValue
        }
    }, [filteredHistory])

    if (!selectedCompany) return null

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestion de la Production"
                description="Lancez des ordres de fabrication et suivez l'historique de production."
                icon={Factory}
            >
                <Button size="lg" className="shadow-sm" onClick={() => setIsProductionOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nouvelle Production
                </Button>
            </PageHeader>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard
                    title="Productions"
                    value={stats.totalProductions}
                    subtitle="Ordres réalisés"
                    icon={Factory}
                    variant="default"
                />
                <KpiCard
                    title="Volume Produit"
                    value={stats.totalQuantity.toFixed(0)}
                    subtitle="Unités totales"
                    icon={Package}
                    variant="info"
                />
                <KpiCard
                    title="Valorisation"
                    value={`${stats.totalValue.toFixed(2)} TND`}
                    subtitle="Valeur produite (estimée)"
                    icon={TrendingUp}
                    variant="success"
                />
            </div>

            {/* Filter Toolbar */}
            <FilterToolbar
                searchValue={searchTerm}
                searchPlaceholder="Rechercher une production..."
                onSearchChange={setSearchTerm}
                resultCount={filteredHistory.length}
                showReset={searchTerm !== "" || typeFilter !== "all"}
                onReset={() => { setSearchTerm(""); setTypeFilter("all"); }}
            >
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px] h-9 bg-background">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            <SelectValue placeholder="Nature" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        <SelectItem value="product">Produit Fini (PF)</SelectItem>
                        <SelectItem value="semi_finished">Semi-Fini (SF)</SelectItem>
                    </SelectContent>
                </Select>
            </FilterToolbar>

            {/* Table */}
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="h-11">
                                <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Date
                                </div>
                            </TableHead>
                            <TableHead className="h-11">
                                <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Produit Fabriqué
                                </div>
                            </TableHead>
                            <TableHead className="h-11">
                                <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Nature
                                </div>
                            </TableHead>
                            <TableHead className="h-11 text-right">
                                <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Quantité
                                </div>
                            </TableHead>
                            <TableHead className="h-11 text-right">
                                <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Coût Total
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Chargement...</TableCell>
                            </TableRow>
                        ) : filteredHistory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <History className="h-8 w-8 opacity-20" />
                                        {searchTerm || typeFilter !== "all" ? "Aucun résultat trouvé." : "Aucun historique de production."}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredHistory.map(h => (
                                <TableRow key={h.id}>
                                    <TableCell className="font-medium">
                                        {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{h.item.name}</span>
                                            <span className="text-xs text-muted-foreground">Production Interne</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {h.item.type === 'semi_finished' ? (
                                            <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50">Semi-Fini (SF)</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Produit Fini (PF)</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-foreground">
                                        +{h.quantity} <span className="text-xs font-normal text-muted-foreground">{h.item.unit_of_measure}</span>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {h.unit_price ? (h.quantity * h.unit_price).toFixed(3) : '-'} <span className="text-xs text-muted-foreground">TND</span>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ProductionDialog
                isOpen={isProductionOpen}
                onOpenChange={setIsProductionOpen}
                companyId={selectedCompany.id}
                item={null}
                onSuccess={fetchHistory}
            />
        </div>
    )
}
