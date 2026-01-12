"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2, Search, AlertCircle, Info } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// Type for pending BOM items (used in create mode)
export type PendingBomItem = {
    tempId: string
    child_item_id: string
    quantity: number
    child_item: {
        name: string
        unit_of_measure: string | null
        default_purchase_price: number | null
    }
}

type BomManagerProps = {
    parentItemId?: string  // Optional for create mode
    companyId: string
    // Pending mode props
    pendingItems?: PendingBomItem[]
    onPendingChange?: (items: PendingBomItem[]) => void
    isCreateMode?: boolean
}

type BomItem = {
    id: string
    child_item_id: string
    quantity: number
    child_item: {
        name: string
        unit_of_measure: string | null
        default_purchase_price: number | null
    }
}

type SearchResult = {
    id: string
    name: string
    quantity_on_hand: number
    unit_of_measure: string | null
    default_purchase_price: number | null
}

export function BomManager({ parentItemId, companyId, pendingItems = [], onPendingChange, isCreateMode = false }: BomManagerProps) {
    const supabase = createClient()
    const [bomItems, setBomItems] = useState<BomItem[]>([])
    const [isLoading, setIsLoading] = useState(!isCreateMode)

    // Add Item State
    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
    const [qtyToAdd, setQtyToAdd] = useState("")

    useEffect(() => {
        if (!isCreateMode && parentItemId) {
            fetchBom()
        }
    }, [parentItemId, isCreateMode])

    const fetchBom = async () => {
        if (!parentItemId) return
        setIsLoading(true)
        const { data, error } = await supabase
            .from("bill_of_materials")
            .select(`
                id,
                child_item_id,
                quantity,
                child_item:items!child_item_id (name, unit_of_measure, default_purchase_price)
            `)
            .eq("parent_item_id", parentItemId)

        if (error) {
            console.error(error)
            toast.error("Erreur chargement recette")
        } else {
            setBomItems(data as any || [])
        }
        setIsLoading(false)
    }

    const handleSearch = async (val: string) => {
        setSearchTerm(val)
        if (val.length < 2) {
            setSearchResults([])
            return
        }
        setIsSearching(true)

        let query = supabase
            .from("items")
            .select("id, name, quantity_on_hand, unit_of_measure, default_purchase_price")
            .eq("company_id", companyId)
            .ilike("name", `%${val}%`)
            .limit(5)

        // Prevent self-reference only in edit mode
        if (parentItemId) {
            query = query.neq("id", parentItemId)
        }

        const { data } = await query
        setSearchResults(data as any || [])
        setIsSearching(false)
    }

    const selectResult = (item: SearchResult) => {
        setSelectedItem(item)
        setSearchTerm(item.name)
        setSearchResults([])
    }

    // Get the active items list (pending or from DB)
    const activeItems = isCreateMode ? pendingItems : bomItems

    const addIngredient = async () => {
        if (!selectedItem || !qtyToAdd) return

        const qty = parseFloat(qtyToAdd.replace(',', '.'))
        if (!qty || qty <= 0) {
            toast.error("Quantité invalide")
            return
        }

        // Check for duplicates
        if (activeItems.some(b => b.child_item_id === selectedItem.id)) {
            toast.error("Cet ingrédient est déjà dans la recette")
            return
        }

        if (isCreateMode) {
            // Add to pending items
            const newItem: PendingBomItem = {
                tempId: `temp-${Date.now()}`,
                child_item_id: selectedItem.id,
                quantity: qty,
                child_item: {
                    name: selectedItem.name,
                    unit_of_measure: selectedItem.unit_of_measure,
                    default_purchase_price: selectedItem.default_purchase_price
                }
            }
            onPendingChange?.([...pendingItems, newItem])
            toast.success("Ingrédient ajouté (sera sauvegardé avec l'article)")
        } else {
            // Save to database
            const { error } = await supabase
                .from("bill_of_materials")
                .insert({
                    parent_item_id: parentItemId,
                    child_item_id: selectedItem.id,
                    quantity: qty
                })

            if (error) {
                toast.error(error.message)
                return
            } else {
                toast.success("Ingrédient ajouté")
                fetchBom()
            }
        }

        setSelectedItem(null)
        setSearchTerm("")
        setQtyToAdd("")
    }

    const removeIngredient = async (id: string) => {
        if (isCreateMode || id.startsWith('temp-')) {
            // Remove from pending
            onPendingChange?.(pendingItems.filter(p => p.tempId !== id))
            toast.success("Ingrédient retiré")
        } else {
            // Delete from database
            const { error } = await supabase.from("bill_of_materials").delete().eq("id", id)
            if (error) toast.error("Erreur suppression")
            else {
                toast.success("Ingrédient retiré")
                fetchBom()
            }
        }
    }

    // Calculate cost
    const totalCost = activeItems.reduce((acc, item) => {
        const price = item.child_item.default_purchase_price || 0
        return acc + (price * item.quantity)
    }, 0)

    if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6 p-1">
            {isCreateMode && (
                <div className="text-xs text-blue-700 flex gap-2 items-center p-2 bg-blue-50 rounded border border-blue-100">
                    <Info className="h-4 w-4" />
                    Les ingrédients seront sauvegardés automatiquement lors de la création de l'article.
                </div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Ajouter un ingrédient</h4>
                    <p className="text-xs text-muted-foreground">Recherchez une matière première ou un composant.</p>
                </div>
                <div className="flex items-end gap-2 w-2/3">
                    <div className="flex-1 relative">
                        <Label className="text-xs mb-1 block">Article</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-popover border shadow-md rounded-md mt-1 z-50 overflow-hidden">
                                {searchResults.map(res => (
                                    <div
                                        key={res.id}
                                        className="p-2 text-sm hover:bg-accent cursor-pointer px-3"
                                        onClick={() => selectResult(res)}
                                    >
                                        <span className="font-medium">{res.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">Stock: {res.quantity_on_hand} {res.unit_of_measure}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="w-24">
                        <Label className="text-xs mb-1 block">Quantité</Label>
                        <Input
                            placeholder="0.00"
                            value={qtyToAdd}
                            onChange={e => setQtyToAdd(e.target.value)}
                            className="h-9"
                            type="number"
                        />
                    </div>
                    {selectedItem && (
                        <div className="pb-2 text-xs font-medium text-muted-foreground">
                            {selectedItem.unit_of_measure || 'unité'}
                        </div>
                    )}
                    <Button onClick={addIngredient} disabled={!selectedItem || !qtyToAdd} className="h-9" size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ingrédient</TableHead>
                            <TableHead className="text-right">Quantité Requise</TableHead>
                            <TableHead className="text-right">Coût Unitaire (Est.)</TableHead>
                            <TableHead className="text-right">Coût Total</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activeItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic">
                                    Aucun ingrédient défini pour cette recette.
                                </TableCell>
                            </TableRow>
                        ) : (
                            activeItems.map(item => {
                                const itemId = isCreateMode ? (item as PendingBomItem).tempId : (item as BomItem).id
                                return (
                                    <TableRow key={itemId}>
                                        <TableCell className="font-medium">
                                            {item.child_item.name}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.quantity} <span className="text-muted-foreground text-xs">{item.child_item.unit_of_measure}</span>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {item.child_item.default_purchase_price ? item.child_item.default_purchase_price.toFixed(3) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {item.child_item.default_purchase_price ? (item.child_item.default_purchase_price * item.quantity).toFixed(3) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeIngredient(itemId)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                        {activeItems.length > 0 && (
                            <TableRow className="bg-muted/50 font-medium">
                                <TableCell colSpan={3} className="text-right">Coût de revient matière théorique :</TableCell>
                                <TableCell className="text-right text-emerald-600">{totalCost.toFixed(3)} TND</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="text-xs text-muted-foreground flex gap-2 items-center p-2 bg-blue-50 text-blue-700 rounded border border-blue-100">
                <AlertCircle className="h-4 w-4" />
                Cette recette sera utilisée pour déduire automatiquement les stocks lors de chaque production.
            </div>
        </div>
    )
}
