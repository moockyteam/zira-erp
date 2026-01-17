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
import { AddCategoryDialog } from "./add-category-dialog"
import { AddSupplierDialog } from "./add-supplier-dialog"
import { Trash2, Save, Package, Factory, Link as LinkIcon, Layers, ShoppingCart, Users } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { BomManager, PendingBomItem } from "./bom-manager"

// Types
export type ItemType = 'product' | 'raw_material' | 'semi_finished' | 'consumable' | 'asset'

export type Item = {
  id: string
  name: string
  reference: string | null
  type: ItemType
  consumption_unit: string | null
  category_id: string | null
  subcategory_id: string | null
  quantity_on_hand: number
  unit_of_measure: string | null
  default_purchase_price: number | null
  sale_price: number | null
  description: string | null
  alert_quantity: number
  is_archived: boolean
}

type Category = { id: string; name: string; parent_id: string | null; applicable_item_types?: string[] | null; company_id: string | null }
type Supplier = { id: string; name: string }
type ItemSupplier = {
  id: string
  item_id: string
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
  type: "product" as ItemType,
  consumption_unit: "",
  description: "",
  category_id: null as string | null,
  subcategory_id: null as string | null,
  unit_of_measure: "",
  default_purchase_price: "",
  sale_price: "",
  alert_quantity: "0",
  initial_quantity: "",
  is_manufactured: false,
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
  const [pendingSuppliers, setPendingSuppliers] = useState<ItemSupplier[]>([])
  const [pendingBom, setPendingBom] = useState<PendingBomItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const isCreateMode = !currentItem?.id
  const isRawMaterial = formData.type === 'raw_material'
  const isManufactured = (formData.type === 'product' && formData.is_manufactured) || formData.type === 'semi_finished'

  // Sync prop with internal state - reset on dialog open to handle stale state
  useEffect(() => {
    if (isOpen) {
      setCurrentItem(initialItem)
    }
  }, [isOpen, initialItem])

  useEffect(() => {
    if (isOpen && companyId) {
      fetchCategories()
    }
    if (currentItem?.id) {
      setFormData({
        name: currentItem.name || "",
        reference: currentItem.reference || "",
        type: currentItem.type || "product",
        consumption_unit: currentItem.consumption_unit || "",
        description: currentItem.description || "",
        category_id: currentItem.category_id,
        subcategory_id: currentItem.subcategory_id || null,
        unit_of_measure: currentItem.unit_of_measure || "",
        default_purchase_price: currentItem.default_purchase_price?.toString() || "",
        sale_price: currentItem.sale_price?.toString() || "",
        alert_quantity: currentItem.alert_quantity?.toString() || "0",
        initial_quantity: "",
        is_manufactured: currentItem.type === 'product' || currentItem.type === 'semi_finished',
      })
    } else {
      setFormData(initialFormData)
      setPendingBom([])
      setPendingSuppliers([])
    }
  }, [isOpen, currentItem, companyId])

  useEffect(() => {
    if (isOpen && companyId) {
      fetchSuppliers()
      if (currentItem?.id) {
        fetchItemSuppliers(currentItem.id)
      }
    }
  }, [isOpen, companyId, currentItem?.id])

  const fetchCategories = async () => {
    const { data } = await supabase.from("supplier_categories").select("id, name, parent_id, applicable_item_types, company_id").order("name")
    if (data) {
      const typedData = data as unknown as Category[]
      const uniqueCategories = Object.values(
        typedData.reduce((acc, cat) => {
          if (!acc[cat.name]) {
            acc[cat.name] = cat
          } else if (cat.company_id === companyId) {
            acc[cat.name] = cat
          }
          return acc
        }, {} as Record<string, Category>)
      )
      uniqueCategories.sort((a, b) => a.name.localeCompare(b.name))
      setCategories(uniqueCategories)
    }
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
    const currentList = isCreateMode ? pendingSuppliers : itemSuppliers
    const linkedSupplierIds = new Set(currentList.map((is) => is.supplier_id))
    return suppliers.filter((s) => !linkedSupplierIds.has(s.id))
  }, [suppliers, itemSuppliers, pendingSuppliers, isCreateMode])

  const addSupplierLink = (supplierId: string, newSupplier?: Supplier) => {
    const supplierObj = newSupplier || suppliers.find(s => s.id === supplierId)
    if (!supplierObj) return

    const newLink: ItemSupplier = {
      id: `pending-${Date.now()}`,
      item_id: currentItem?.id || "",
      supplier_id: supplierId,
      last_purchase_price: null,
      supplier_item_reference: null,
      suppliers: { name: supplierObj.name }
    }

    if (isCreateMode) {
      setPendingSuppliers([...pendingSuppliers, newLink])
    } else if (currentItem?.id) {
      supabase.from("item_suppliers").insert({ item_id: currentItem.id, supplier_id: supplierId }).then(({ error }) => {
        if (error) toast.error(error.message)
        else fetchItemSuppliers(currentItem.id)
      })
    }
  }

  const removeSupplierLink = (linkId: string) => {
    if (isCreateMode) {
      setPendingSuppliers(pendingSuppliers.filter(s => s.id !== linkId))
    } else {
      supabase.from("item_suppliers").delete().eq("id", linkId).then(({ error }) => {
        if (error) toast.error(error.message)
        else if (currentItem?.id) fetchItemSuppliers(currentItem.id)
      })
    }
  }

  const updateItemSupplier = async (linkId: string, price: string, ref: string) => {
    if (isCreateMode) {
      setPendingSuppliers(pendingSuppliers.map(s =>
        s.id === linkId ? { ...s, last_purchase_price: parseFloat(price) || null, supplier_item_reference: ref || null } : s
      ))
    } else {
      await supabase.from("item_suppliers").update({
        last_purchase_price: parseFloat(price.replace(",", ".")) || null,
        supplier_item_reference: ref || null
      }).eq("id", linkId)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    // Exclude UI-only fields from database save
    const { initial_quantity, is_manufactured, ...formDataWithoutUiFields } = formData

    const dataToSave = {
      ...formDataWithoutUiFields,
      company_id: companyId,
      default_purchase_price: Number.parseFloat(formData.default_purchase_price.replace(",", ".")) || null,
      sale_price: Number.parseFloat(formData.sale_price.replace(",", ".")) || null,
      alert_quantity: Number.parseInt(formData.alert_quantity) || 0,
    }

    if (currentItem?.id) {
      // UPDATE
      const { error } = await supabase.from("items").update(dataToSave).eq("id", currentItem.id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Article modifié")
        onSuccess()
      }
    } else {
      // CREATE
      const { data: newItem, error } = await supabase.from("items").insert(dataToSave).select().single()
      if (error) {
        toast.error(error.message)
      } else {
        // Handle initial stock if provided - works for all item types
        const initialQty = Number.parseFloat(initial_quantity.replace(",", ".")) || 0
        if (initialQty > 0) {
          const { error: stockError } = await supabase.rpc("add_stock_movement", {
            p_company_id: companyId,
            p_item_id: newItem.id,
            p_movement_type: 'ENTREE',
            p_quantity: initialQty,
            p_notes: 'Stock initial',
            p_unit_price: Number.parseFloat(formData.default_purchase_price.replace(",", ".")) || null,
            p_current_sale_price: Number.parseFloat(formData.sale_price.replace(",", ".")) || null,
          })
          if (stockError) {
            console.error("Erreur ajout stock initial:", stockError)
            toast.warning("Article créé mais erreur lors de l'ajout du stock initial.")
          } else {
            toast.success(`Article créé avec ${initialQty} unités en stock.`)
          }
        }

        // Save pending BOM if any
        if (pendingBom.length > 0) {
          const bomToInsert = pendingBom.map(b => ({
            parent_item_id: newItem.id,
            child_item_id: b.child_item_id,
            quantity: b.quantity
          }))
          const { error: bomError } = await supabase.from('bill_of_materials').insert(bomToInsert)
          if (bomError) {
            console.error("Erreur sauvegarde recette:", bomError)
            toast.warning("Article créé, mais erreur lors de l'enregistrement de la recette.")
          } else {
            toast.success(`Recette enregistrée avec ${pendingBom.length} ingrédient(s).`)
          }
        }

        setCurrentItem(newItem as Item)
        onSuccess()
        onOpenChange(false)
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
        toast.success("Article archivé")
        onSuccess()
        onOpenChange(false)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-none sm:max-w-[90vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6" />
            {isCreateMode ? "Nouvel Article" : `Modifier: ${currentItem?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode ? "Créer un nouvel article dans votre inventaire" : "Modifier les informations de l'article"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-8">
          {/* TYPE SELECTION (only in create mode) */}
          {isCreateMode && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Type d'article</Label>
              <RadioGroup
                value={
                  formData.type === 'product' && formData.is_manufactured ? 'product_manufacturing' :
                    formData.type === 'product' && !formData.is_manufactured ? 'product_trading' :
                      formData.type
                }
                className="grid grid-cols-2 md:grid-cols-5 gap-2"
              >
                {/* Marchandise */}
                <label className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                  formData.type === 'product' && !formData.is_manufactured && "border-green-500 bg-green-50"
                )}
                  onClick={() => setFormData(p => ({ ...p, type: 'product', is_manufactured: false }))}
                >
                  <RadioGroupItem value="product_trading" id="t-marc" className="sr-only" />
                  <ShoppingCart className={cn("h-6 w-6 mb-2", formData.type === 'product' && !formData.is_manufactured ? "text-green-600" : "text-muted-foreground")} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Marchandise</div>
                    <div className="text-[10px] text-muted-foreground">Achat/Vente</div>
                  </div>
                </label>

                {/* Produit Fini */}
                <label className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                  formData.type === 'product' && formData.is_manufactured && "border-purple-500 bg-purple-50"
                )}
                  onClick={() => setFormData(p => ({ ...p, type: 'product', is_manufactured: true }))}
                >
                  <RadioGroupItem value="product_manufacturing" id="t-prod" className="sr-only" />
                  <Factory className={cn("h-6 w-6 mb-2", formData.type === 'product' && formData.is_manufactured ? "text-purple-600" : "text-muted-foreground")} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Produit Fini</div>
                    <div className="text-[10px] text-muted-foreground">Fabriqué</div>
                  </div>
                </label>

                {/* Matière Première */}
                <label className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                  formData.type === 'raw_material' && "border-amber-500 bg-amber-50"
                )}
                  onClick={() => setFormData(p => ({ ...p, type: 'raw_material' }))}
                >
                  <RadioGroupItem value="raw_material" id="t-mp" className="sr-only" />
                  <Layers className={cn("h-6 w-6 mb-2", formData.type === 'raw_material' ? "text-amber-600" : "text-muted-foreground")} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Matière Première</div>
                    <div className="text-[10px] text-muted-foreground">Composant</div>
                  </div>
                </label>

                {/* Semi-Fini */}
                <label className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                  formData.type === 'semi_finished' && "border-indigo-500 bg-indigo-50"
                )}
                  onClick={() => setFormData(p => ({ ...p, type: 'semi_finished' }))}
                >
                  <RadioGroupItem value="semi_finished" id="t-sf" className="sr-only" />
                  <LinkIcon className={cn("h-6 w-6 mb-2", formData.type === 'semi_finished' ? "text-indigo-600" : "text-muted-foreground")} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Semi-Fini</div>
                    <div className="text-[10px] text-muted-foreground">Intermédiaire</div>
                  </div>
                </label>

                {/* Consommable */}
                <label className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                  formData.type === 'consumable' && "border-slate-500 bg-slate-50"
                )}
                  onClick={() => setFormData(p => ({ ...p, type: 'consumable' }))}
                >
                  <RadioGroupItem value="consumable" id="t-cons" className="sr-only" />
                  <Package className={cn("h-6 w-6 mb-2", formData.type === 'consumable' ? "text-slate-600" : "text-muted-foreground")} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Consommable</div>
                    <div className="text-[10px] text-muted-foreground">Usage Interne</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* BASIC INFO */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nom de l'article *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder={isRawMaterial ? "Ex: Tissu Coton Blanc" : "Ex: Ordinateur Portable"}
                  className="h-11"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Référence (SKU)</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData((p) => ({ ...p, reference: e.target.value }))}
                  placeholder="Ex: REF-001"
                  className="h-11"
                />
              </div>
            </div>

            {/* Category Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-lg bg-muted/20">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase">Catégorie</Label>
                  <AddCategoryDialog
                    companyId={companyId}
                    parentCategories={categories.filter(c => !c.parent_id)}
                    onCategoryAdded={fetchCategories}
                  />
                </div>
                <Select
                  value={formData.category_id || ""}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v, subcategory_id: null }))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choisir une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(c => !c.parent_id)
                      .filter(c => !c.applicable_item_types || c.applicable_item_types.includes(formData.type))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Sous-catégorie</Label>
                <Select
                  value={formData.subcategory_id || ""}
                  onValueChange={(v) => setFormData((p) => ({ ...p, subcategory_id: v }))}
                  disabled={!formData.category_id}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choisir une sous-catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.category_id && categories
                      .filter(c => c.parent_id === formData.category_id)
                      .filter(c => !c.applicable_item_types || c.applicable_item_types.includes(formData.type))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Simple fields row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Unité de Mesure</Label>
                <Input
                  placeholder="ex: pièce, kg, mètre..."
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                />
              </div>

              {isRawMaterial && (
                <div className="space-y-2">
                  <Label>Unité de Consommation</Label>
                  <Input
                    placeholder="ex: grammes, ml..."
                    value={formData.consumption_unit}
                    onChange={(e) => setFormData((p) => ({ ...p, consumption_unit: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Seuil d'Alerte Stock</Label>
                <Input
                  type="number"
                  value={formData.alert_quantity}
                  onChange={(e) => setFormData((p) => ({ ...p, alert_quantity: e.target.value }))}
                  placeholder="0"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Selling Price for Merchandise and Finished Product */}
            {(formData.type === 'product') && (
              <div className="space-y-2 p-4 border rounded-lg bg-emerald-50/50 border-emerald-100">
                <Label className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-600" />
                  Prix de vente global (TND)
                </Label>
                <Input
                  type="text"
                  value={formData.sale_price}
                  onChange={(e) => setFormData((p) => ({ ...p, sale_price: e.target.value.replace(",", ".") }))}
                  placeholder="Ex: 49.990"
                  className="h-11 text-lg max-w-xs font-mono"
                />
                <p className="text-xs text-muted-foreground">Prix de base utilisé pour les ventes</p>
              </div>
            )}

            {/* Initial quantity for all item types in creation mode */}
            {isCreateMode && (
              <div className="space-y-2 p-4 border rounded-lg bg-blue-50/50 border-blue-100">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Quantité initiale en stock (optionnel)
                </Label>
                <Input
                  type="text"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData((p) => ({ ...p, initial_quantity: e.target.value.replace(",", ".") }))}
                  placeholder="Ex: 100"
                  className="h-11 text-lg max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.type === 'raw_material' ? "Stock de matière première disponible" :
                    formData.type === 'semi_finished' ? "Stock de semi-fini existant" :
                      formData.type === 'consumable' ? "Stock de consommables" :
                        formData.is_manufactured ? "Stock de produit fini déjà fabriqué" :
                          "Stock de marchandise à enregistrer"}
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description (optionnel)</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Détails techniques, notes..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* RECIPE SECTION (only for Produit Fini / Semi-Fini) */}
          {isManufactured && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold">Composition / Recette</h3>
                </div>
                <BomManager
                  parentItemId={currentItem?.id}
                  companyId={companyId}
                  isCreateMode={isCreateMode}
                  pendingItems={pendingBom}
                  onPendingChange={setPendingBom}
                />
              </div>
            </>
          )}

          {/* SUPPLIERS SECTION */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Fournisseurs</h3>
              </div>
              <div className="flex gap-2">
                <Select onValueChange={addSupplierLink} value="">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="+ Ajouter fournisseur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AddSupplierDialog
                  companyId={companyId}
                  onSupplierAdded={(newSupplier) => {
                    fetchSuppliers()
                    addSupplierLink(newSupplier.id, newSupplier)
                  }}
                />
              </div>
            </div>
            <div className="border rounded-md divide-y">
              {(isCreateMode ? pendingSuppliers : itemSuppliers).length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  Aucun fournisseur associé à cet article.
                </div>
              ) : (isCreateMode ? pendingSuppliers : itemSuppliers).map((is) => (
                <div key={is.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-4 font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 opacity-50" /> {is.suppliers.name}
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-muted-foreground">Prix Achat</Label>
                    <Input
                      className="h-8 text-sm"
                      defaultValue={is.last_purchase_price || ""}
                      onBlur={(e) => updateItemSupplier(is.id, e.target.value.replace(",", "."), is.supplier_item_reference || "")}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground">Réf. Fournisseur</Label>
                    <Input
                      className="h-8 text-sm"
                      defaultValue={is.supplier_item_reference || ""}
                      onBlur={(e) => updateItemSupplier(is.id, is.last_purchase_price?.toString() || "", e.target.value)}
                      placeholder="REF-XXX"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeSupplierLink(is.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            <Button onClick={handleSave} disabled={isSaving || !formData.name}>
              <Save className="h-4 w-4 mr-2" />
              {isCreateMode ? "Créer" : "Sauvegarder"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
