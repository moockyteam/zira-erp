"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertTriangle,
  ShoppingCart,
  FileDown,
  MoreVertical,
  Edit,
  SlidersHorizontal,
  ArrowDownToLine,
  History as HistoryIcon,
  Trash2,
  Package,
  Layers,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  PlusCircle,
  PackagePlus,
  Plus,
  Filter, // Added for type filter
  Factory // Added for type badge
} from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { ManageItemDialog, type Item } from "./manage-item-dialog"
import { ReorderDialog } from "./reorder-dialog"
import { StockHistoryDialog } from "./stock-history-dialog"
import { StockImportDialog } from "./stock-import-dialog"
import { StockEntryDialog } from "./stock-entry-dialog"
import { ProductionDialog } from "./production-dialog"
import { QuickAdjustDialog } from "./quick-adjust-dialog"
import { StockEmptyState } from "./stock-empty-state"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { KpiCard } from "@/components/ui/kpi-card"
import { FilterToolbar } from "@/components/ui/filter-toolbar"
import { Badge } from "@/components/ui/badge" // Added for type badge

type Category = { id: string; name: string }
type Supplier = { id: string; name: string }

// Updated Item type to include 'type'
type ItemWithCategoryName = Item & {
  supplier_categories?: { name: string } | null;
  type: 'product' | 'raw_material' | 'semi_finished' | 'consumable' | 'asset';
}

type SortConfig = {
  key: keyof Item | "category_name" | "type"
  direction: "asc" | "desc"
}

export function StockManager({ userCompanies }: { userCompanies: { id: string; name: string; logo_url: string | null }[] }) {
  const supabase = createClient()
  const { selectedCompany } = useCompany()
  const selectedCompanyId = selectedCompany?.id

  const [items, setItems] = useState<ItemWithCategoryName[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog States
  const [itemToManage, setItemToManage] = useState<Item | null>(null)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [itemToReorder, setItemToReorder] = useState<Item | null>(null)
  const [itemToAdjust, setItemToAdjust] = useState<Item | null>(null)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [itemToEntry, setItemToEntry] = useState<Item | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [itemToHistory, setItemToHistory] = useState<Item | null>(null)

  const [isProduceOpen, setIsProduceOpen] = useState(false)
  const [itemToProduce, setItemToProduce] = useState<Item | null>(null)

  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState("all")
  const [filterType, setFilterType] = useState("all") // New state for type filter
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" })

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyData(selectedCompanyId)
    } else {
      setItems([])
      setCategories([])
      setSuppliers([])
      setIsLoading(false)
    }
  }, [selectedCompanyId])

  const fetchCompanyData = async (companyId: string) => {
    setIsLoading(true)
    const [itemsRes, catRes, supRes] = await Promise.all([
      supabase
        .from("items")
        .select("*, supplier_categories!items_category_id_fkey(name)") // 'type' is included by '*'
        .eq("company_id", companyId)
        .eq("is_archived", false)
        .order("name"),
      supabase.from("supplier_categories").select("*").order("name"),
      supabase.from("suppliers").select("*").eq("company_id", companyId).order("name"),
    ])

    if (itemsRes.error) {
      toast.error("Erreur chargement stock: " + itemsRes.error.message)
    }

    if (itemsRes.data) setItems(itemsRes.data as any)
    if (catRes.data) setCategories(catRes.data)
    if (supRes.data) setSuppliers(supRes.data)
    setIsLoading(false)
  }

  const handleDelete = async (item: Item) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cet article ? Cette action est irréversible.")) {
      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", item.id)

      if (error) {
        if (error.code === '23503') {
          toast.error("Impossible de supprimer cet article car il est utilisé dans des documents. Veuillez l'archiver.")
        } else {
          toast.error("Erreur lors de la suppression : " + error.message)
        }
      } else {
        toast.success("Article supprimé définitivement")
        if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
      }
    }
  }

  const handleOpenManageDialog = (item: Item | null) => {
    setItemToManage(item)
    setIsManageOpen(true)
  }

  // Filtering & Sorting
  const filteredItems = useMemo(() => {
    let result = [...items]

    // 1. Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(lowerTerm) ||
          i.reference?.toLowerCase().includes(lowerTerm)
      )
    }
    if (filterCategoryId !== "all") {
      result = result.filter((i) => i.category_id === filterCategoryId)
    }
    // New type filter
    if (filterType !== "all") {
      result = result.filter((i) => i.type === filterType)
    }

    // 2. Sort
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof ItemWithCategoryName]
      let bValue: any = b[sortConfig.key as keyof ItemWithCategoryName]

      if (sortConfig.key === "category_name") {
        // @ts-ignore - Supabase join data
        aValue = a.supplier_categories?.name || ""
        // @ts-ignore
        bValue = b.supplier_categories?.name || ""
      }

      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (aValue === null) aValue = ""
      if (bValue === null) bValue = ""

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [items, searchTerm, filterCategoryId, filterType, sortConfig]) // Added filterType to dependencies

  const requestSort = (key: keyof Item | "category_name" | "type") => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: keyof Item | "category_name" | "type") => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" />
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-2 h-3 w-3 text-primary" />
      : <ChevronDown className="ml-2 h-3 w-3 text-primary" />
  }

  const stats = useMemo(() => {
    const stockValue = items.reduce((sum, i) => sum + i.quantity_on_hand * (i.default_purchase_price || 0), 0)
    const lowStockItems = items.filter((i) => i.quantity_on_hand <= i.alert_quantity && i.alert_quantity > 0).length
    return { stockValue, lowStockItems, totalItems: items.length }
  }, [items])

  const handleExport = () => {
    const headers = ["Référence", "Nom", "Catégorie", "Quantité", "Unité", "Prix Achat", "Prix Vente", "Valeur Stock", "Seuil Alerte", "Type"] // Added Type
    const csvContent = [
      headers.join(","),
      ...filteredItems.map(item => {
        // @ts-ignore - Supabase join data
        const categoryName = item.supplier_categories?.name || ""
        return [
          `"${(item.reference || "").replace(/"/g, '""')}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${categoryName.replace(/"/g, '""')}"`,
          item.quantity_on_hand,
          item.unit_of_measure,
          item.default_purchase_price || 0,
          item.sale_price || 0,
          (item.quantity_on_hand * (item.default_purchase_price || 0)).toFixed(3),
          item.alert_quantity,
          item.type // Added type
        ].join(",")
      })
    ].join("\n")

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `inventaire_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper for Type Badges
  const getTypeBadge = (type: ItemWithCategoryName['type']) => {
    switch (type) {
      case 'raw_material': return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50"><Layers className="w-3 h-3 mr-1" /> MP</Badge>
      case 'semi_finished': return <Badge variant="outline" className="border-purple-500 text-purple-600 bg-purple-50"><Factory className="w-3 h-3 mr-1" /> SF</Badge>
      case 'asset': return <Badge variant="outline" className="border-slate-500 text-slate-600 bg-slate-50">IMMO</Badge>
      case 'consumable': return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">CONS</Badge>
      default: return <Badge variant="outline" className="border-gray-200 text-gray-600"><Package className="w-3 h-3 mr-1" /> Marchandise</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {!selectedCompanyId && (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">Aucune entreprise sélectionnée</h3>
            <p className="text-muted-foreground">Veuillez sélectionner une entreprise.</p>
          </CardContent>
        </Card>
      )}

      {selectedCompanyId && (
        <>
          <PageHeader
            title="Gestion de l'Inventaire"
            description="Suivez vos articles, valorisation de stock et mouvements en temps réel."
            icon={Package}
          >
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setItemToEntry(null)
                  setIsEntryOpen(true)
                }}
                title="Entrée Stock (F7)"
              >
                <PackagePlus className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenManageDialog(null)}
                title="Nouvel Article (N)"
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
              </Button>

              <div className="h-6 w-px bg-border mx-2" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Options">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => document.getElementById("stock-import-trigger")?.click()}>
                    <StockImportDialog
                      companyId={selectedCompanyId}
                      onImportSuccess={() => fetchCompanyData(selectedCompanyId)}
                    />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Exporter vers Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PageHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Valeur du Stock"
              value={`${stats.stockValue.toFixed(2)} TND`}
              subtitle="Prix d'achat"
              icon={ShoppingCart}
              variant="success"
            />
            <KpiCard
              title="Références"
              value={stats.totalItems}
              subtitle="Articles actifs"
              icon={Layers}
              variant="info"
            />
            <KpiCard
              title="Alertes Stock"
              value={stats.lowStockItems}
              subtitle="Articles à réapprovisionner"
              icon={AlertTriangle}
              variant={stats.lowStockItems > 0 ? "danger" : "default"}
            />
          </div>

          <FilterToolbar
            searchValue={searchTerm}
            searchPlaceholder="Rechercher un article (nom, réf)..."
            onSearchChange={setSearchTerm}
            resultCount={filteredItems.length}
            showReset={searchTerm !== "" || filterCategoryId !== "all" || filterType !== "all"}
            onReset={() => { setSearchTerm(""); setFilterCategoryId("all"); setFilterType("all"); }}
          >
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-9 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-muted-foreground" />
                  <SelectValue placeholder="Type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="product">Marchandises</SelectItem>
                <SelectItem value="raw_material">Matières Premières</SelectItem>
                <SelectItem value="semi_finished">Semi-Finis</SelectItem>
                <SelectItem value="consumable">Consommables</SelectItem>
                <SelectItem value="asset">Immobilisations</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
              <SelectTrigger className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterToolbar>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead
                    className="cursor-pointer hover:text-primary transition-colors h-11"
                    onClick={() => requestSort("name")}
                  >
                    <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Nom {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead className="h-11">
                    <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Type
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-primary transition-colors h-11"
                    onClick={() => requestSort("category_name")}
                  >
                    <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Catégorie {getSortIcon("category_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-primary transition-colors h-11"
                    onClick={() => requestSort("reference")}
                  >
                    <div className="flex items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Référence {getSortIcon("reference")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-primary transition-colors h-11 text-right"
                    onClick={() => requestSort("quantity_on_hand")}
                  >
                    <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Quantité {getSortIcon("quantity_on_hand")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:text-primary transition-colors h-11 text-right"
                    onClick={() => requestSort("sale_price")}
                  >
                    <div className="flex items-center justify-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Prix Vente {getSortIcon("sale_price")}
                    </div>
                  </TableHead>
                  <TableHead className="h-11 w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Chargement...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isLowStock = item.quantity_on_hand <= item.alert_quantity && item.alert_quantity > 0
                    return (
                      <TableRow key={item.id} className={cn("group hover:bg-muted/30 transition-colors", isLowStock && "bg-red-50 hover:bg-red-100/50 dark:bg-red-950/10 dark:hover:bg-red-950/20")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isLowStock && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600" title="Stock faible">
                                <AlertTriangle className="h-3 w-3" />
                              </div>
                            )}
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getTypeBadge(item.type || 'product')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal text-xs">
                            {item.supplier_categories?.name || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {item.reference || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={cn(isLowStock ? "text-red-600 font-bold" : "")}>
                            {item.quantity_on_hand}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{item.unit_of_measure}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.sale_price ? `${item.sale_price.toFixed(3)} TND` : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="group-hover:opacity-100 opacity-0 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenManageDialog(item)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setItemToAdjust(item)}>
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                Ajuster
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setItemToHistory(item)
                                setIsHistoryOpen(true)
                              }}>
                                <HistoryIcon className="h-4 w-4 mr-2" />
                                Historique
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(item.type === 'semi_finished' || item.type === 'product') && (
                                <DropdownMenuItem onClick={() => {
                                  setItemToProduce(item)
                                  setIsProduceOpen(true)
                                }}>
                                  <Factory className="h-4 w-4 mr-2" />
                                  Produire
                                </DropdownMenuItem>
                              )}
                              {!isLowStock && (
                                <DropdownMenuItem onClick={() => setItemToReorder(item)}>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Commander
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-[300px] text-center">
                      {searchTerm || filterCategoryId !== "all" || filterType !== "all" ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="h-10 w-10 text-muted-foreground/20" />
                          <p className="text-muted-foreground text-sm">Aucun article trouvé pour cette recherche.</p>
                          <Button variant="link" onClick={() => { setSearchTerm(""); setFilterCategoryId("all"); setFilterType("all"); }}>Réinitialiser</Button>
                        </div>
                      ) : (
                        <StockEmptyState onAddItemClick={() => handleOpenManageDialog(null)} />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Dialogs */}

      {/* Dialogs */}
      <ManageItemDialog
        item={itemToManage}
        isOpen={isManageOpen}
        onOpenChange={setIsManageOpen}
        onSuccess={() => {
          if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
        }}
        companyId={selectedCompanyId!}
      />
      <ReorderDialog
        item={itemToReorder}
        isOpen={!!itemToReorder}
        onOpenChange={(open) => !open && setItemToReorder(null)}
      />
      <QuickAdjustDialog
        item={itemToAdjust}
        isOpen={!!itemToAdjust}
        onOpenChange={(open) => !open && setItemToAdjust(null)}
        onSuccess={() => {
          if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
        }}
      />
      <StockEntryDialog
        isOpen={isEntryOpen}
        onOpenChange={(open) => {
          setIsEntryOpen(open)
          if (!open) setItemToEntry(null)
        }}
        companyId={selectedCompanyId!}
        items={items}
        selectedItem={itemToEntry}
        suppliers={suppliers}
        onEntrySuccess={() => {
          if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
        }}
      />
      <StockHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={(open) => {
          setIsHistoryOpen(open)
          if (!open) setItemToHistory(null)
        }}
        itemId={itemToHistory?.id || null}
        companyId={selectedCompanyId!}
        itemName={itemToHistory?.name || ""}
      />
      <ProductionDialog
        isOpen={isProduceOpen}
        onOpenChange={(open) => {
          setIsProduceOpen(open)
          if (!open) setItemToProduce(null)
        }}
        companyId={selectedCompanyId!}
        item={itemToProduce}
        onSuccess={() => {
          if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
        }}
      />
    </div >
  )
}
