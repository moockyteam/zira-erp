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
import { Trash2, Save, Package, DollarSign, Users, Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// Types
export type Item = {
  id: string
  name: string
  reference: string | null
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
type Category = { id: string; name: string; parent_id: string | null }
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
  subcategory_id: null as string | null,
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
        subcategory_id: currentItem.subcategory_id || null,
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
    const { data } = await supabase.from("supplier_categories").select("id, name, parent_id").order("name")
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
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isCreateMode ? "Nouvel Article" : `Gérer : ${currentItem?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? "Configurez les informations de base de l'article. Les fournisseurs pourront être ajoutés après la création."
              : "Modifiez les détails de l'article, gérez les stocks et les fournisseurs associés."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="info">
                <Info className="h-4 w-4 mr-2" /> Informations
              </TabsTrigger>
              <TabsTrigger value="prices">
                <DollarSign className="h-4 w-4 mr-2" /> Prix & Stock
              </TabsTrigger>
              <TabsTrigger value="suppliers" disabled={isCreateMode}>
                <Users className="h-4 w-4 mr-2" /> Fournisseurs
                {isCreateMode && <span className="ml-2 text-xs opacity-50">(Sauvegarder d'abord)</span>}
              </TabsTrigger>
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
                      placeholder="Ex: Ordinateur Portable"
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
                          {categories.filter(c => !c.parent_id).map((c) => (
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
                          {formData.category_id && categories.filter(c => c.parent_id === formData.category_id).map((c) => (
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
                  <div className="space-y-2">
                    <Label>Prix d'achat par défaut (HT)</Label>
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
                  {categories.find((c) => c.id === formData.category_id)?.name === "Commerce & Distribution" && (
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
                    <Label>Unité de mesure</Label>
                    <Input
                      placeholder="ex: pièce, kg, mètre..."
                      value={formData.unit_of_measure}
                      onChange={(e) => setFormData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seuil d'alerte (Stock faible)</Label>
                    <Input
                      type="number"
                      defaultValue={formData.alert_quantity}
                      onBlur={(e) => setFormData((p) => ({ ...p, alert_quantity: e.target.value.replace(",", ".") }))}
                    />
                    <p className="text-xs text-muted-foreground">Vous serez notifié si le stock descend sous cette valeur.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: SUPPLIERS */}
            <TabsContent value="suppliers" className="space-y-4">
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Fournisseurs référencés pour cet article</h4>
                  <div className="w-[300px]">
                    <Select onValueChange={addSupplierLink} value="">
                      <SelectTrigger>
                        <SelectValue placeholder="+ Associer un fournisseur" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-md divide-y">
                  {itemSuppliers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Aucun fournisseur associé. Ajoutez-en un pour gérer les prix d'achat spécifiques.
                    </div>
                  ) : itemSuppliers.map((is) => (
                    <div key={is.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                      <div className="col-span-4 font-medium flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {is.suppliers.name.substring(0, 2).toUpperCase()}
                        </div>
                        {is.suppliers.name}
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs text-muted-foreground">Prix Achat</Label>
                        <Input
                          className="h-8 mt-1"
                          placeholder="Prix..."
                          defaultValue={is.last_purchase_price || ""}
                          onBlur={(e) => updateItemSupplier(is.id, e.target.value.replace(",", "."), is.supplier_item_reference || "")}
                        />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs text-muted-foreground">Réf. chez fournisseur</Label>
                        <Input
                          className="h-8 mt-1"
                          placeholder="Réf..."
                          defaultValue={is.supplier_item_reference || ""}
                          onBlur={(e) => updateItemSupplier(is.id, is.last_purchase_price?.toString() || "", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeSupplierLink(is.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
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
