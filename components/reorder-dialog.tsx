// components/reorder-dialog.tsx

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Item } from "./manage-item-dialog"

type ItemSupplier = { id: string; supplier_id: string; last_purchase_price: number | null; suppliers: { name: string } }

interface ReorderDialogProps {
  item: Item | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ReorderDialog({ item, isOpen, onOpenChange }: ReorderDialogProps) {
  const supabase = createClient()
  const router = useRouter()
  const [itemSuppliers, setItemSuppliers] = useState<ItemSupplier[]>([])
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (item && isOpen) {
      fetchItemSuppliers(item.id)
      // Suggérer une quantité pour atteindre le double du seuil d'alerte
      const suggestedQty = item.alert_quantity * 2 - item.quantity_on_hand
      setQuantity(suggestedQty > 0 ? Math.ceil(suggestedQty) : 1)
    }
  }, [item, isOpen])

  const fetchItemSuppliers = async (itemId: string) => {
    const { data } = await supabase.from("item_suppliers").select("*, suppliers(name)").eq("item_id", itemId)
    if (data) setItemSuppliers(data as any)
  }

  const handleCreatePO = (supplierId: string, price: number | null) => {
    if (!item) return
    // On construit l'URL avec les paramètres
    const params = new URLSearchParams({
      supplierId: supplierId,
      itemId: item.id,
      description: item.name,
      quantity: quantity.toString(),
      price: price?.toString() || "0",
    })
    // On redirige vers le formulaire de BC
    router.push(`/dashboard/purchase-orders/new?${params.toString()}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réapprovisionner l'article</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Quantité à commander</Label>
            <Input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(Number.parseInt(e.target.value.replace(",", ".")) || 1)}
            />
          </div>
          <div>
            <h4 className="font-medium mb-2">Choisir un fournisseur</h4>
            {itemSuppliers.length > 0 ? (
              <div className="space-y-2">
                {itemSuppliers.map((is) => (
                  <div key={is.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <div>
                      <p>{is.suppliers.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Dernier prix connu: {is.last_purchase_price?.toFixed(3) || "N/A"} TND
                      </p>
                    </div>
                    <Button onClick={() => handleCreatePO(is.supplier_id, is.last_purchase_price)}>Créer BC</Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4 border rounded-md">
                Aucun fournisseur associé à cet article. Veuillez en ajouter via le bouton "Gérer".
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
