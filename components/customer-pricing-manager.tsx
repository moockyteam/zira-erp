"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Edit, AlertCircle } from "lucide-react"
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

const priceRuleSchema = z.object({
    type: z.enum(["service", "item"]),
    itemId: z.string().min(1, "Veuillez sélectionner un article"),
    specialPrice: z.coerce.number().min(0, "Le prix doit être positif"),
    specialVatRate: z.number().nullable().optional(),
    overrideVat: z.boolean().default(false),
    startDate: z.date().optional(),
    renewalDate: z.date().optional(),
})

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

export function CustomerPricingManager({ customerId, companyId }: { customerId: string, companyId: string }) {
    const supabase = createClient()
    const [rules, setRules] = useState<CustomerItem[]>([])
    const [loading, setLoading] = useState(true)
    const [services, setServices] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // UI Helpers for selected item in Dialog
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
    // Note: We don't watch specialPrice for side effects anymore to avoid loops.
    const overrideVat = form.watch("overrideVat")
    const specialVatRate = form.watch("specialVatRate")

    useEffect(() => {
        fetchRules()
        fetchOptions()
    }, [customerId, companyId])

    // Effect to update local copy of selected item data for UI visuals
    useEffect(() => {
        if (!itemId) {
            setSelectedItemData(null)
            return
        }
        const found = selectedType === 'service'
            ? services.find(s => s.id === itemId)
            : items.find(i => i.id === itemId)

        setSelectedItemData(found)

        // Update default VAT and Price if not overridden
        // Only run this when item changes significantly to defaults, try to avoid overwriting user edits if they just clicked around
        // For simplicity: When itemId changes, we reset to defaults.
        if (found) {
            const defaultVat = selectedType === 'service' ? (found.vat_rate ?? 19) : (found.tva ?? 19)

            if (!overrideVat) {
                setLocalVAT(defaultVat)
                form.setValue('specialVatRate', defaultVat)
            }

            // Auto-fill price from default
            const defPrice = found.price || found.sale_price || 0
            form.setValue("specialPrice", defPrice)

            // Calculate TTC initial
            const effectiveVat = overrideVat ? (specialVatRate ?? defaultVat) : defaultVat
            const ttc = defPrice * (1 + effectiveVat / 100)
            setPriceTTC(ttc.toFixed(3))
        }

    }, [itemId, selectedType, services, items, form])
    // removed overrideVat from deps to avoid resetting price when toggling switch, logic handled below

    // Effect: Keep Local VAT in sync with form if overridden
    useEffect(() => {
        if (overrideVat && specialVatRate !== null && specialVatRate !== undefined) {
            setLocalVAT(specialVatRate)
        } else if (!overrideVat && selectedItemData) {
            // Revert to default
            const defaultVat = selectedType === 'service' ? (selectedItemData.vat_rate ?? 19) : (selectedItemData.tva ?? 19)
            setLocalVAT(defaultVat)
        }
    }, [specialVatRate, overrideVat, selectedItemData, selectedType])

    // Effect: Update TTC when VAT changes (keep HT constant)
    useEffect(() => {
        const currentHT = form.getValues("specialPrice")
        if (currentHT !== undefined && !isNaN(currentHT) && localVAT !== undefined) {
            const ttc = currentHT * (1 + localVAT / 100)
            setPriceTTC(ttc.toFixed(3))
        }
    }, [localVAT])

    const fetchRules = async () => {
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
        const { data: sData } = await supabase.from("services").select("id, name, price, vat_rate").eq("company_id", companyId).eq("status", "active")
        if (sData) setServices(sData)

        const { data: iData } = await supabase.from("items").select("id, name, reference, sale_price").eq("company_id", companyId)
        if (iData) setItems(iData)
    }

    // Handles changes in HT Input -> Updates TTC
    const handleHTChange = (valueStr: string) => {
        // Allow decimals
        const val = parseFloat(valueStr)
        form.setValue("specialPrice", isNaN(val) ? 0 : val)

        if (!isNaN(val) && localVAT !== undefined) {
            const ttc = val * (1 + localVAT / 100)
            setPriceTTC(ttc.toFixed(3))
        } else {
            setPriceTTC("")
        }
    }

    // Handles changes in TTC Input -> Updates HT in form
    const handleTTCChange = (valueStr: string) => {
        setPriceTTC(valueStr)
        const val = parseFloat(valueStr)
        if (!isNaN(val) && localVAT) {
            const ht = val / (1 + localVAT / 100)
            form.setValue("specialPrice", Number(ht.toFixed(3)))
        }
    }

    const onSubmit = async (values: z.infer<typeof priceRuleSchema>) => {
        const payload: any = {
            customer_id: customerId,
            special_price: values.specialPrice,
            special_vat_rate: values.overrideVat ? values.specialVatRate : null, // If not overridden, store NULL to use item default
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
            toast.success("Tarif ajouté")
            setIsDialogOpen(false)
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
        if (!confirm("Supprimer ce tarif ?")) return
        const { error } = await supabase.from("customer_items").delete().eq("id", id)
        if (!error) {
            setRules(rules.filter(r => r.id !== id))
            toast.success("Supprimé")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-muted-foreground">Tarifs Spéciaux & Abonnements</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Ajouter un tarif</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Ajouter un tarif spécial</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                {/* SELECTION */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <Select onValueChange={(val) => {
                                                    field.onChange(val)
                                                    setSelectedType(val as any)
                                                    form.setValue("itemId", "")
                                                    setPriceTTC("") // Reset TTC
                                                }} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="service">Service</SelectItem>
                                                        <SelectItem value="item">Article</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="itemId"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>{selectedType === "service" ? "Service" : "Article"}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {selectedType === "service" ? services.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        )) : items.map(i => (
                                                            <SelectItem key={i.id} value={i.id}>{i.reference ? `[${i.reference}] ` : ""}{i.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {selectedItemData && (
                                                    <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                                                        <span>Std HT: {selectedItemData.sale_price !== undefined ? selectedItemData.sale_price : selectedItemData.price}</span>
                                                        <span>• TVA: {selectedType === 'service' ? (selectedItemData.vat_rate ?? 'N/A') : (selectedItemData.tva ?? 'N/A')}%</span>
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* PRICING */}
                                <div className="p-4 border rounded-md bg-muted/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium">Configuration du Prix</h4>
                                        <FormField
                                            control={form.control}
                                            name="overrideVat"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2 space-y-0">
                                                    <FormLabel className="cursor-pointer">Modifier TVA ?</FormLabel>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
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
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="specialPrice"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prix HT</FormLabel>
                                                    <FormControl>
                                                        {/* Use handleHTChange instead of direct binding to avoid loop */}
                                                        <Input
                                                            type="number"
                                                            step="0.001"
                                                            defaultValue={field.value}
                                                            onChange={(e) => handleHTChange(e.target.value)}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormItem>
                                            <FormLabel>Prix TTC</FormLabel>
                                            <FormControl>
                                                <Input type="number" value={priceTTC} onChange={(e) => handleTTCChange(e.target.value)} step="0.001" />
                                            </FormControl>
                                        </FormItem>
                                    </div>
                                </div>

                                {/* SUBSCRIPTION */}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="startDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Début Abonnement</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full text-left font-normal pl-3", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Choisir date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="renewalDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Renouvellement</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full text-left font-normal pl-3", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Choisir date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )} />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                                    <Button type="submit">Enregistrer</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900">
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="max-w-[200px]">Désignation</TableHead>
                            <TableHead className="text-right">Prix Spécial (HT)</TableHead>
                            <TableHead className="text-right">TVA</TableHead>
                            <TableHead className="min-w-[120px]">Renouvellement</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                        ) : rules.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Aucun tarif spécial.</TableCell></TableRow>
                        ) : rules.map(rule => (
                            <TableRow key={rule.id}>
                                <TableCell><span className="text-xs uppercase text-muted-foreground font-semibold">{rule.service_id ? "Service" : "Article"}</span></TableCell>
                                <TableCell className="font-medium max-w-[200px] truncate" title={rule.service_id ? rule.services?.name : rule.items?.name}>
                                    {rule.service_id ? rule.services?.name : rule.items?.name}
                                    {rule.items?.reference && <span className="text-xs text-muted-foreground ml-1">({rule.items.reference})</span>}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-indigo-600">{rule.special_price?.toFixed(3)}</TableCell>
                                <TableCell className="text-right text-xs">
                                    {rule.special_vat_rate ? <span className="font-bold text-amber-600">{rule.special_vat_rate}%</span> : <span className="text-muted-foreground">Std</span>}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{rule.subscription_renewal_date ? format(new Date(rule.subscription_renewal_date), "dd/MM/yyyy") : "-"}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
