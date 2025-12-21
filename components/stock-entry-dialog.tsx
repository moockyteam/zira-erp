"use client"


import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Textarea } from "@/components/ui/textarea"
import { Check, ChevronsUpDown, Package, Truck, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Définition des types
type Item = { id: string; name: string; sale_price?: number | null }
type Supplier = { id: string; name: string }

interface StockEntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  items: Item[]
  selectedItem?: Item | null
  suppliers: Supplier[]
  onEntrySuccess: () => void
}

export function StockEntryDialog({
  isOpen,
  onOpenChange,
  companyId,
  items,
  selectedItem,
  suppliers,
  onEntrySuccess,
}: StockEntryDialogProps) {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSubmittingRef = useRef(false)

  // États du formulaire
  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [quantity, setQuantity] = useState<string>("")
  const [unitPrice, setUnitPrice] = useState<string>("")
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  const selectedItemObj = items.find(i => i.id === selectedItemId)

  const [openItem, setOpenItem] = useState(false)
  const [openSupplier, setOpenSupplier] = useState(false)

  useEffect(() => {
    if (isOpen && selectedItem) {
      setSelectedItemId(selectedItem.id)
    }
  }, [isOpen, selectedItem])

  useEffect(() => {
    if (!isOpen) {
      isSubmittingRef.current = false
      setIsLoading(false)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return
    }
    if (!selectedItemId || !quantity || Number.parseFloat(quantity) <= 0) {
      setError("Veuillez sélectionner un article et entrer une quantité valide.")
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setError(null)

    const qty = Number.parseFloat(quantity)

    try {
      const { data, error: rpcError } = await supabase.rpc("add_stock_movement", {
        p_company_id: companyId,
        p_item_id: selectedItemId,
        p_movement_type: "ENTREE",
        p_quantity: qty,
        p_supplier_id: selectedSupplierId || null,
        p_notes: notes || null,
        p_unit_price: unitPrice ? Number.parseFloat(unitPrice) : null,
        p_current_sale_price: selectedItemObj?.sale_price || null,
      })

      if (rpcError) throw rpcError

      // Check if the RPC returned an error in the JSON response (custom error handling in SQL)
      if (data && data.success === false) {
        throw new Error(data.error || "Erreur lors de la mise à jour du stock")
      }

      onEntrySuccess()
      onOpenChange(false)
      setSelectedItemId("")
      setQuantity("")
      setUnitPrice("")
      setSelectedSupplierId("")
      setNotes("")
    } catch (err: any) {
      console.error("Erreur stock entry:", err)
      setError(err.message || "Une erreur est survenue.")
      isSubmittingRef.current = false // Unlock only on error to allow retry
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-primary" />
            Enregistrer une Entrée en Stock
          </DialogTitle>
          <DialogDescription>
            Ajoutez du stock pour un article existant.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 py-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ARTICLE SELECTION */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-base font-medium">Article *</Label>
              <Popover open={openItem} onOpenChange={setOpenItem}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openItem}
                    className="w-full justify-between h-11"
                  >
                    {selectedItemId
                      ? items.find((item) => item.id === selectedItemId)?.name
                      : "Rechercher un article..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher article..." />
                    <CommandList>
                      <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                      <CommandGroup>
                        {items.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.name}
                            onSelect={() => {
                              setSelectedItemId(item.id)
                              setOpenItem(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedItemId === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {item.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* QUANTITY */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">Quantité Entrante *</Label>
                <Input
                  id="quantity"
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(",", "."))}
                  placeholder="Ex: 10"
                  className="h-11 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-medium">Prix Achat Unit. (HT)</Label>
                <div className="relative">
                  <Input
                    id="unitPrice"
                    type="text"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value.replace(",", "."))}
                    placeholder="0.000"
                    className="h-11 text-lg pl-8"
                  />
                  <span className="absolute left-3 top-3 text-muted-foreground text-lg">$</span>
                </div>
              </div>
            </div>

            {/* SUPPLIER */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Fournisseur (Source)</Label>
              <Popover open={openSupplier} onOpenChange={setOpenSupplier}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSupplier}
                    className="w-full justify-between h-11"
                  >
                    {selectedSupplierId
                      ? suppliers.find((s) => s.id === selectedSupplierId)?.name
                      : "Sélectionner fournisseur..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher fournisseur..." />
                    <CommandList>
                      <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
                      <CommandGroup>
                        {suppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={supplier.name}
                            onSelect={() => {
                              setSelectedSupplierId(supplier.id)
                              setOpenSupplier(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSupplierId === supplier.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* NOTES */}
            <div className="space-y-2 md:col-span-2">
              <Label>Notes / Référence Document</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: BL N° 123456, Arrivage du matin..."
                rows={3}
              />
            </div>

          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium text-center">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="h-11 px-8">
              {isLoading ? "Enregistrement..." : (
                <>
                  Confirmer l'Entrée <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
