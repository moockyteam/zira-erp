"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowDownLeft, ArrowUpRight, History, RefreshCcw, Users } from "lucide-react"
import { cn } from "@/lib/utils"

type StockMovement = {
    id: string
    created_at: string
    movement_type: "ENTREE" | "SORTIE" | "AJUSTEMENT"
    quantity: number
    unit_price: number | null
    current_sale_price: number | null
    notes: string | null
    suppliers: { name: string } | null
}

interface StockHistoryDialogProps {
    itemId: string | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    itemName: string
}

export function StockHistoryDialog({ itemId, isOpen, onOpenChange, companyId, itemName }: StockHistoryDialogProps) {
    const supabase = createClient()
    const [movements, setMovements] = useState<StockMovement[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 12

    useEffect(() => {
        if (isOpen && itemId) {
            fetchHistory()
            setCurrentPage(1)
        }
    }, [isOpen, itemId])

    const fetchHistory = async () => {
        if (!itemId) return
        setIsLoading(true)
        const { data } = await supabase
            .from("stock_movements")
            .select("*, suppliers(name)")
            .eq("item_id", itemId)
            .order("created_at", { ascending: false })

        if (data) setMovements(data as any)
        setIsLoading(false)
    }

    const totalEntries = movements.filter(m => m.movement_type === "ENTREE").reduce((acc, m) => acc + Number(m.quantity), 0)
    const totalExits = movements.filter(m => m.movement_type === "SORTIE").reduce((acc, m) => acc + Number(m.quantity), 0)

    // Pagination logic
    const totalPages = Math.ceil(movements.length / ITEMS_PER_PAGE)
    const paginatedMovements = movements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="fixed !max-w-none !w-screen !h-screen !rounded-none !border-none !m-0 !p-0 !top-0 !left-0 !translate-x-0 !translate-y-0 flex flex-col bg-slate-50 dark:bg-slate-950 focus:outline-none shadow-none">

                {/* HEADER */}
                <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 border-b shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div onClick={() => onOpenChange(false)} className="cursor-pointer p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <History className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {itemName}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                                Historique des mouvements
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                {movements.length} enregistrements
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Total Entrées</span>
                            <span className="text-2xl font-bold text-emerald-600">+{totalEntries}</span>
                        </div>
                        <div className="w-px h-12 bg-slate-200 dark:bg-slate-800"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Total Sorties</span>
                            <span className="text-2xl font-bold text-rose-600">-{totalExits}</span>
                        </div>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 p-8 overflow-hidden flex flex-col items-center">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <RefreshCcw className="h-10 w-10 animate-spin text-indigo-500" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <History className="h-16 w-16 mb-4 text-slate-200" />
                            <p className="text-lg font-medium">Aucun mouvement pour le moment</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-7xl flex flex-col h-full gap-4">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm flex-1 overflow-hidden flex flex-col">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[15%] h-12">Date</TableHead>
                                            <TableHead className="w-[10%]">Type</TableHead>
                                            <TableHead className="w-[10%] text-right">Quantité</TableHead>
                                            <TableHead className="w-[15%] text-right">Prix Achat</TableHead>
                                            <TableHead className="w-[15%] text-right">Prix Vente</TableHead>
                                            <TableHead className="w-[35%]">Détails</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedMovements.map((move) => (
                                            <TableRow key={move.id} className="h-16">
                                                <TableCell className="font-medium text-slate-600 dark:text-slate-300">
                                                    {format(new Date(move.created_at), "dd MMM yyyy", { locale: fr })}
                                                    <span className="block text-xs text-muted-foreground font-normal">
                                                        {format(new Date(move.created_at), "HH:mm", { locale: fr })}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                                                        move.movement_type === 'ENTREE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            move.movement_type === 'SORTIE' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                                'bg-blue-50 text-blue-700 border-blue-100'
                                                    )}>
                                                        {move.movement_type}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={cn(
                                                        "font-mono font-bold text-base",
                                                        move.movement_type === 'ENTREE' ? "text-emerald-600" :
                                                            move.movement_type === 'SORTIE' ? "text-rose-600" : "text-blue-600"
                                                    )}>
                                                        {move.movement_type === 'ENTREE' ? '+' : move.movement_type === 'SORTIE' ? '-' : ''}{move.quantity}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-slate-600">
                                                    {move.unit_price ? move.unit_price.toFixed(3) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-slate-600">
                                                    {move.current_sale_price ? move.current_sale_price.toFixed(3) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {move.suppliers?.name ? (
                                                            <div className="flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">
                                                                <Users className="h-3 w-3 mr-1.5" />
                                                                {move.suppliers.name}
                                                            </div>
                                                        ) : null}
                                                        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                                            {move.notes}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border shadow-sm shrink-0">
                                    <Button
                                        variant="ghost"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    >
                                        Précédent
                                    </Button>
                                    <span className="text-sm font-medium text-slate-600">
                                        Page {currentPage} sur {totalPages}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        Suivant
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
