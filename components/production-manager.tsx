"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Factory, History, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCompany } from "@/components/providers/company-provider"
import { ProductionDialog } from "@/components/production-dialog"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

type ProductionHistory = {
    id: string
    created_at: string
    quantity: number
    unit_price: number
    item: { name: string; unit_of_measure: string | null }
    notes: string | null
}

export function ProductionManager() {
    const supabase = createClient()
    const { selectedCompany } = useCompany()
    const [history, setHistory] = useState<ProductionHistory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProductionOpen, setIsProductionOpen] = useState(false)

    useEffect(() => {
        if (selectedCompany) {
            fetchHistory()
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
                item:items!item_id (name, unit_of_measure)
            `)
            .eq("company_id", selectedCompany!.id)
            .eq("movement_type", "ENTREE")
            .ilike("notes", "%Sortie de Production%")
            .order("created_at", { ascending: false })
            .limit(50)

        if (error) {
            console.error(error)
        } else {
            setHistory(data as any || [])
        }
        setIsLoading(false)
    }

    if (!selectedCompany) return null

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestion de la Production" 
                description="Lancez des ordres de fabrication et suivez l'historique de production."
                icon={Factory}
            >
                <Button onClick={() => setIsProductionOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvelle Production
                </Button>
            </PageHeader>

            <div className="grid gap-6">
               <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Produit Fabriqué</TableHead>
                                <TableHead className="text-right">Quantité</TableHead>
                                <TableHead className="text-right">Coût Unitaire</TableHead>
                                <TableHead className="text-right">Coût Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Chargement...</TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <History className="h-8 w-8 opacity-20" />
                                            Aucun historique de production.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map(h => (
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
                                        <TableCell className="text-right font-bold text-green-600">
                                            +{h.quantity} {h.item.unit_of_measure}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {h.unit_price ? h.unit_price.toFixed(3) : '-'} TND
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {h.unit_price ? (h.quantity * h.unit_price).toFixed(3) : '-'} TND
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
               </Card>
            </div>

            <ProductionDialog 
                isOpen={isProductionOpen}
                onOpenChange={setIsProductionOpen}
                companyId={selectedCompany.id}
                item={null} // Passing null triggers selection mode
                onSuccess={fetchHistory}
            />
        </div>
    )
}
