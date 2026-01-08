"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Search, Loader2, AlertCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"

// Types
type BomItem = {
    id: string
    child_item_id: string
    quantity: number
    child_item: {
        name: string
        unit_of_measure: string | null
        type: string
        consumption_unit: string | null
    }
}

type SearchItem = {
    id: string
    name: string
    unit_of_measure: string | null
    type: string
}

interface BomManagerProps {
    parentItemId: string
    companyId: string
}

export function BomManager({ parentItemId, companyId }: BomManagerProps) {
    const supabase = createClient()
    const [ingredients, setIngredients] = useState<BomItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchItem[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [openCombobox, setOpenCombobox] = useState(false)

    useEffect(() => {
        if (parentItemId) {
            fetchBom()
        }
    }, [parentItemId])

    const fetchBom = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from("bill_of_materials")
            .select(`
                id, 
                child_item_id, 
                quantity, 
                child_item:items!child_item_id (name, unit_of_measure, type, consumption_unit)
            `)
            .eq("parent_item_id", parentItemId)

        if (error) {
            console.error("Error fetching BOM:", error)
            toast.error("Erreur chiffrement recette")
        } else {
            setIngredients(data as any || [])
        }
        setIsLoading(false)
    }

    const searchItems = async (query: string) => {
        if (!query || query.length < 2) return
        setIsSearching(true)

        const { data, error } = await supabase
            .from("items")
            .select("id, name, unit_of_measure, type")
            .eq("company_id", companyId)
            // Prevent selecting itself or already added items (optional, but good UX)
            .neq("id", parentItemId)
            .ilike("name", `%${query}%`)
            .limit(10)

        if (!error && data) {
            setSearchResults(data)
        }
        setIsSearching(false)
    }

    const addIngredient = async (item: SearchItem) => {
        // Check if already exists locally
        if (ingredients.some(i => i.child_item_id === item.id)) {
            toast.warning("Cet article est déjà dans la recette.")
            return
        }

        const { data, error } = await supabase
            .from("bill_of_materials")
            .insert({
                parent_item_id: parentItemId,
                child_item_id: item.id,
                quantity: 1 // Default qty
            })
            .select(`
                id, 
                child_item_id, 
                quantity, 
                child_item:items!child_item_id (name, unit_of_measure, type, consumption_unit)
            `)
            .single()

        if (error) {
            toast.error("Erreur lors de l'ajout : " + error.message)
        } else {
            setIngredients([...ingredients, data as any])
            toast.success("Ingrédient ajouté")
            setOpenCombobox(false)
        }
    }

    const updateQuantity = async (bomId: string, newQty: number) => {
        // Optimistic update
        const oldIngredients = [...ingredients]
        setIngredients(ingredients.map(i => i.id === bomId ? { ...i, quantity: newQty } : i))

        const { error } = await supabase
            .from("bill_of_materials")
            .update({ quantity: newQty })
            .eq("id", bomId)

        if (error) {
            toast.error("Erreur maj quantité")
            setIngredients(oldIngredients) // Rollback
        }
    }

    const removeIngredient = async (bomId: string) => {
        const { error } = await supabase
            .from("bill_of_materials")
            .delete()
            .eq("id", bomId)

        if (error) {
            toast.error("Erreur suppression")
        } else {
            setIngredients(ingredients.filter(i => i.id !== bomId))
            toast.success("Ingrédient retiré")
        }
    }

    return (
        <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium">Composition (Recette)</h3>
                    <p className="text-xs text-muted-foreground">
                        Liste des articles consommés pour fabriquer 1 unité de ce produit.
                    </p>
                </div>

                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-dashed">
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter un composant
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[300px]" align="end">
                        <Command shouldFilter={false}>
                            <CommandInput
                                placeholder="Rechercher (ex: Farine)..."
                                value={searchQuery}
                                onValueChange={(val) => {
                                    setSearchQuery(val)
                                    searchItems(val)
                                }}
                            />
                            <CommandList>
                                <CommandEmpty>
                                    {isSearching ? (
                                        <div className="flex items-center justify-center p-2 text-xs">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Recherche...
                                        </div>
                                    ) : (
                                        "Aucun article trouvé."
                                    )}
                                </CommandEmpty>
                                <CommandGroup>
                                    {searchResults.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={item.name}
                                            onSelect={() => addIngredient(item)}
                                        >
                                            <div className="flex flex-col">
                                                <span>{item.name}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {item.type === 'raw_material' ? 'Matière Première' :
                                                        item.type === 'semi_finished' ? 'Semi-Fini' : 'Autre'}
                                                </span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="h-9">Article</TableHead>
                            <TableHead className="h-9">Type</TableHead>
                            <TableHead className="h-9 w-[120px] text-right">Qté Requise</TableHead>
                            <TableHead className="h-9 w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ingredients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                                    <div className="flex flex-col items-center gap-1">
                                        <AlertCircle className="h-5 w-5 opacity-20" />
                                        Aucun ingrédient défini.
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            ingredients.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        {item.child_item.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] font-normal">
                                            {item.child_item.type === 'raw_material' ? 'MP' :
                                                item.child_item.type === 'semi_finished' ? 'SF' : 'Autre'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Input
                                                type="number"
                                                className="h-7 w-20 text-right pr-1"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-xs text-muted-foreground w-8 text-left">
                                                {item.child_item.consumption_unit || item.child_item.unit_of_measure || "unité"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeIngredient(item.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs">
                <strong>Note :</strong> Lors de la fabrication d'une unité de ce produit, les stocks des ingrédients listés ci-dessus seront automatiquement déduits.
            </div>
        </div>
    )
}
