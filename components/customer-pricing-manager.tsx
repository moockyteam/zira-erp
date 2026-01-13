"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Check, ChevronsUpDown, X, ChevronDown, ChevronUp, Tag, Percent } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

const priceRuleSchema = z.object({
    type: z.enum(["service", "item"]),
    itemId: z.string().min(1, "Veuillez sélectionner un article"),
    specialPrice: z.coerce.number().min(0, "Le prix doit être positif"),
    specialVatRate: z.number().nullable().optional(),
    overrideVat: z.boolean().default(false),
    startDate: z.date().optional(),
    renewalDate: z.date().optional(),
})

type PendingPriceRule = {
    tempId: string
    type: 'service' | 'item'
    itemId: string
    itemName: string
    itemReference?: string
    specialPrice: number
    specialVatRate: number | null
    overrideVat: boolean
    startDate?: Date
    renewalDate?: Date
}

type CustomerItem = {
    id: string
    item_id: string | null
    service_id: string | null
    special_price: number | null
    special_vat_rate: number | null
    subscription_start_date: string | null
    subscription_renewal_date: string | null
    items?: { name: string; reference: string; sale_price: number; tva?: number }
    services?: { name: string; price: number; vat_rate?: number }
}

export function CustomerPricingManager({
    customerId,
    companyId,
    pendingRules = [],
    onPendingRulesChange,
    isCreateMode = false
}: {
    customerId?: string
    companyId: string
    pendingRules?: PendingPriceRule[]
    onPendingRulesChange?: (rules: PendingPriceRule[]) => void
    isCreateMode?: boolean
}) {
    const supabase = createClient()
    const [rules, setRules] = useState<CustomerItem[]>([])
    const [loading, setLoading] = useState(true)
    const [services, setServices] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])

    // UI Logic: Inline form state instead of Dialog
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [openCombobox, setOpenCombobox] = useState(false)

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilter, setTypeFilter] = useState<string>("all")

    // UI Helpers for selected item in Form
    const [selectedType, setSelectedType] = useState<"service" | "item">("service")
    const [selectedItemData, setSelectedItemData] = useState<any>(null)
    const [priceTTC, setPriceTTC] = useState<string>("")
    const [localVAT, setLocalVAT] = useState<number>(19)

    const form = useForm<z.infer<typeof priceRuleSchema>>({
        resolver: zodResolver(priceRuleSchema),
        defaultValues: {
            type: "service",
            itemId: "",
            specialPrice: 0,
            specialVatRate: 19,
            overrideVat: false,
        },
    })

    const itemId = form.watch("itemId")
    const overrideVat = form.watch("overrideVat")
    const specialVatRate = form.watch("specialVatRate")

    useEffect(() => {
        fetchRules()
        fetchOptions()
    }, [customerId, companyId, isCreateMode])

    useEffect(() => {
        if (!itemId) {
            setSelectedItemData(null)
            return
        }
        const found = selectedType === 'service'
            ? services.find(s => s.id === itemId)
            : items.find(i => i.id === itemId)

        setSelectedItemData(found)

        if (found) {
            const defaultVat = selectedType === 'service' ? (found.vat_rate ?? 19) : (found.tva ?? 19)

            if (!overrideVat) {
                setLocalVAT(defaultVat)
                form.setValue('specialVatRate', defaultVat)
            }

            const defPrice = found.price || found.sale_price || 0
            form.setValue("specialPrice", defPrice)

            const effectiveVat = overrideVat ? (specialVatRate ?? defaultVat) : defaultVat
            const ttc = defPrice * (1 + effectiveVat / 100)
            setPriceTTC(ttc.toFixed(3))
        }

    }, [itemId, selectedType, services, items, form])

    useEffect(() => {
        if (overrideVat && specialVatRate !== null && specialVatRate !== undefined) {
            setLocalVAT(specialVatRate)
        } else if (!overrideVat && selectedItemData) {
            const defaultVat = selectedType === 'service' ? (selectedItemData.vat_rate ?? 19) : (selectedItemData.tva ?? 19)
            setLocalVAT(defaultVat)
        }
    }, [specialVatRate, overrideVat, selectedItemData, selectedType])

    useEffect(() => {
        const currentHT = form.getValues("specialPrice")
        if (currentHT !== undefined && !isNaN(currentHT) && localVAT !== undefined) {
            const ttc = currentHT * (1 + localVAT / 100)
            setPriceTTC(ttc.toFixed(3))
        }
    }, [localVAT])

    const fetchRules = async () => {
        if (isCreateMode) {
            setLoading(false)
            return
        }
        if (!customerId) {
            setLoading(false)
            return
        }
        setLoading(true)
        const { data, error } = await supabase
            .from("customer_items")
            .select(`*, items (name, reference), services (name)`)
            .eq("customer_id", customerId)

        if (error) {
            toast.error("Impossible de charger les tarifs")
        } else {
            setRules(data)
        }
        setLoading(false)
    }

    const fetchOptions = async () => {
        try {
            const { data: sData, error: sError } = await supabase.from("services").select("id, name, price, vat_rate").eq("company_id", companyId).eq("status", "active")
            if (sError) console.error("Error fetching services:", sError)
            if (sData) setServices(sData)

            const { data: iData, error: iError } = await supabase
                .from("items")
                .select("*")
                .eq("company_id", companyId)

            if (iError) {
                console.error("Error fetching items FULL:", JSON.stringify(iError, null, 2))
                toast.error("Erreur chargement articles: " + iError.message)
            }
            if (iData) {
                const validItems = iData.filter((i: any) => i.is_archived !== true)
                setItems(validItems)
            }
        } catch (err) {
            console.error("Fetch options crash:", err)
        }
    }

    const handleHTChange = (valueStr: string) => {
        const val = parseFloat(valueStr)
        form.setValue("specialPrice", isNaN(val) ? 0 : val)

        if (!isNaN(val) && localVAT !== undefined) {
            const ttc = val * (1 + localVAT / 100)
            setPriceTTC(ttc.toFixed(3))
        } else {
            setPriceTTC("")
        }
    }

    const handleTTCChange = (valueStr: string) => {
        setPriceTTC(valueStr)
        const val = parseFloat(valueStr)
        if (!isNaN(val) && localVAT) {
            const ht = val / (1 + localVAT / 100)
            form.setValue("specialPrice", Number(ht.toFixed(3)))
        }
    }

    const onSubmit = async (values: z.infer<typeof priceRuleSchema>) => {
        if (isCreateMode) {
            // Create mode: add to pending rules
            const found = selectedType === 'service'
                ? services.find(s => s.id === values.itemId)
                : items.find(i => i.id === values.itemId)

            if (!found) {
                toast.error("Élément introuvable")
                return
            }

            const newPendingRule: PendingPriceRule = {
                tempId: `temp-${Date.now()}-${Math.random()}`,
                type: values.type,
                itemId: values.itemId,
                itemName: found.name,
                itemReference: found.reference,
                specialPrice: values.specialPrice,
                specialVatRate: values.overrideVat ? (values.specialVatRate ?? null) : null,
                overrideVat: values.overrideVat,
                startDate: values.startDate,
                renewalDate: values.renewalDate
            }

            if (onPendingRulesChange) {
                onPendingRulesChange([...pendingRules, newPendingRule])
            }

            toast.success("Tarif ajouté (sera sauvegardé à l'enregistrement du client)")
            setIsFormOpen(false)
            form.reset({
                type: selectedType,
                itemId: "",
                specialPrice: 0,
                specialVatRate: 19,
                overrideVat: false
            })
            setPriceTTC("")
            return
        }

        // Edit mode: save directly to database
        const payload: any = {
            customer_id: customerId,
            special_price: values.specialPrice,
            special_vat_rate: values.overrideVat ? values.specialVatRate : null,
            subscription_start_date: values.startDate ? format(values.startDate, "yyyy-MM-dd") : null,
            subscription_renewal_date: values.renewalDate ? format(values.renewalDate, "yyyy-MM-dd") : null,
        }

        if (values.type === "service") {
            payload.service_id = values.itemId
            payload.item_id = null
        } else {
            payload.item_id = values.itemId
            payload.service_id = null
        }

        const { error } = await supabase.from("customer_items").insert(payload)

        if (error) {
            if (error.code === '23505') toast.error("Un prix spécial existe déjà pour cet élément.")
            else toast.error("Erreur technique.")
        } else {
            toast.success("Tarif ajouté correctement")
            setIsFormOpen(false)
            form.reset({
                type: selectedType,
                itemId: "",
                specialPrice: 0,
                specialVatRate: 19,
                overrideVat: false
            })
            setPriceTTC("")
            fetchRules()
        }
    }

    const handleDelete = async (id: string) => {
        if (isCreateMode) {
            // Create mode: remove from pending rules
            if (!confirm("Retirer ce tarif ?")) return
            if (onPendingRulesChange) {
                onPendingRulesChange(pendingRules.filter(r => r.tempId !== id))
            }
            toast.success("Tarif retiré")
            return
        }

        // Edit mode: delete from database
        if (!confirm("Supprimer ce tarif ?")) return
        const { error } = await supabase.from("customer_items").delete().eq("id", id)
        if (!error) {
            setRules(rules.filter(r => r.id !== id))
            toast.success("Supprimé")
        }
    }

    const handleCancelBasicForInline = () => {
        setIsFormOpen(false)
        form.reset()
        setPriceTTC("")
    }

    // Filter Logic - Use pending rules in create mode, database rules in edit mode
    const displayRules: any[] = isCreateMode ? pendingRules : rules

    const filteredRules: any[] = useMemo(() => {
        let res = displayRules
        if (searchTerm) {
            const lowerInfo = searchTerm.toLowerCase()
            if (isCreateMode) {
                // Pending rules filtering
                res = res.filter((r: any) =>
                    r.itemName?.toLowerCase().includes(lowerInfo) ||
                    r.itemReference?.toLowerCase().includes(lowerInfo)
                )
            } else {
                // Database rules filtering  
                res = res.filter((r: any) =>
                    (r.services?.name || "").toLowerCase().includes(lowerInfo) ||
                    (r.items?.name || "").toLowerCase().includes(lowerInfo) ||
                    (r.items?.reference || "").toLowerCase().includes(lowerInfo)
                )
            }
        }
        if (typeFilter !== "all") {
            if (isCreateMode) {
                res = res.filter((r: any) => r.type === typeFilter)
            } else {
                if (typeFilter === "service") res = res.filter((r: any) => r.service_id)
                if (typeFilter === "item") res = res.filter((r: any) => r.item_id)
            }
        }
        return res
    }, [displayRules, searchTerm, typeFilter, isCreateMode])

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tarifs Spéciaux & Abonnements"
                description="Configurez ici les exceptions tarifaires pour ce client."
                icon={Tag}
            >
                {!isFormOpen && (
                    <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un tarif
                    </Button>
                )}
            </PageHeader>

            {/* Inline Form Card */}
            <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen} className="space-y-4">
                <CollapsibleContent>
                    <Card className="border-2 border-primary/10 shadow-sm bg-slate-50/50">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-medium flex items-center justify-between">
                                Nouveau Tarif Spécial
                                <Button variant="ghost" size="sm" onClick={handleCancelBasicForInline} className="h-8 w-8 p-0">
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                            <CardDescription>
                                Sélectionnez un service ou un article et définissez son prix exclusif pour ce client.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <div className="space-y-6">
                                    {/* ROW 1: Selection */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        <div className="md:col-span-3">
                                            <FormField
                                                control={form.control}
                                                name="type"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type d'élément</FormLabel>
                                                        <Select onValueChange={(val) => {
                                                            field.onChange(val)
                                                            setSelectedType(val as any)
                                                            form.setValue("itemId", "")
                                                            setPriceTTC("")
                                                        }} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="service">Service (Prestation)</SelectItem>
                                                                <SelectItem value="item">Article (Stock)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="md:col-span-9">
                                            <FormField
                                                control={form.control}
                                                name="itemId"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>{selectedType === "service" ? "Sélectionner le service" : "Sélectionner l'article"}</FormLabel>
                                                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        type="button"
                                                                        className={cn(
                                                                            "w-full justify-between",
                                                                            !field.value && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {field.value
                                                                            ? (selectedType === "service" ? services : items).find(
                                                                                (item) => item.id === field.value
                                                                            )?.name
                                                                            : "Rechercher un élément..."}
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[500px] p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Rechercher par nom ou référence..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>Aucun élément trouvé.</CommandEmpty>
                                                                        <CommandGroup heading="Articles">
                                                                            {(selectedType === "service" ? services : items).map((item) => (
                                                                                <CommandItem
                                                                                    value={item.name}
                                                                                    key={item.id}
                                                                                    onSelect={() => {
                                                                                        form.setValue("itemId", item.id)
                                                                                        setOpenCombobox(false)
                                                                                    }}
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            item.id === field.value
                                                                                                ? "opacity-100"
                                                                                                : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-medium">{item.name}</span>
                                                                                        {item.reference && <span className="text-xs text-muted-foreground">Ref: {item.reference}</span>}
                                                                                    </div>
                                                                                    <div className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                                                                                        {item.sale_price !== undefined ? item.sale_price : item.price} TND
                                                                                    </div>
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                        {selectedItemData && (
                                                            <div className="text-xs text-muted-foreground mt-1 flex gap-4 items-center pl-1">
                                                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Prix Standard: <span className="font-medium text-slate-700">{selectedItemData.sale_price !== undefined ? selectedItemData.sale_price : selectedItemData.price} TND</span></span>
                                                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> TVA Std: <span className="font-medium text-slate-700">{selectedType === 'service' ? (selectedItemData.vat_rate ?? 'N/A') : (selectedItemData.tva ?? 'N/A')}%</span></span>
                                                            </div>
                                                        )}
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* ROW 2: Pricing Configuration */}
                                    <div className="p-5 border rounded-lg bg-white space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between border-b pb-3">
                                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                <div className="p-1 bg-primary/10 rounded">
                                                    <ChevronDown className="h-4 w-4" />
                                                </div>
                                                Prix & TVA
                                            </h4>
                                            <FormField
                                                control={form.control}
                                                name="overrideVat"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center gap-3 space-y-0">
                                                        <FormLabel className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">Forcer un taux de TVA Spécial ?</FormLabel>
                                                        <FormControl>
                                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                            <FormField
                                                control={form.control}
                                                name="specialPrice"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Prix Spécial (HT)</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    step="0.001"
                                                                    className="pr-12 font-mono font-medium"
                                                                    defaultValue={field.value}
                                                                    onChange={(e) => handleHTChange(e.target.value)}
                                                                />
                                                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">TND</span>
                                                            </div>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="specialVatRate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Taux TVA</FormLabel>
                                                        <Select
                                                            disabled={!overrideVat}
                                                            value={field.value?.toString()}
                                                            onValueChange={(v) => field.onChange(Number(v))}
                                                        >
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="0">0%</SelectItem>
                                                                <SelectItem value="7">7%</SelectItem>
                                                                <SelectItem value="13">13%</SelectItem>
                                                                <SelectItem value="19">19%</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {!overrideVat && <FormMessage className="text-xs text-muted-foreground mt-1">Utilise le taux par défaut de l'article</FormMessage>}
                                                    </FormItem>
                                                )}
                                            />

                                            <FormItem>
                                                <FormLabel>Prix TTC (Estimatif)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            value={priceTTC}
                                                            onChange={(e) => handleTTCChange(e.target.value)}
                                                            step="0.001"
                                                            className="pr-12 bg-slate-50 font-mono"
                                                        />
                                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">TND</span>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        </div>
                                    </div>

                                    {/* ROW 3: Subscription (Optional) */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-muted-foreground">Paramètres de récurrence (Optionnel)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={form.control} name="startDate" render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Début du service</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full text-left font-normal pl-3", !field.value && "text-muted-foreground")}>
                                                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Choisir une date...</span>}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="renewalDate" render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Prochaine échéance / Renouvellement</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full text-left font-normal pl-3", !field.value && "text-muted-foreground")}>
                                                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Choisir une date...</span>}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Button type="button" variant="ghost" onClick={handleCancelBasicForInline}>Annuler</Button>
                                        <Button type="button" onClick={form.handleSubmit(onSubmit)} className="min-w-[150px]">Enregistrer le tarif</Button>
                                    </div>
                                </div>
                            </Form>
                        </CardContent>
                    </Card>
                </CollapsibleContent>
            </Collapsible>

            <FilterToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Rechercher par nom ou référence..."
                resultCount={filteredRules.length}
                resultLabel={filteredRules.length > 1 ? "tarifs configurés" : "tarif configuré"}
                onReset={() => { setSearchTerm(""); setTypeFilter("all"); }}
                showReset={!!searchTerm || typeFilter !== "all"}
            >
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous types</SelectItem>
                        <SelectItem value="service">Services</SelectItem>
                        <SelectItem value="item">Articles</SelectItem>
                    </SelectContent>
                </Select>
            </FilterToolbar>

            {/* List Table */}
            <Card className="border rounded-md overflow-hidden shadow-sm bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[120px] py-4">Type</TableHead>
                                <TableHead className="min-w-[250px] py-4">Désignation</TableHead>
                                <TableHead className="text-right py-4">Prix Spécial (HT)</TableHead>
                                <TableHead className="text-right py-4">TVA Appliquée</TableHead>
                                <TableHead className="min-w-[150px] py-4">Renouvellement</TableHead>
                                <TableHead className="w-[80px] py-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/50" /></TableCell></TableRow>
                            ) : filteredRules.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                    {searchTerm ? "Aucun tarif trouvé pour cette recherche." : (isCreateMode ? "Aucun tarif configuré. Ajoutez-en un ci-dessus." : "Aucun tarif spécial configuré pour ce client.")}
                                </TableCell></TableRow>
                            ) : filteredRules.map((rule: any) => {
                                const ruleId = isCreateMode ? rule.tempId : rule.id
                                const isService = isCreateMode ? rule.type === 'service' : !!rule.service_id
                                const itemName = isCreateMode ? rule.itemName : (isService ? rule.services?.name : rule.items?.name)
                                const itemReference = isCreateMode ? rule.itemReference : rule.items?.reference
                                const price = isCreateMode ? rule.specialPrice : rule.special_price
                                const vatRate = isCreateMode ? rule.specialVatRate : rule.special_vat_rate
                                const renewalDate = isCreateMode ? rule.renewalDate : rule.subscription_renewal_date

                                return (
                                    <TableRow key={ruleId} className="hover:bg-slate-50/50">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                                                    isService ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {isService ? "Service" : "Article"}
                                                </span>
                                                {isCreateMode && (
                                                    <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                                                        En attente
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-900">{itemName}</span>
                                                {itemReference && <span className="text-xs text-slate-500">Ref: {itemReference}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-mono font-bold text-slate-900 text-base">{price?.toFixed(3)}</span>
                                            <span className="text-xs text-muted-foreground ml-1">TND</span>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {vatRate
                                                ? <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{vatRate}%</span>
                                                : <span className="text-slate-500">Standard</span>}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                            {renewalDate ? (
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon className="h-3.5 w-3.5 text-primary/70" />
                                                    {format(new Date(renewalDate), "dd/MM/yyyy")}
                                                </div>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(ruleId)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
