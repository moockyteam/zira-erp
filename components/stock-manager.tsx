"use client"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertTriangle,
  ShoppingCart,
  ChevronsUpDown,
  FileDown,
  MoreVertical,
  Edit,
  SlidersHorizontal,
  ArrowDownToLine,
} from "lucide-react"
import { CompanySelector } from "@/components/company-selector"
import { ManageItemDialog, type Item } from "./manage-item-dialog"
import { ReorderDialog } from "./reorder-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StockImportDialog } from "./stock-import-dialog"
import { StockEntryDialog } from "./stock-entry-dialog"
import { QuickAdjustDialog } from "./quick-adjust-dialog"
import { StockEmptyState } from "./stock-empty-state"

type Category = { id: string; name: string }
type Supplier = { id: string; name: string }

export function StockManager({ userCompanies }: { userCompanies: { id: string; name: string }[] }) {
  const supabase = createClient()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [itemToManage, setItemToManage] = useState<Item | null>(null)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [itemToReorder, setItemToReorder] = useState<Item | null>(null)
  const [itemToAdjust, setItemToAdjust] = useState<Item | null>(null)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [itemToEntry, setItemToEntry] = useState<Item | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState("all")

  useEffect(() => {
    if (userCompanies && userCompanies.length === 1) setSelectedCompanyId(userCompanies[0].id)
  }, [userCompanies])

  useEffect(() => {
    if (selectedCompanyId) fetchCompanyData(selectedCompanyId)
    else {
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
        .select("*, item_categories(name)")
        .eq("company_id", companyId)
        .eq("is_archived", false)
        .order("name"),
      supabase.from("item_categories").select("*").eq("company_id", companyId).order("name"),
      supabase.from("suppliers").select("*").eq("company_id", companyId).order("name"),
    ])
    if (itemsRes.data) setItems(itemsRes.data as any)
    if (catRes.data) setCategories(catRes.data)
    if (supRes.data) setSuppliers(supRes.data)
    setIsLoading(false)
  }

  const handleOpenManageDialog = (item: Item | null) => {
    setItemToManage(item)
    setIsManageOpen(true)
  }

  const filteredItems = useMemo(() => {
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.reference?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .filter((i) => filterCategoryId === "all" || i.category_id === filterCategoryId)
  }, [items, searchTerm, filterCategoryId])

  const stats = useMemo(() => {
    const stockValue = items.reduce((sum, i) => sum + i.quantity_on_hand * (i.default_purchase_price || 0), 0)
    const lowStockItems = items.filter((i) => i.quantity_on_hand <= i.alert_quantity).length
    return { stockValue, lowStockItems }
  }, [items])

  return (
    <div className="space-y-8">
      <CompanySelector
        companies={userCompanies}
        selectedCompanyId={selectedCompanyId}
        onCompanySelect={setSelectedCompanyId}
      />
      {selectedCompanyId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Valeur du Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.stockValue.toFixed(2)} TND</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Articles Uniques</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{items.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alertes Stock Faible</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{stats.lowStockItems}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Inventaire Actuel</CardTitle>
                <CardDescription>Liste de tous les articles en stock.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setItemToEntry(null)
                    setIsEntryOpen(true)
                  }}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Entrée de Stock
                </Button>
                <Button onClick={() => handleOpenManageDialog(null)}>Ajouter un article</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <ChevronsUpDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <StockImportDialog
                        companyId={selectedCompanyId}
                        onImportSuccess={() => fetchCompanyData(selectedCompanyId)}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileDown className="h-4 w-4 mr-2" />
                      Exporter vers Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <StockEmptyState onAddItemClick={() => handleOpenManageDialog(null)} />
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <Input
                      placeholder="Rechercher par nom/référence..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                    <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
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
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Prix Vente</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const isLowStock = item.quantity_on_hand <= item.alert_quantity && item.alert_quantity > 0
                        return (
                          <TableRow key={item.id} className={isLowStock ? "bg-red-50 dark:bg-red-950/20" : ""}>
                            <TableCell className="font-medium flex items-center gap-2">
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {isLowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Stock faible</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {item.name}
                            </TableCell>
                            <TableCell>{item.reference}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.quantity_on_hand} {item.unit_of_measure}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.sale_price ? `${item.sale_price.toFixed(2)} TND` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isLowStock ? (
                                  <Button variant="destructive" size="sm" onClick={() => setItemToReorder(item)}>
                                    Commander
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setItemToEntry(item)
                                      setIsEntryOpen(true)
                                    }}
                                  >
                                    <ArrowDownToLine className="h-4 w-4 mr-2" /> Entrée
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenManageDialog(item)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Gérer / Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setItemToAdjust(item)}>
                                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                                      Ajuster la quantité
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {!isLowStock && (
                                      <DropdownMenuItem onClick={() => setItemToReorder(item)}>
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Créer une commande
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
    </div>
  )
}
