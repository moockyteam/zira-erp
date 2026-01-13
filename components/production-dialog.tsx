"use client"

import { useState, useEffect, useRef } from "react"
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
import { Factory, AlertTriangle, ArrowRight, Loader2, CheckCircle2, Search, X } from "lucide-react"

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

// MODULE-LEVEL LOCK - persists across component instances
let globalProductionLock = false

export function ProductionDialog({ isOpen, onOpenChange, companyId, item, onSuccess }: ProductionDialogProps) {
    const supabase = createClient()
    const [quantity, setQuantity] = useState<string>("1")
    const [isLoading, setIsLoading] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    // REF to prevent double-submit (more reliable than state)
    const isProducingRef = useRef(false)

    // Selection Logic
    const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; quantity_on_hand: number } | null>(item)
    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const [bom, setBom] = useState<BomItem[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setSelectedItem(item)
            setQuantity("1")
            setError(null)
            setBom([])
            setSearchTerm("")
            setSearchResults([])
            if (item) fetchBom(item.id)
        }
    }, [isOpen, item])

    const searchItems = async (query: string) => {
        setSearchTerm(query)
        if (query.length < 2) {
            setSearchResults([])
            return
        }
        setIsSearching(true)
        const { data } = await supabase
            .from("items")
            .select("id, name, quantity_on_hand, type")
            .eq("company_id", companyId)
            // Filter logic: technically any item can be produced if it has a BOM, 
            // but usually it's product or semi_finished. Let's allowing searching all except raw materials?
            // Or just allow all and let BOM check handle it.
            .in("type", ["product", "semi_finished"])
            .ilike("name", `%${query}%`)
            .limit(5)

        setSearchResults(data || [])
        setIsSearching(false)
    }

    const handleSelectItem = (i: any) => {
        setSelectedItem(i)
        setSearchTerm("")
        setSearchResults([])
        fetchBom(i.id)
    }

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
        // CRITICAL: Prevent double-submit with GLOBAL LOCK (persists across instances)
        if (globalProductionLock) {
            console.log('[Production] BLOCKED BY GLOBAL LOCK - Already producing')
            return
        }

        if (!selectedItem || !quantity) return
        if (isLoading) return

        const qtyToProduce = parseFloat(quantity)
        if (isNaN(qtyToProduce) || qtyToProduce <= 0) {
            setError("Quantité invalide")
            return
        }

        // Lock production GLOBALLY
        globalProductionLock = true
        isProducingRef.current = true
        setIsLoading(true)
        setError(null)

        console.log('[Production] Calling RPC with:', {
            p_company_id: companyId,
            p_item_id: selectedItem.id,
            p_quantity_to_produce: qtyToProduce
        })

        try {
            const { data, error } = await supabase.rpc('perform_product_assembly', {
                p_company_id: companyId,
                p_item_id: selectedItem.id,
                p_quantity_to_produce: qtyToProduce
            })

            console.log('[Production] RPC Response:', { data, error })

            if (error) throw error

            // Custom error from RPC
            if (data && data.success === false) {
                throw new Error(data.error)
            }

            toast.success(`Production enregistrée : +${qtyToProduce} ${selectedItem.name}`)
            onSuccess()
            onOpenChange(false)
        } catch (err: any) {
            console.error("Production error:", err)
            setError(err.message || "Une erreur est survenue lors de la production.")
        } finally {
            setIsLoading(false)
            isProducingRef.current = false
            globalProductionLock = false // Unlock globally
        }
    }

    // Calculate generic check
    const qtyNum = parseFloat(quantity) || 0
    const missingComponents = bom.filter(b => (b.quantity * qtyNum) > b.child_item.quantity_on_hand)
    const isBlocking = missingComponents.length > 0

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] overflow-visible">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-purple-600" />
                        Lancer un Ordre de Production
                    </DialogTitle>
                    <DialogDescription>
                        Produire un article déduira automatiquement les composants du stock.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* ITEM SELECTION */}
                    <div className="space-y-2">
                        <Label>Article à produire</Label>
                        {selectedItem ? (
                            <div className="flex items-center justify-between p-3 border rounded-md bg-purple-50 border-purple-100">
                                <span className="font-medium flex items-center gap-2">
                                    <Factory className="h-4 w-4 text-purple-600" />
                                    {selectedItem.name}
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="h-6 text-xs hover:bg-purple-100">
                                    <X className="h-3 w-3 mr-1" /> Changer
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher un produit fini ou semi-fini..."
                                        value={searchTerm}
                                        onChange={(e) => searchItems(e.target.value)}
                                        className="pl-9"
                                        autoFocus
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-50 bg-popover text-popover-foreground border rounded-md shadow-md mt-1 max-h-[200px] overflow-y-auto">
                                        {searchResults.map(res => (
                                            <div
                                                key={res.id}
                                                className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex justify-between items-center transition-colors px-3 py-2 text-sm"
                                                onClick={() => handleSelectItem(res)}
                                            >
                                                <span className="font-medium">{res.name}</span>
                                                <span className="text-xs text-muted-foreground">Stock: {res.quantity_on_hand}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedItem && (
                        <>
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
                                    Stock actuel : <strong>{selectedItem?.quantity_on_hand}</strong> units
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
                        </>
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
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleProduce()
                        }}
                        disabled={isLoading || isBlocking || bom.length === 0 || !selectedItem}
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
