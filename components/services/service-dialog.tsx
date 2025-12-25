"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Service } from "./service-manager"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    sku: z.string().optional(),
    category_id: z.string().optional(),
    short_description: z.string().optional(),
    detailed_description: z.string().optional(),
    billing_type: z.string(), // Changed to string to support custom mapping in UI
    price: z.coerce.number().min(0),
    price_ttc: z.coerce.number().min(0).optional(), // UI only, used for calculation
    currency: z.enum(['TND', 'EUR', 'USD']).default('TND'),
    cost_price: z.coerce.number().min(0).optional(),
    estimated_duration: z.coerce.number().min(0).optional(),
    status: z.enum(['active', 'archived']),
    vat_rate: z.coerce.number().default(19), // Changed default to 19
})

interface ServiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    serviceToEdit?: Service
    companyId: string
}

export function ServiceDialog({ open, onOpenChange, serviceToEdit, companyId }: ServiceDialogProps) {
    const [activeTab, setActiveTab] = useState("identification")
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            sku: "",
            category_id: "",
            short_description: "",
            detailed_description: "",
            billing_type: "fixed",
            price: 0,
            price_ttc: 0,
            currency: "TND",
            cost_price: 0,
            estimated_duration: 0,
            status: "active",
            vat_rate: 19,
        },
    })

    // Watch for changes to perform calculations
    const price = form.watch("price")
    const price_ttc = form.watch("price_ttc")
    const vat_rate = form.watch("vat_rate")

    // Sync Price HT -> TTC when HT or VAT changes
    // We need to distinguish who triggered the change to avoid infinite loops. 
    // Simplified approach: onBlur or specific handlers. 
    // Better approach with react-hook-form: use specific change handlers in the inputs.

    const calculateTTC = (ht: number, vat: number) => {
        return Number((ht * (1 + vat / 100)).toFixed(3))
    }

    const calculateHT = (ttc: number, vat: number) => {
        return Number((ttc / (1 + vat / 100)).toFixed(3))
    }

    // Load categories
    useEffect(() => {
        const fetchCategories = async () => {
            const supabase = createClient()
            // Fetch system categories or company specific ones
            const { data } = await supabase
                .from("service_categories")
                .select("id, name")
                .or(`company_id.eq.${companyId},company_id.is.null`)

            if (data) setCategories(data)
        }
        if (open) fetchCategories()
    }, [open, companyId])

    // Reset form on open/edit change
    useEffect(() => {
        if (serviceToEdit) {
            form.reset({
                name: serviceToEdit.name,
                sku: serviceToEdit.sku || "",
                category_id: serviceToEdit.category_id || "",
                short_description: serviceToEdit.short_description || "",
                detailed_description: serviceToEdit.detailed_description || "",
                billing_type: serviceToEdit.billing_type === 'subscription'
                    ? (serviceToEdit.unit === 'Year' ? 'subscription_yearly' : 'subscription_monthly')
                    : serviceToEdit.billing_type,
                price: serviceToEdit.price || 0,
                price_ttc: calculateTTC(serviceToEdit.price || 0, serviceToEdit.vat_rate || 19),
                currency: (serviceToEdit.currency as "TND" | "EUR" | "USD") || "TND",
                cost_price: serviceToEdit.cost_price || 0,
                estimated_duration: serviceToEdit.estimated_duration || 0,
                status: serviceToEdit.status,
                vat_rate: serviceToEdit.vat_rate || 19,
            })
        } else {
            form.reset({
                name: "",
                sku: "",
                billing_type: "fixed",
                price: 0,
                price_ttc: 0,
                currency: "TND",
                cost_price: 0,
                status: "active",
                vat_rate: 19
            })
        }
    }, [serviceToEdit, open])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true)
        const supabase = createClient()

        try {
            // Map UI billing type to DB values
            let dbBillingType = values.billing_type;
            let dbUnit = null;

            if (values.billing_type === 'subscription_monthly') {
                dbBillingType = 'subscription';
                dbUnit = 'Month';
            } else if (values.billing_type === 'subscription_yearly') {
                dbBillingType = 'subscription';
                dbUnit = 'Year';
            }

            const payload = {
                name: values.name,
                sku: values.sku,
                short_description: values.short_description,
                detailed_description: values.detailed_description,
                price: values.price,
                currency: values.currency,
                cost_price: values.cost_price,
                estimated_duration: values.estimated_duration,
                status: values.status,
                vat_rate: values.vat_rate,
                billing_type: dbBillingType,
                unit: dbUnit,
                category_id: values.category_id || null,
                company_id: companyId,
            }

            if (serviceToEdit) {
                const { error } = await supabase
                    .from("services")
                    .update(payload)
                    .eq("id", serviceToEdit.id)
                if (error) throw error
                toast.success("Service mis à jour avec succès")
            } else {
                const { error } = await supabase
                    .from("services")
                    .insert(payload)
                if (error) throw error
                toast.success("Service créé avec succès")
            }
            onOpenChange(false)
        } catch (error) {
            console.error("Error saving service:", error)
            toast.error("Erreur lors de l'enregistrement")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{serviceToEdit ? "Modifier le Service" : "Nouveau Service"}</DialogTitle>
                    <DialogDescription>
                        Configurez les détails, la tarification et la rentabilité de votre service.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="identification">Identification</TabsTrigger>
                                <TabsTrigger value="pricing">Tarification</TabsTrigger>
                            </TabsList>

                            {/* IDENTIFICATION TAB */}
                            <TabsContent value="identification" className="space-y-6 py-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>Nom du Service</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="ex: Consultation Juridique" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sku"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Code / Référence (SKU)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="ex: SRV-001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="category_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Catégorie</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Choisir une catégorie" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {categories.map(cat => (
                                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="short_description"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>Description Courte</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Visible sur les listes..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="detailed_description"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>Description Détaillée (Devis/Factures)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Cette description apparaîtra sur les documents..." className="h-24" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>

                            {/* PRICING TAB */}
                            <TabsContent value="pricing" className="space-y-6 py-6">
                                {/* Section: Modèle de tarification */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                                        Modèle de Tarification
                                    </h3>
                                    <FormField
                                        control={form.control}
                                        name="billing_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type de facturation</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="fixed">Forfait (Prix Fixe)</SelectItem>
                                                        <SelectItem value="hourly">Taux Horaire</SelectItem>
                                                        <SelectItem value="daily">Taux Journalier (TJM)</SelectItem>
                                                        <SelectItem value="subscription_monthly">Abonnement Mensuel</SelectItem>
                                                        <SelectItem value="subscription_yearly">Abonnement Annuel</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                    Définit comment ce service est facturé au client.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Section: Prix */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                                        Prix de Vente
                                    </h3>

                                    {/* Row 1: Currency + TVA */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="currency"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Devise</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        defaultValue={field.value}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Choisir une devise" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="TND">TND - Dinar Tunisien</SelectItem>
                                                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                                                            <SelectItem value="USD">USD - Dollar US</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="vat_rate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Taux TVA</FormLabel>
                                                    <Select
                                                        onValueChange={(val) => {
                                                            const numVal = parseFloat(val)
                                                            field.onChange(numVal)
                                                            const currentPrice = form.getValues("price")
                                                            form.setValue("price_ttc", calculateTTC(currentPrice, numVal))
                                                        }}
                                                        defaultValue={String(field.value)}
                                                        value={String(field.value)}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0">0%</SelectItem>
                                                            <SelectItem value="5">5%</SelectItem>
                                                            <SelectItem value="13">13%</SelectItem>
                                                            <SelectItem value="19">19%</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Row 2: Prix HT + Prix TTC */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prix HT</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                step="0.001"
                                                                placeholder="0.000"
                                                                {...field}
                                                                value={field.value === undefined ? '' : field.value}
                                                                className="pr-16 text-right font-medium"
                                                                onChange={(e) => {
                                                                    field.onChange(e)
                                                                    const valueStr = e.target.value
                                                                    if (valueStr === '') {
                                                                        form.setValue("price_ttc", '')
                                                                        return
                                                                    }
                                                                    const val = parseFloat(valueStr)
                                                                    if (!isNaN(val)) {
                                                                        const currentVat = form.getValues("vat_rate")
                                                                        form.setValue("price_ttc", calculateTTC(val, currentVat))
                                                                    }
                                                                }}
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                                                                {form.watch("currency")}
                                                            </span>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="price_ttc"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prix TTC</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                step="0.001"
                                                                placeholder="0.000"
                                                                {...field}
                                                                value={field.value === undefined ? '' : field.value}
                                                                className="pr-16 text-right font-medium bg-muted/30"
                                                                onChange={(e) => {
                                                                    field.onChange(e)
                                                                    const valueStr = e.target.value
                                                                    if (valueStr === '') {
                                                                        form.setValue("price", '')
                                                                        return
                                                                    }
                                                                    const val = parseFloat(valueStr)
                                                                    if (!isNaN(val)) {
                                                                        const currentVat = form.getValues("vat_rate")
                                                                        form.setValue("price", calculateHT(val, currentVat))
                                                                    }
                                                                }}
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                                                                {form.watch("currency")}
                                                            </span>
                                                        </div>
                                                    </FormControl>
                                                    <FormDescription>Calculé automatiquement</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                        </Tabs>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {serviceToEdit ? "Enregistrer les modifications" : "Créer le Service"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    )
}
