"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Trash2, Save, Check, ChevronsUpDown, Package, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

type Item = { id: string; name: string; quantity_on_hand: number; reference?: string }
type VoucherLine = { local_id: string; item_id: string; item_name: string; quantity: number; current_stock: number }

interface StockIssueFormDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    companyId: string
    onSuccess: () => void
}

export function StockIssueFormDialog({ isOpen, onOpenChange, companyId, onSuccess }: StockIssueFormDialogProps) {
    const supabase = createClient()

    // Form State
    const [reference, setReference] = useState("")
    const [reason, setReason] = useState("")
    const [lines, setLines] = useState<VoucherLine[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Data State
    const [items, setItems] = useState<Item[]>([])
    const [isLoadingItems, setIsLoadingItems] = useState(false)

    // Add Line State
    const [selectedItemId, setSelectedItemId] = useState("")
    const [selectedQuantity, setSelectedQuantity] = useState<string>("1")
    const [openCombobox, setOpenCombobox] = useState(false)

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setReference("")
            setReason("")
            setLines([])
            setSelectedItemId("")
            setSelectedQuantity("1")
            fetchItems()

            // Generate auto-reference suggestion (optional, simple timestamp based for now)
            const date = new Date()
            const autoRef = `BS-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`
            setReference(autoRef)
        }
    }, [isOpen, companyId])

    const fetchItems = async () => {
        if (!companyId) return
        setIsLoadingItems(true)
        const { data, error } = await supabase
            .from("items")
            .select("id, name, quantity_on_hand, reference")
            .eq("company_id", companyId)
            .eq("is_archived", false)
            .order("name")

        if (error) {
            console.error("Error fetching items:", error)
            toast.error("Erreur lors du chargement des articles")
        } else {
            setItems(data || [])
        }
        setIsLoadingItems(false)
    }

    const handleAddLine = () => {
        if (!selectedItemId) {
            toast.error("Veuillez sélectionner un article")
            return
        }

        const qty = parseFloat(selectedQuantity)
        if (isNaN(qty) || qty <= 0) {
            toast.error("La quantité doit être supérieure à 0")
            return
        }

        const item = items.find(i => i.id === selectedItemId)
        if (!item) return

        // Check if item already exists in lines
        const existingLineIndex = lines.findIndex(l => l.item_id === selectedItemId)

        if (existingLineIndex >= 0) {
            // Update existing line
            const newLines = [...lines]
            newLines[existingLineIndex].quantity += qty
            setLines(newLines)
            toast.success(`Quantité mise à jour pour ${item.name}`)
        } else {
            // Add new line
            setLines([...lines, {
                local_id: crypto.randomUUID(),
                item_id: item.id,
                item_name: item.name,
                quantity: qty,
                current_stock: item.quantity_on_hand
            }])
        }

        // Reset selection
        setSelectedItemId("")
        setSelectedQuantity("1")
    }

    const removeLine = (local_id: string) => {
        setLines(lines.filter(l => l.local_id !== local_id))
    }

    const handleSave = async () => {
        if (!reference.trim()) {
            toast.error("La référence est obligatoire")
            return
        }
        if (lines.length === 0) {
            toast.error("Veuillez ajouter au moins un article")
            return
        }

        setIsSaving(true)
        try {
            // 1. Create Voucher
            const { data: voucher, error: voucherError } = await supabase
                .from("stock_issue_vouchers")
                .insert({
                    company_id: companyId,
                    reference: reference,
                    reason: reason,
                    voucher_date: new Date().toISOString()
                })
                .select("id")
                .single()

            if (voucherError) throw voucherError

            // 2. Create Lines
            const linesPayload = lines.map(line => ({
                voucher_id: voucher.id,
                item_id: line.item_id,
                quantity: line.quantity
            }))

            const { error: linesError } = await supabase
                .from("stock_issue_voucher_lines")
                .insert(linesPayload)

            if (linesError) throw linesError

            toast.success("Bon de sortie créé avec succès")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error creating stock issue:", error)
            toast.error("Erreur: " + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const selectedItem = items.find(i => i.id === selectedItemId)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Nouveau Bon de Sortie</DialogTitle>
                    <DialogDescription>
                        Créez un bon pour sortir des articles du stock (perte, usage interne, etc.)
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                    {/* General Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ref">Référence *</Label>
                            <Input
                                id="ref"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="ex: BS-2024-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reason">Motif</Label>
                            <Input
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="ex: Consommation interne"
                            />
                        </div>
                    </div>

                    {/* Add Item Section */}
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <PlusCircle className="h-3 w-3" /> Ajouter un article
                        </Label>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Article</Label>
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between bg-background"
                                        >
                                            {selectedItem ? (
                                                <span className="truncate">{selectedItem.name}</span>
                                            ) : (
                                                <span className="text-muted-foreground">Rechercher un article...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Rechercher par nom ou référence..." />
                                            <CommandList>
                                                <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                                                <CommandGroup>
                                                    {items.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={item.name}
                                                            onSelect={() => {
                                                                setSelectedItemId(item.id)
                                                                setOpenCombobox(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedItemId === item.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{item.name}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    Ref: {item.reference || '-'} • Stock: {item.quantity_on_hand}
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
                            <div className="w-24 space-y-1">
                                <Label className="text-xs">Quantité</Label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={selectedQuantity}
                                    onChange={(e) => setSelectedQuantity(e.target.value)}
                                    className="bg-background"
                                />
                            </div>
                            <Button onClick={handleAddLine} disabled={!selectedItemId}>
                                Ajouter
                            </Button>
                        </div>
                        {selectedItem && (
                            <div className={cn(
                                "text-xs flex items-center gap-1",
                                selectedItem.quantity_on_hand <= 0 ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {selectedItem.quantity_on_hand <= 0 ? (
                                    <AlertCircle className="h-3 w-3" />
                                ) : (
                                    <Package className="h-3 w-3" />
                                )}
                                Stock disponible: <span className="font-medium">{selectedItem.quantity_on_hand}</span>
                            </div>
                        )}
                    </div>

                    {/* Lines Table */}
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Article</TableHead>
                                    <TableHead className="text-right">Stock actuel</TableHead>
                                    <TableHead className="text-right w-[100px]">Quantité</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                                            Aucun article ajouté
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lines.map((line) => (
                                        <TableRow key={line.local_id}>
                                            <TableCell className="font-medium">{line.item_name}</TableCell>
                                            <TableCell className="text-right text-muted-foreground text-xs">
                                                {line.current_stock}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {line.quantity}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeLine(line.local_id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || lines.length === 0}>
                        {isSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />}
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
