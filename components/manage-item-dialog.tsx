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
import { Trash2, Save, Package, DollarSign, Users, Info, Factory, Link as LinkIcon, Layers } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
// Import BOM Manager
import { BomManager } from "./bom-manager"

// Types
export type ItemType = 'product' | 'raw_material' | 'semi_finished' | 'consumable' | 'asset'

export type Item = {
  id: string
  name: string
  reference: string | null
  type: ItemType // New field
  consumption_unit: string | null // New field
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
  initial_quantity: "", // NEW: For initial stock when creating
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
  const [pendingSuppliers, setPendingSuppliers] = useState<ItemSupplier[]>([]) // Local state for creation mode
  const [isSaving, setIsSaving] = useState(false)

  const isCreateMode = !currentItem?.id

  // Synchroniser la prop 'initialItem' avec l'état interne
  useEffect(() => {
    setCurrentItem(initialItem)
  }, [initialItem])

  useEffect(() => {
    if (isOpen && companyId) {
      fetchInitialData()
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
        initial_quantity: "", // Not applicable for existing items
      })
      fetchItemSuppliers(currentItem.id)
    } else {
      setFormData(initialFormData)
      setItemSuppliers([])
      setPendingSuppliers([])
    }
  }, [isOpen, currentItem, companyId])

  const fetchInitialData = async () => {
    await Promise.all([fetchCategories(), fetchSuppliers()])
  }
  // Fetch Categories including applicable logic
  const fetchCategories = async () => {
    const { data } = await supabase.from("supplier_categories").select("id, name, parent_id, applicable_item_types, company_id").order("name")
    if (data) {
      // De-duplicate categories by name
      // Preference: Specific Company > Global (null)
      const typedData = data as unknown as Category[]
      const uniqueCategories = Object.values(
        typedData.reduce((acc, cat) => {
          if (!acc[cat.name]) {
            acc[cat.name] = cat;
          } else {
            // If we already have one, check if the new one is "better" (i.e., matches companyId specifically)
            if (cat.company_id === companyId) {
              acc[cat.name] = cat;
            }
          }
          return acc;
        }, {} as Record<string, Category>)
      )
      // Sort again by name just in case
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
    // Combine DB suppliers (edit mode) and Pending suppliers (create mode)
    const currentList = isCreateMode ? pendingSuppliers : itemSuppliers
    const linkedSupplierIds = new Set(currentList.map((is) => is.supplier_id))
    return suppliers.filter((s) => !linkedSupplierIds.has(s.id))
  }, [suppliers, itemSuppliers, pendingSuppliers, isCreateMode])

  const handleSave = async () => {
    setIsSaving(true)

    // Exclude initial_quantity from database save (it's not a column)
    const { initial_quantity, ...formDataWithoutInitialQty } = formData

    const dataToSave = {
      ...formDataWithoutInitialQty,
      company_id: companyId,
      default_purchase_price: Number.parseFloat(formData.default_purchase_price.replace(",", ".")) || null,
      sale_price: Number.parseFloat(formData.sale_price.replace(",", ".")) || null,
      alert_quantity: Number.parseInt(formData.alert_quantity.replace(",", ".")) || 0,
    }

    if (currentItem?.id) {
      const { error } = await supabase.from("items").update(dataToSave).eq("id", currentItem.id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Article mis à jour.")
        onSuccess()
        onOpenChange(false)
      }
    } else {
      const payload = { ...dataToSave, is_archived: false }
      const { data: newItem, error } = await supabase.from("items").insert(payload).select().single()
      if (error) {
        toast.error(error.message)
      } else {
        // Save pending suppliers if any
        if (pendingSuppliers.length > 0) {
          const suppliersToInsert = pendingSuppliers.map(p => ({
            item_id: newItem.id,
            supplier_id: p.supplier_id,
            last_purchase_price: p.last_purchase_price,
            supplier_item_reference: p.supplier_item_reference
          }));
          const { error: suppError } = await supabase.from('item_suppliers').insert(suppliersToInsert);
          if (suppError) {
            console.error("Erreur sauvegarde fournisseurs:", suppError);
            toast.warning("Article créé, mais erreur lors de l'association des fournisseurs.");
          } else {
            toast.success(`Article créé avec ${pendingSuppliers.length} fournisseur(s) associé(s).`);
          }
        } else {
          toast.success("Article créé.");
        }

        // Check if we need to add initial stock for Marchandise
        const initialQty = Number.parseFloat(initial_quantity.replace(",", ".")) || 0
        if (initialQty > 0 && formData.type === 'product') {
          // Add stock movement
          const { error: stockError } = await supabase.rpc("add_stock_movement", {
            p_company_id: companyId,
            p_item_id: newItem.id,
            p_movement_type: "ENTREE",
            p_quantity: initialQty,
            p_supplier_id: null,
            p_notes: "Stock initial",
            p_unit_price: Number.parseFloat(formData.default_purchase_price.replace(",", ".")) || null,
            p_current_sale_price: Number.parseFloat(formData.sale_price.replace(",", ".")) || null,
          })
          if (stockError) {
            console.error("Erreur ajout stock initial:", stockError)
            toast.warning("Article créé mais erreur lors de l'ajout du stock initial.")
          } else {
            toast.success(`Article créé avec ${initialQty} unités en stock.`)
          }
        } else {
          toast.success("Article créé.")
        }
        setCurrentItem(newItem as Item)
        onSuccess()
        onOpenChange(false) // Close dialog after creation for Marchandise
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

  const addSupplierLink = async (supplierId: string, directSupplier?: Supplier) => {
    if ((!currentItem?.id && !isCreateMode) || !supplierId) return

    if (isCreateMode) {
      // Use directSupplier if provided (freshly created), otherwise look in state
      const supplier = directSupplier || suppliers.find(s => s.id === supplierId)

      const newPending: ItemSupplier = {
        id: `temp-${Date.now()}`,
        item_id: '',
        supplier_id: supplierId,
        last_purchase_price: null,
        supplier_item_reference: null,
        suppliers: { name: supplier?.name || 'chargement...' }
      }
      setPendingSuppliers([...pendingSuppliers, newPending])
      toast.success("Fournisseur ajouté (en attente de sauvegarde)")
      return
    }

    const { error } = await supabase.from("item_suppliers").insert({ item_id: currentItem?.id, supplier_id: supplierId })
    if (error) toast.error("Une erreur est survenue.")
    else {
      toast.success("Fournisseur associé.")
      if (currentItem?.id) fetchItemSuppliers(currentItem.id)
    }
  }

  const removeSupplierLink = async (linkId: string) => {
    if (linkId.startsWith('temp-')) {
      setPendingSuppliers(pendingSuppliers.filter(p => p.id !== linkId))
      return
    }

    const { error } = await supabase.from("item_suppliers").delete().eq("id", linkId)
    if (error) toast.error(error.message)
    else {
      toast.success("Association supprimée.")
      if (currentItem?.id) fetchItemSuppliers(currentItem.id)
    }
  }

  const updateItemSupplier = async (linkId: string, price: string, reference: string) => {
    if (linkId.startsWith('temp-')) {
      setPendingSuppliers(pendingSuppliers.map(p => p.id === linkId ? {
        ...p,
        last_purchase_price: Number.parseFloat(price.replace(",", ".")) || null,
        supplier_item_reference: reference
      } : p))
      return
    }

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

  // --- Helpers for Type Logic ---
  // Composition/Recette only for semi_finished (NOT for product/Marchandise)
  const isManufactured = formData.type === 'semi_finished'
  const isRawMaterial = formData.type === 'raw_material'
  const isAsset = formData.type === 'asset'
  // ------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isCreateMode ? "Nouvel Article" : `Gérer : ${currentItem?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? "Définissez d'abord le type d'article (Marchandise, MP, etc.)"
              : `Type actuel : ${currentItem?.type === 'raw_material' ? 'Matière Première' :
                currentItem?.type === 'semi_finished' ? 'Produit Semi-Fini' :
                  currentItem?.type === 'asset' ? 'Immobilisation' :
                    currentItem?.type === 'consumable' ? 'Consommable' : 'Marchandise'
              }`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* TYPE SELECTION (Only in Create Mode for simplicity, or if type is missing) */}
          {(isCreateMode || !formData.type) && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/20">
              <Label className="mb-3 block text-sm font-medium">Quel type d'article créez-vous ?</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(val: ItemType) => setFormData(p => ({ ...p, type: val }))}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <label className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all", formData.type === 'product' && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="product" id="t-product" className="sr-only" />
                  <Package className="h-6 w-6 mb-2 text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Marchandise</div>
                    <div className="text-[10px] text-muted-foreground">Achat & Vente standard</div>
                  </div>
                </label>

                <label className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all", formData.type === 'raw_material' && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="raw_material" id="t-raw" className="sr-only" />
                  <Layers className="h-6 w-6 mb-2 text-amber-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Matière Première</div>
                    <div className="text-[10px] text-muted-foreground">Achat & Transformation</div>
                  </div>
                </label>

                <label className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all", formData.type === 'semi_finished' && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="semi_finished" id="t-semi" className="sr-only" />
                  <Factory className="h-6 w-6 mb-2 text-purple-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Semi-Fini</div>
                    <div className="text-[10px] text-muted-foreground">Fabriqué & Consommé</div>
                  </div>
                </label>

                {/* Plus discret pour Consommable/Asset si besoin, ajoutons-les en simple dropdown ou bouton toggle ?
                      Pour l'instant on garde les 3 principaux en evidence. */}
              </RadioGroup>
              <div className="mt-2 flex gap-4 justify-center">
                <div className="flex items-center space-x-2">
                  <RadioGroup value={formData.type} onValueChange={(val: ItemType) => setFormData(p => ({ ...p, type: val }))} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="consumable" id="t-cons" />
                      <Label htmlFor="t-cons" className="text-xs text-muted-foreground">Consommable</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="asset" id="t-asset" />
                      <Label htmlFor="t-asset" className="text-xs text-muted-foreground">Immobilisation</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 mb-4">
              <TabsTrigger value="info">
                <Info className="h-4 w-4 mr-2" /> Informations
              </TabsTrigger>
              <TabsTrigger value="prices">
                <DollarSign className="h-4 w-4 mr-2" /> Prix & Stock
              </TabsTrigger>
              <TabsTrigger value="suppliers" disabled={isManufactured}>
                <Users className="h-4 w-4 mr-2" /> Fournisseurs
              </TabsTrigger>
              {isManufactured && (
                <TabsTrigger value="composition" disabled={isCreateMode}>
                  <LinkIcon className="h-4 w-4 mr-2" /> Composition / Recette
                </TabsTrigger>
              )}
            </TabsList>

            {/* TAB 1: INFORMATIONS */}
            <TabsContent value="info" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom de l'article *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder={isRawMaterial ? "Ex: Tissu Coton Blanc" : "Ex: Ordinateur Portable"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Référence (SKU)</Label>
                    <Input
                      value={formData.reference}
                      onChange={(e) => setFormData((p) => ({ ...p, reference: e.target.value }))}
                      placeholder="Ex: REF-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Catégorisation</Label>
                    <AddCategoryDialog
                      companyId={companyId}
                      parentCategories={categories.filter(c => !c.parent_id)}
                      onCategoryAdded={fetchCategories}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase">Catégorie Principale</Label>
                      <Select
                        value={formData.category_id || ""}
                        onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v, subcategory_id: null }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Choisir une catégorie..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(c => !c.parent_id) // Parents
                            .filter(c =>
                              // Show if applicable_item_types includes current type OR if it's null (generic behavior, can be adjusted)
                              // Based on plan: "Strict filtering" -> Show only if included.
                              // If array is null, we assume it's NOT specific, so maybe we hide it if we want rigorous stock control.
                              // BUT for "Commerce & Distribution" we set it explicitly.
                              c.applicable_item_types ? c.applicable_item_types.includes(formData.type) : false
                            )
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
                            .filter(c =>
                              // Same filtering for subcategories
                              c.applicable_item_types ? c.applicable_item_types.includes(formData.type) : false
                            )
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Détails techniques, notes..."
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: PRIX & STOCK */}
            <TabsContent value="prices" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-6">

                  {/* PRIX ACHAT : Toujours pertinent (Coût matière pour MP, Coût s/t pour Semi, etc.) */}
                  <div className="space-y-2">
                    <Label>
                      {isManufactured ? "Coût de revient Estimé (Main d'œuvre incluse?)" : "Prix d'achat par défaut (HT)"}
                    </Label>
                    <div className="relative">
                      <Input
                        type="text"
                        defaultValue={formData.default_purchase_price}
                        onBlur={(e) => setFormData((p) => ({ ...p, default_purchase_price: e.target.value.replace(",", ".") }))}
                        className="pl-8"
                      />
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    </div>
                  </div>

                  {/* PRIX VENTE : Caché pour MP et Consommable */}
                  {!isRawMaterial && !isAsset && formData.type !== 'consumable' && (
                    <div className="space-y-2">
                      <Label>Prix de vente (HT)</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          defaultValue={formData.sale_price}
                          onBlur={(e) => setFormData((p) => ({ ...p, sale_price: e.target.value.replace(",", ".") }))}
                          className="pl-8"
                        />
                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Unité de Mesure (Stock)</Label>
                    <Input
                      placeholder="ex: pièce, kg, mètre..."
                      value={formData.unit_of_measure}
                      onChange={(e) => setFormData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                    />
                  </div>

                  {/* UNITE DE CONSOMMATION : Spécifique pour MP */}
                  {isRawMaterial && (
                    <div className="space-y-2">
                      <Label>Unité de Consommation (Recette)</Label>
                      <Input
                        placeholder="ex: grammes, ml..."
                        value={formData.consumption_unit || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, consumption_unit: e.target.value }))}
                      />
                      <p className="text-[10px] text-muted-foreground">Ex: Acheté en Kg, consommé en Grammes.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Seuil d'alerte (Stock faible)</Label>
                    <Input
                      type="number"
                      defaultValue={formData.alert_quantity}
                      onBlur={(e) => setFormData((p) => ({ ...p, alert_quantity: e.target.value.replace(",", ".") }))}
                    />
                  </div>

                  {/* INITIAL QUANTITY: Only for new Marchandise items */}
                  {isCreateMode && formData.type === 'product' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Quantité initiale en stock
                      </Label>
                      <Input
                        type="text"
                        value={formData.initial_quantity}
                        onChange={(e) => setFormData((p) => ({ ...p, initial_quantity: e.target.value.replace(",", ".") }))}
                        placeholder="Ex: 100 (optionnel)"
                        className="h-11 text-lg"
                      />
                      <p className="text-[10px] text-muted-foreground">Si vous avez du stock existant, saisissez la quantité ici.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: SUPPLIERS (Standard logic) */}
            <TabsContent value="suppliers" className="space-y-4">
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Fournisseurs référencés</h4>
                  <div className="w-[300px] flex gap-2">
                    <Select onValueChange={addSupplierLink} value="">
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="+ Associer..." />
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
                {/* ... (Existing supplier list logic reused) ... */}
                <div className="border rounded-md divide-y">
                  {(isCreateMode ? pendingSuppliers : itemSuppliers).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Aucun fournisseur associé.
                    </div>
                  ) : (isCreateMode ? pendingSuppliers : itemSuppliers).map((is) => (
                    <div key={is.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                      <div className="col-span-4 font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 opacity-50" /> {is.suppliers.name}
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs text-muted-foreground">Prix Achat</Label>
                        <Input className="h-7 text-xs" defaultValue={is.last_purchase_price || ""} onBlur={(e) => updateItemSupplier(is.id, e.target.value.replace(",", "."), is.supplier_item_reference || "")} />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs text-muted-foreground">Réf. Fournisseur</Label>
                        <Input className="h-7 text-xs" defaultValue={is.supplier_item_reference || ""} onBlur={(e) => updateItemSupplier(is.id, is.last_purchase_price?.toString() || "", e.target.value)} />
                      </div>
                      <div className="col-span-1 text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeSupplierLink(is.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: COMPOSITION (Machines / Recettes) */}
            {isManufactured && (
              <TabsContent value="composition">
                {/* Only works if item is saved first */}
                {!isCreateMode && currentItem?.id ? (
                  <BomManager parentItemId={currentItem.id} companyId={companyId} />
                ) : (
                  <div className="p-8 text-center border-dashed border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground mb-4">
                      Veuillez d'abord sauvegarder les informations de base de l'article pour pouvoir définir sa composition.
                    </p>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" /> Sauvegarder maintenant
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}

          </Tabs>
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
              {isCreateMode ? "Créer et Continuer" : "Sauvegarder"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
