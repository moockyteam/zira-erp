// components/manage-item-dialog.tsx

"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CategoryCreator } from "@/components/category-creator"
import { Trash2, Save } from "lucide-react"

// Types
export type Item = {
  id: string
  name: string
  reference: string | null
  category_id: string | null
  quantity_on_hand: number
  unit_of_measure: string | null
  default_purchase_price: number | null
  sale_price: number | null
  description: string | null
  alert_quantity: number
  is_archived: boolean
}
type Category = { id: string; name: string }
type Supplier = { id: string; name: string }
type ItemSupplier = {
  id: string
  supplier_id: string
  last_purchase_price: number | null
  supplier_item_reference: string | null
  suppliers: { name: string }
}

interface ManageItemDialogProps {
  item: Item | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  companyId: string
}

const initialFormData = {
  name: "",
  reference: "",
  description: "",
  category_id: null as string | null,
  unit_of_measure: "",
  default_purchase_price: "",
  sale_price: "",
  alert_quantity: "0",
}

export function ManageItemDialog({
  item: initialItem,
  isOpen,
  onOpenChange,
  onSuccess,
  companyId,
}: ManageItemDialogProps) {
  const supabase = createClient()
  const [currentItem, setCurrentItem] = useState<Item | null>(initialItem)
  const [formData, setFormData] = useState(initialFormData)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [itemSuppliers, setItemSuppliers] = useState<ItemSupplier[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const isCreateMode = !currentItem?.id

  // CORRECTION CRUCIALE : Synchroniser la prop 'initialItem' avec l'état interne 'currentItem'
  useEffect(() => {
    setCurrentItem(initialItem)
  }, [initialItem])

  useEffect(() => {
    if (isOpen && companyId) {
      fetchInitialData()
    }
    // La logique dépend maintenant de 'currentItem' qui est toujours à jour
    if (currentItem?.id) {
      setFormData({
        name: currentItem.name || "",
        reference: currentItem.reference || "",
        description: currentItem.description || "",
        category_id: currentItem.category_id,
        unit_of_measure: currentItem.unit_of_measure || "",
        default_purchase_price: currentItem.default_purchase_price?.toString() || "",
        sale_price: currentItem.sale_price?.toString() || "",
        alert_quantity: currentItem.alert_quantity?.toString() || "0",
      })
      fetchItemSuppliers(currentItem.id)
    } else {
      setFormData(initialFormData)
      setItemSuppliers([])
    }
  }, [isOpen, currentItem, companyId])

  const fetchInitialData = async () => {
    await Promise.all([fetchCategories(), fetchSuppliers()])
  }
  const fetchCategories = async () => {
    const { data } = await supabase.from("item_categories").select("id, name").eq("company_id", companyId).order("name")
    if (data) setCategories(data)
  }
  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId).order("name")
    if (data) setSuppliers(data)
  }
  const fetchItemSuppliers = async (itemId: string) => {
    const { data } = await supabase.from("item_suppliers").select("*, suppliers(name)").eq("item_id", itemId)
    if (data) setItemSuppliers(data as any)
  }

  const availableSuppliers = useMemo(() => {
    const linkedSupplierIds = new Set(itemSuppliers.map((is) => is.supplier_id))
    return suppliers.filter((s) => !linkedSupplierIds.has(s.id))
  }, [suppliers, itemSuppliers])

  const handleSave = async () => {
    setIsSaving(true)
    const dataToSave = {
      ...formData,
      company_id: companyId,
      default_purchase_price: Number.parseFloat(formData.default_purchase_price.replace(",", ".")) || null,
      sale_price: Number.parseFloat(formData.sale_price.replace(",", ".")) || null,
      alert_quantity: Number.parseInt(formData.alert_quantity.replace(",", ".")) || 0,
    }

    if (currentItem?.id) {
      const { error } = await supabase.from("items").update(dataToSave).eq("id", currentItem.id)
      if (error) toast.error(error.message)
      else {
        toast.success("Article mis à jour.")
        onSuccess()
        onOpenChange(false)
      }
    } else {
      const { data: newItem, error } = await supabase.from("items").insert(dataToSave).select().single()
      if (error) toast.error(error.message)
      else {
        toast.success("Article créé. Vous pouvez maintenant associer des fournisseurs.")
        setCurrentItem(newItem as Item)
        onSuccess()
      }
    }
    setIsSaving(false)
  }

  const handleArchive = async () => {
    if (!currentItem?.id) return
    if (window.confirm("Archiver cet article ?")) {
      const { error } = await supabase.from("items").update({ is_archived: true }).eq("id", currentItem.id)
      if (error) toast.error(error.message)
      else {
        toast.success("Article archivé.")
        onSuccess()
        onOpenChange(false)
      }
    }
  }

  const addSupplierLink = async (supplierId: string) => {
    if (!currentItem?.id || !supplierId) return
    const { error } = await supabase.from("item_suppliers").insert({ item_id: currentItem.id, supplier_id: supplierId })
    if (error) toast.error("Une erreur est survenue.")
    else {
      toast.success("Fournisseur associé.")
      fetchItemSuppliers(currentItem.id)
    }
  }

  const removeSupplierLink = async (linkId: string) => {
    const { error } = await supabase.from("item_suppliers").delete().eq("id", linkId)
    if (error) toast.error(error.message)
    else {
      toast.success("Association supprimée.")
      if (currentItem?.id) fetchItemSuppliers(currentItem.id)
    }
  }

  const updateItemSupplier = async (linkId: string, price: string, reference: string) => {
    const { error } = await supabase
      .from("item_suppliers")
      .update({
        last_purchase_price: Number.parseFloat(price.replace(",", ".")) || null,
        supplier_item_reference: reference,
      })
      .eq("id", linkId)
    if (error) toast.error(error.message)
    else {
      toast.success("Informations fournisseur mises à jour.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "Étape 1: Créer l'article" : `Gérer : ${currentItem?.name}`}</DialogTitle>
          {isCreateMode && (
            <DialogDescription>Après la sauvegarde, vous pourrez associer les fournisseurs.</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Référence (SKU)</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData((p) => ({ ...p, reference: e.target.value }))}
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.category_id || ""}
                    onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CategoryCreator
                    companyId={companyId}
                    onCategoryCreated={fetchCategories}
                    tableName="item_categories"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Prix d'achat par défaut (HT)</Label>
                <Input
                  type="text"
                  value={formData.default_purchase_price}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, default_purchase_price: e.target.value.replace(",", ".") }))
                  }
                />
              </div>
              <div>
                <Label>Prix de vente (HT)</Label>
                <Input
                  type="text"
                  value={formData.sale_price}
                  onChange={(e) => setFormData((p) => ({ ...p, sale_price: e.target.value.replace(",", ".") }))}
                />
              </div>
              <div>
                <Label>Unité de mesure</Label>
                <Input
                  placeholder="pièce, kg, litre..."
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                />
              </div>
              <div>
                <Label>Seuil d'alerte stock</Label>
                <Input
                  type="text"
                  value={formData.alert_quantity}
                  onChange={(e) => setFormData((p) => ({ ...p, alert_quantity: e.target.value.replace(",", ".") }))}
                />
              </div>
            </div>
          </div>

          {!isCreateMode && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Fournisseurs Associés</h3>
              <div className="space-y-3">
                {itemSuppliers.map((is) => (
                  <div key={is.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-muted rounded-md">
                    <span className="col-span-4 font-medium">{is.suppliers.name}</span>
                    <div className="col-span-3">
                      <Input
                        type="text"
                        placeholder="Prix d'achat"
                        defaultValue={is.last_purchase_price || ""}
                        onBlur={(e) =>
                          updateItemSupplier(is.id, e.target.value.replace(",", "."), is.supplier_item_reference || "")
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Réf. fournisseur"
                        defaultValue={is.supplier_item_reference || ""}
                        onBlur={(e) =>
                          updateItemSupplier(is.id, is.last_purchase_price?.toString() || "", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeSupplierLink(is.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Select onValueChange={addSupplierLink} value="">
                  <SelectTrigger>
                    <SelectValue placeholder="Associer un nouveau fournisseur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="justify-between pt-4 border-t">
          {!isCreateMode ? (
            <Button variant="destructive" onClick={handleArchive}>
              Archiver
            </Button>
          ) : (
            <div></div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isCreateMode ? "Créer et Continuer" : "Sauvegarder et Fermer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
