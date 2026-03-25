
"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { ArrowLeft, Loader2, Plus, Trash2, MapPin, Check, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

import { CustomerImportDialog } from "@/components/customer-import-dialog"
import { CustomerPricingManager } from "@/components/customer-pricing-manager"
import { CustomerHistory } from "./customer-history"
import { GlobalPaymentDialog } from "./global-payment-dialog"

type Address = {
    id?: string
    type: string
    address_line1: string
    address_line2?: string
    city: string
    state?: string
    postal_code: string
    country: string
    is_default: boolean
}

type Customer = {
    id?: string
    company_id: string
    name: string
    customer_type: 'ENTREPRISE' | 'PARTICULIER'
    matricule_fiscal: string
    contact_person: string
    email: string
    phone_number: string
    website?: string
    balance: number
    initial_balance: number
    is_subject_to_vat: boolean
    addresses: Address[]
    balance_start_date?: string | null
}

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

const initialAddress: Address = {
    type: "LIVRAISON",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Tunisie",
    is_default: false
}

interface CustomerFormProps {
    companyId: string
    customerId?: string
}

const initialCustomer: Customer = {
    company_id: "",
    name: "",
    customer_type: "ENTREPRISE",
    matricule_fiscal: "",
    contact_person: "",
    email: "",
    phone_number: "",
    website: "",
    balance: 0,
    initial_balance: 0,
    is_subject_to_vat: true,
    balance_start_date: null,
    addresses: []
}

interface CustomerFormProps {
    companyId: string
    customerId?: string // If present, edit mode
}

export function CustomerForm({ companyId, customerId }: CustomerFormProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Get initial tab from URL or default to infogenerale
    const initialTab = searchParams.get('tab') || "infogenerale"

    // Sanitize initial tab
    const safeInitialTab = ["infogenerale", "tarifs", "history"].includes(initialTab)
        ? initialTab
        : "infogenerale";

    const [isLoading, setIsLoading] = useState(!!customerId)
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState(safeInitialTab)
    const [isGlobalPaymentOpen, setIsGlobalPaymentOpen] = useState(false)
    const [pendingPricingRules, setPendingPricingRules] = useState<PendingPriceRule[]>([])

    const [formData, setFormData] = useState<Customer>({
        ...initialCustomer,
        company_id: companyId
    })

    // Load customer data if in edit mode
    useEffect(() => {
        const loadCustomer = async () => {
            if (!customerId) return

            setIsLoading(true)

            // 1. Fetch Customer Info
            const { data: cust, error: custError } = await supabase
                .from("customers")
                .select("*")
                .eq("id", customerId)
                .single()

            if (custError) {
                toast.error("Erreur lors du chargement du client")
                console.error(custError)
                setIsLoading(false)
                return
            }

            // 2. Fetch Addresses
            const { data: addrs, error: addrError } = await supabase
                .from("customer_addresses")
                .select("*")
                .eq("customer_id", customerId)
                .order("is_default", { ascending: false }) // Default first

            if (addrError) {
                console.error("Error loading addresses", addrError)
            }

            // 3. Populate Form (Merge legacy address fields if needed or just use new table)
            // If legacy fields (street, etc) are present and NO addresses in table, we might want to show them?
            // But we ran a migration script, so table should be populated.

            setFormData({
                ...cust,
                customer_type: cust.customer_type || "ENTREPRISE",
                matricule_fiscal: cust.matricule_fiscal || "",
                contact_person: cust.contact_person || "",
                email: cust.email || "",
                phone_number: cust.phone_number || "",
                website: cust.website || "",
                balance: cust.balance || 0,
                initial_balance: cust.initial_balance || 0,
                balance_start_date: cust.balance_start_date || null,
                is_subject_to_vat: cust.is_subject_to_vat ?? true,
                addresses: (addrs || []).map((a: any) => ({
                    ...a,
                    type: a.type || "LIVRAISON",
                    address_line1: a.address_line1 || "",
                    address_line2: a.address_line2 || "",
                    city: a.city || "",
                    state: a.state || "",
                    postal_code: a.postal_code || "",
                    country: a.country || "Tunisie",
                }))
            })

            setIsLoading(false)
        }

        loadCustomer()
    }, [customerId, supabase])

    const handleInputChange = (field: keyof Customer, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // --- Address Handling ---

    const handleAddAddress = () => {
        setFormData(prev => ({
            ...prev,
            addresses: [...prev.addresses, { ...initialAddress, is_default: prev.addresses.length === 0 }]
        }))
    }

    const handleAddressChange = (index: number, field: keyof Address, value: any) => {
        const newAddresses = [...formData.addresses]
        // Ensure we don't set undefined/null for text inputs controlled state
        newAddresses[index] = { ...newAddresses[index], [field]: value || "" }
        setFormData(prev => ({ ...prev, addresses: newAddresses }))
    }

    const handleRemoveAddress = (index: number) => {
        const newAddresses = [...formData.addresses]
        const removed = newAddresses.splice(index, 1)[0]

        // If we removed the default, make the first one default (if exists)
        if (removed.is_default && newAddresses.length > 0) {
            newAddresses[0].is_default = true
        }

        setFormData(prev => ({ ...prev, addresses: newAddresses }))
    }

    const handleSetDefaultAddress = (index: number) => {
        const newAddresses = formData.addresses.map((addr, i) => ({
            ...addr,
            is_default: i === index
        }))
        setFormData(prev => ({ ...prev, addresses: newAddresses }))
    }

    // --- Submission ---

    const handleSubmit = async () => {
        setIsSaving(true)

        try {
            // 1. Upsert Customer
            const customerPayload = {
                company_id: companyId,
                name: formData.name,
                customer_type: formData.customer_type,
                matricule_fiscal: formData.matricule_fiscal,
                contact_person: formData.contact_person,
                email: formData.email,
                phone_number: formData.phone_number,
                initial_balance: formData.initial_balance,
                balance_start_date: formData.balance_start_date,
                // balance: formData.balance, // Balance is calculated, we don't set it manually anymore, logic is in trigger

                is_subject_to_vat: formData.is_subject_to_vat,
                // Legacy fields sync (only map fields that exist in 'customers' table)
                street: formData.addresses.find(a => a.is_default)?.address_line1 || null,
                delegation: formData.addresses.find(a => a.is_default)?.city || null,
                governorate: formData.addresses.find(a => a.is_default)?.state || null,
                // postal_code and country likely do not exist on 'customers' table based on error
            }

            console.log("Saving customer...", { customerId, customerPayload })

            let savedCustomerId = customerId

            if (customerId) {
                const { error } = await supabase.from("customers").update(customerPayload).eq("id", customerId)
                if (error) {
                    console.error("Update failed:", error)
                    throw error
                }
                toast.success("Client mis à jour")
            } else {
                const { data, error } = await supabase.from("customers").insert(customerPayload).select("id").single()
                if (error) {
                    console.error("Insert failed:", error)
                    throw error
                }
                savedCustomerId = data.id
                toast.success("Client créé avec succès")
            }

            // 2. Handle Addresses (Sync)
            if (savedCustomerId) {
                // Check if table exists implicitly by trying operation?
                // Delete existing
                const { error: deleteError } = await supabase.from("customer_addresses").delete().eq("customer_id", savedCustomerId)
                if (deleteError) {
                    console.error("Address delete error (Table might be missing):", deleteError)
                    // Don't throw here, just warn, unless it's critical
                }

                // Insert current
                const addressesToInsert = formData.addresses.map(a => ({
                    customer_id: savedCustomerId,
                    type: a.type,
                    address_line1: a.address_line1,
                    address_line2: a.address_line2 || "", // Ensure no nulls? DB might allow nulls, but inputs? This is for DB insert.
                    city: a.city,
                    state: a.state || "",
                    postal_code: a.postal_code || "",
                    country: a.country || "Tunisie",
                    is_default: a.is_default
                }))

                if (addressesToInsert.length > 0) {
                    const { error: batchErr } = await supabase.from("customer_addresses").insert(addressesToInsert)
                    if (batchErr) {
                        console.error("Address save error", batchErr)
                        toast.error("Erreur lors de la sauvegarde des adresses")
                    }
                }
            }

            // 3. Handle Pending Pricing Rules (if creating new customer)
            if (savedCustomerId && !customerId && pendingPricingRules.length > 0) {
                console.log("Saving pending pricing rules...", pendingPricingRules)

                const pricingRulesPayload = pendingPricingRules.map(rule => ({
                    customer_id: savedCustomerId,
                    service_id: rule.type === 'service' ? rule.itemId : null,
                    item_id: rule.type === 'item' ? rule.itemId : null,
                    special_price: rule.specialPrice,
                    special_vat_rate: rule.overrideVat ? rule.specialVatRate : null,
                    subscription_start_date: rule.startDate ? format(rule.startDate, "yyyy-MM-dd") : null,
                    subscription_renewal_date: rule.renewalDate ? format(rule.renewalDate, "yyyy-MM-dd") : null
                }))

                const { error: pricingError } = await supabase.from("customer_items").insert(pricingRulesPayload)
                if (pricingError) {
                    console.error("Pricing rules save error:", pricingError)
                    toast.error("Erreur lors de la sauvegarde des tarifs spéciaux")
                } else {
                    console.log(`${pendingPricingRules.length} tarif(s) spécial(s) sauvegardé(s)`)
                }
            }

            router.push("/dashboard/customers")
            router.refresh()

        } catch (error: any) {
            console.error("Save error full object:", JSON.stringify(error, null, 2))
            toast.error("Une erreur est survenue: " + (error.message || "Erreur inconnue"))
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" type="button" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{customerId ? "Modifier le client" : "Nouveau client"}</h1>
                    <p className="text-muted-foreground">Gérez les informations, adresses et tarifs du client.</p>
                </div>
                <div className="ml-auto flex gap-2">
                    {customerId && (
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={() => setIsGlobalPaymentOpen(true)}
                            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200"
                        >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Recevoir Paiement Global
                        </Button>
                    )}
                    <Button variant="outline" size="sm" type="button" onClick={() => router.back()} className="h-9">
                        Annuler
                    </Button>
                    <Button type="button" disabled={isSaving} size="sm" className="h-9 shadow-sm" onClick={handleSubmit}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Enregistrer
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[800px] mb-8">
                    <TabsTrigger value="infogenerale">Informations Générales</TabsTrigger>
                    <TabsTrigger value="addresses">Adresses de Livraison</TabsTrigger>
                    <TabsTrigger value="tarifs">Tarifs & Abonnements{!customerId && pendingPricingRules.length > 0 && ` (${pendingPricingRules.length})`}</TabsTrigger>
                    <TabsTrigger value="history" disabled={!customerId}>Historique</TabsTrigger>
                </TabsList>

                <TabsContent value="infogenerale" className="space-y-8 mt-6">
                    {/* Identity Section */}
                    <div>
                        <div className="mb-4">
                            <h3 className="text-lg font-medium">Identité</h3>
                            <p className="text-sm text-muted-foreground">Les informations légales et principales du client.</p>
                        </div>
                        <Card>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Nom / Raison Sociale <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => handleInputChange("name", e.target.value)}
                                        required
                                        placeholder="Ex: Entreprise S.A.R.L"
                                        className="font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type de client</Label>
                                    <Select
                                        value={formData.customer_type}
                                        onValueChange={(v) => handleInputChange("customer_type", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ENTREPRISE">Entreprise (B2B)</SelectItem>
                                            <SelectItem value="PARTICULIER">Particulier (B2C)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Matricule Fiscal</Label>
                                    <Input
                                        value={formData.matricule_fiscal}
                                        onChange={(e) => handleInputChange("matricule_fiscal", e.target.value)}
                                        placeholder="Ex: 1234567 A/B/C/000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Personne de contact</Label>
                                    <Input
                                        value={formData.contact_person}
                                        onChange={(e) => handleInputChange("contact_person", e.target.value)}
                                        placeholder="Nom du responsable"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Contact Section */}
                    <div>
                        <div className="mb-4">
                            <h3 className="text-lg font-medium">Coordonnées</h3>
                            <p className="text-sm text-muted-foreground">Moyens de contact pour la facturation et les relances.</p>
                        </div>
                        <Card>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange("email", e.target.value)}
                                        placeholder="comptabilite@client.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Téléphone</Label>
                                    <Input
                                        type="tel"
                                        value={formData.phone_number}
                                        onChange={(e) => handleInputChange("phone_number", e.target.value)}
                                        placeholder="+216 00 000 000"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Site Web (Optionnel)</Label>
                                    <Input
                                        value={formData.website}
                                        onChange={(e) => handleInputChange("website", e.target.value)}
                                        placeholder="www.client.com"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Financial Section */}
                    <div>
                        <div className="mb-4">
                            <h3 className="text-lg font-medium">Paramètres Financiers</h3>
                            <p className="text-sm text-muted-foreground">Configuration de la facturation et des soldes.</p>
                        </div>
                        <Card>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Solde Initial (TND)</Label>
                                        <Input
                                            type="number"
                                            step="0.001"
                                            value={formData.initial_balance}
                                            onChange={(e) => handleInputChange("initial_balance", parseFloat(e.target.value) || 0)}
                                            className="font-mono bg-yellow-50/50 border-yellow-200"
                                        />
                                        <p className="text-xs text-muted-foreground">Solde de départ (Reprise de données, ancien système...).</p>
                                    </div>

                                    {customerId && (
                                        <div className="space-y-2">
                                            <Label>Solde Actuel (Calculé)</Label>
                                            <div className={`text-xl font-bold font-mono px-3 py-2 rounded border ${formData.balance > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                }`}>
                                                {formData.balance?.toFixed(3)} TND
                                            </div>
                                            <p className="text-xs text-muted-foreground">Solde Initial + Factures/BLs - Paiements</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Date de début du calcul</Label>
                                        <Input
                                            type="date"
                                            value={formData.balance_start_date ? formData.balance_start_date.split('T')[0] : ""}
                                            onChange={(e) => handleInputChange("balance_start_date", e.target.value || null)}
                                            className="bg-background"
                                        />
                                        <p className="text-[0.8rem] text-muted-foreground">
                                            Ignore les documents avant cette date. <br />Si vide = tout l'historique.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Assujetti à la TVA</Label>
                                            <p className="text-sm text-muted-foreground">Appliquer la TVA sur les factures de ce client.</p>
                                        </div>
                                        <Switch
                                            checked={formData.is_subject_to_vat}
                                            onCheckedChange={(v) => handleInputChange("is_subject_to_vat", v)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="addresses" className="space-y-6 mt-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium">Carnet d'adresses</h3>
                        <p className="text-sm text-muted-foreground">Gérez ici les multiples adresses de livraison ou de facturation.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {formData.addresses.map((addr, index) => (
                            <Card key={index} className={`relative transition-all duration-200 ${addr.is_default ? 'border-primary/50 shadow-md bg-primary/5' : 'hover:shadow-md'}`}>
                                <CardHeader className="pb-3 pt-4 px-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                Adresse {index + 1}
                                            </CardTitle>
                                            {addr.is_default && <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary hover:bg-primary/20">Par défaut</Badge>}
                                        </div>
                                        <div className="flex gap-1">
                                            {!addr.is_default && (
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleSetDefaultAddress(index)} title="Définir comme adresse principale">
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveAddress(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 px-4 pb-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Type d'adresse</Label>
                                        <Select value={addr.type} onValueChange={(v) => handleAddressChange(index, "type", v)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LIVRAISON">Livraison</SelectItem>
                                                <SelectItem value="FACTURATION">Facturation</SelectItem>
                                                <SelectItem value="AUTRE">Autre</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-muted-foreground">Adresse complète</Label>
                                        <Input className="h-9" placeholder="Rue, Avenue, Bâtiment..." value={addr.address_line1} onChange={(e) => handleAddressChange(index, "address_line1", e.target.value)} />
                                        <Input className="h-9" placeholder="Appartement, Étage (Optionnel)..." value={addr.address_line2 || ""} onChange={(e) => handleAddressChange(index, "address_line2", e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">Ville</Label>
                                            <Input className="h-9" value={addr.city} onChange={(e) => handleAddressChange(index, "city", e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">Code Postal</Label>
                                            <Input className="h-9" value={addr.postal_code} onChange={(e) => handleAddressChange(index, "postal_code", e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Gouvernorat / Région</Label>
                                        <Input className="h-9" value={addr.state || ""} onChange={(e) => handleAddressChange(index, "state", e.target.value)} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            className="h-auto min-h-[300px] border-dashed border-2 flex flex-col gap-4 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                            onClick={handleAddAddress}
                        >
                            <div className="p-4 bg-background rounded-full border shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Plus className="h-6 w-6" />
                            </div>
                            <span className="font-medium">Ajouter une nouvelle adresse</span>
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="tarifs" className="mt-6">
                    <CustomerPricingManager
                        customerId={customerId}
                        companyId={companyId}
                        pendingRules={customerId ? undefined : pendingPricingRules}
                        onPendingRulesChange={customerId ? undefined : setPendingPricingRules}
                        isCreateMode={!customerId}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <CustomerHistory customerId={customerId || ""} />
                </TabsContent>
            </Tabs>
            <GlobalPaymentDialog
                open={isGlobalPaymentOpen}
                onOpenChange={setIsGlobalPaymentOpen}
                customerId={customerId || ""}
                customerName={formData.name}
                onPaymentComplete={() => {
                    router.refresh()
                }}
            />
        </div>
    )
}
