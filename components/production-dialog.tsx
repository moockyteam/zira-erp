"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Factory, AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"

type ProductionDialogProps = {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    item: { id: string; name: string; quantity_on_hand: number } | null
    onSuccess: () => void
}

type BomItem = {
    id: string
    quantity: number // Qty per unit
    child_item: {
        name: string
        quantity_on_hand: number
        unit_of_measure: string | null
    }
}

export function ProductionDialog({ isOpen, onOpenChange, companyId, item, onSuccess }: ProductionDialogProps) {
    const supabase = createClient()
    const [quantity, setQuantity] = useState<string>("1")
    const [isLoading, setIsLoading] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const [bom, setBom] = useState<BomItem[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && item) {
            setQuantity("1")
            setError(null)
            fetchBom(item.id)
        }
    }, [isOpen, item])

    const fetchBom = async (itemId: string) => {
        setIsAnalyzing(true)
        const { data, error } = await supabase
            .from("bill_of_materials")
            .select(`
            id, 
            quantity, 
            child_item:items!child_item_id (name, quantity_on_hand, unit_of_measure)
        `)
            .eq("parent_item_id", itemId)

        if (error) {
            console.error("Error fetching BOM:", error)
            toast.error("Impossible de charger la recette.")
        } else {
            setBom(data as any || [])
        }
        setIsAnalyzing(false)
    }

    const handleProduce = async () => {
        if (!item || !quantity) return
        const qtyToProduce = parseFloat(quantity)
        if (isNaN(qtyToProduce) || qtyToProduce <= 0) {
            setError("Quantité invalide")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.rpc('perform_product_assembly', {
                p_company_id: companyId,
                p_item_id: item.id,
                p_quantity_to_produce: qtyToProduce
            })

            if (error) throw error

            // Custom error from RPC
            if (data && data.success === false) {
                throw new Error(data.error)
            }

            toast.success(`Production enregistrée : +${qtyToProduce} ${item.name}`)
            onSuccess()
            onOpenChange(false)
        } catch (err: any) {
            console.error("Production error:", err)
            setError(err.message || "Une erreur est survenue lors de la production.")
        } finally {
            setIsLoading(false)
        }
    }

    // Calculate generic check
    const qtyNum = parseFloat(quantity) || 0
    const missingComponents = bom.filter(b => (b.quantity * qtyNum) > b.child_item.quantity_on_hand)
    const isBlocking = missingComponents.length > 0

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-purple-600" />
                        Lancer un Ordre de Production
                    </DialogTitle>
                    <DialogDescription>
                        Produire <strong>{item?.name}</strong> déduira automatiquement les composants du stock.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Quantité à produire</Label>
                            <Input
                                type="number"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="text-lg font-bold"
                                min="0.1"
                                step="0.1"
                            />
                        </div>
                        <div className="pb-3 text-sm text-muted-foreground">
                            Stock actuel : <strong>{item?.quantity_on_hand}</strong> units
                        </div>
                    </div>

                    {isAnalyzing ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : bom.length === 0 ? (
                        <div className="p-4 bg-orange-50 text-orange-700 rounded-md border border-orange-200 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">Aucune recette définie !</p>
                                <p className="text-sm mt-1">
                                    Vous devez d'abord définir la composition (BOM) de cet article dans "Modifier &gt; Composition" avant de pouvoir le produire.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex justify-between">
                                <span>Composants requis</span>
                                <span>Stock Dispo</span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto divide-y">
                                {bom.map(b => {
                                    const required = b.quantity * qtyNum
                                    const hasStock = b.child_item.quantity_on_hand >= required
                                    return (
                                        <div key={b.id} className="flex items-center justify-between p-3 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{b.child_item.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {b.quantity} x {qtyNum} = <strong>{required.toFixed(2)}</strong> {b.child_item.unit_of_measure || 'u'}
                                                </span>
                                            </div>
                                            <div className={`text-right ${!hasStock ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                {hasStock ? (
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        Manque {(required - b.child_item.quantity_on_hand).toFixed(2)}
                                                    </span>
                                                )}
                                                <div className="text-[10px] text-muted-foreground font-normal">
                                                    Stock: {b.child_item.quantity_on_hand}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {isBlocking && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                            <strong>Production impossible :</strong> Stock insuffisant pour certains composants.
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button
                        onClick={handleProduce}
                        disabled={isLoading || isBlocking || bom.length === 0}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Factory className="h-4 w-4 mr-2" />}
                        Confirmer Production
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
