"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"
import { toast } from "sonner"
import { Store, Wrench, Factory, Pickaxe, Building2, Pencil, Save, X, Phone, MapPin, Mail, CreditCard, Check, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCompany } from "@/components/providers/company-provider"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// --- TYPES ---
type Governorate = { id: number; name: string }
type Delegation = { id: number; name: string; governorate_id: number }

const initialFormData = {
    name: "",
    manager_name: "",
    matricule_fiscal: "",
    email: "",
    phone_number: "",
    address: "",
    is_fully_exporting: false,
    is_subject_to_fodec: false,
    activity: "",
    cnss_gen: "",
    cnss_ind: "",
    cnss_registry_number: "",
    activity_code: "",
    customs_code: "",
    invoice_start_number: 1,
    quote_start_number: 1,
    delivery_note_start_number: 1,
    default_withholding_tax_rate: 0,
}

const ACTIVITIES = [
    { id: "commercial", label: "Commerciale", icon: Store, description: "Commerce et distribution" },
    { id: "service", label: "Service", icon: Wrench, description: "Prestations de services" },
    { id: "industriel", label: "Industrielle", icon: Factory, description: "Production et fabrication" },
    { id: "extractive", label: "Extractive", icon: Pickaxe, description: "Mines et carrières" },
] as const

export function CompanyProfileManager() {
    const supabase = createClient()
    const { selectedCompany, setSelectedCompany } = useCompany()

    // Data states
    const [governorates, setGovernorates] = useState<Governorate[]>([])
    const [delegations, setDelegations] = useState<Delegation[]>([])
    const [filteredDelegations, setFilteredDelegations] = useState<Delegation[]>([])

    // UI States
    const [isEditing, setIsEditing] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form States
    const [formData, setFormData] = useState(initialFormData)
    const [selectedGov, setSelectedGov] = useState<string>("")
    const [selectedDel, setSelectedDel] = useState<string>("")
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)

    // --- INITIAL LOAD ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            const [govRes, delRes] = await Promise.all([
                supabase.from("governorates").select("id, name"),
                supabase.from("delegations").select("id, name, governorate_id"),
            ])
            if (govRes.data) setGovernorates(govRes.data)
            if (delRes.data) setDelegations(delRes.data)
            setIsLoading(false)
        }
        fetchData()
    }, [])

    // --- SYNC WITH SELECTED COMPANY ---
    useEffect(() => {
        if (selectedCompany) {
            setFormData({
                name: selectedCompany.name,
                manager_name: selectedCompany.manager_name || "",
                matricule_fiscal: selectedCompany.matricule_fiscal || "",
                email: selectedCompany.email || "",
                phone_number: selectedCompany.phone_number || "",
                address: selectedCompany.address || "",
                is_fully_exporting: selectedCompany.is_fully_exporting || false,
                is_subject_to_fodec: selectedCompany.is_subject_to_fodec || false,
                activity: selectedCompany.activity || "",
                cnss_gen: selectedCompany.cnss_gen || "",
                cnss_ind: selectedCompany.cnss_ind || "",
                cnss_registry_number: selectedCompany.cnss_registry_number || "",
                activity_code: selectedCompany.activity_code || "",

                customs_code: selectedCompany.customs_code || "",
                invoice_start_number: selectedCompany.invoice_start_number || 1,
                quote_start_number: selectedCompany.quote_start_number || 1,
                delivery_note_start_number: selectedCompany.delivery_note_start_number || 1,
                default_withholding_tax_rate: selectedCompany.default_withholding_tax_rate || 0,
            })

            if (selectedCompany.governorate_id) {
                setSelectedGov(String(selectedCompany.governorate_id))
            } else {
                setSelectedGov("")
            }

            if (selectedCompany.delegation_id) {
                setSelectedDel(String(selectedCompany.delegation_id))
            } else {
                setSelectedDel("")
            }

            // Filter delegations immediately if gov is present
            if (selectedCompany.governorate_id && delegations.length > 0) {
                const filtered = delegations.filter((d) => d.governorate_id === selectedCompany.governorate_id)
                setFilteredDelegations(filtered)
            }

            setLogoPreview(selectedCompany.logo_url)
            // Reset editing state when company changes from sidebar
            setIsEditing(false)
        }
    }, [selectedCompany, delegations])

    // --- HANDLERS ---
    const handleGovChange = (govId: string) => {
        setSelectedGov(govId)
        setSelectedDel("")
        const filtered = delegations.filter((d) => d.governorate_id === Number.parseInt(govId))
        setFilteredDelegations(filtered)
    }

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            setLogoFile(file)
            setLogoPreview(URL.createObjectURL(file))
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
    }

    const handleCancel = () => {
        // Revert to original data
        if (selectedCompany) {
            setFormData({
                name: selectedCompany.name,
                manager_name: selectedCompany.manager_name || "",
                matricule_fiscal: selectedCompany.matricule_fiscal || "",
                email: selectedCompany.email || "",
                phone_number: selectedCompany.phone_number || "",
                address: selectedCompany.address || "",
                is_fully_exporting: selectedCompany.is_fully_exporting || false,
                is_subject_to_fodec: selectedCompany.is_subject_to_fodec || false,
                activity: selectedCompany.activity || "",
                cnss_gen: selectedCompany.cnss_gen || "",
                cnss_ind: selectedCompany.cnss_ind || "",
                cnss_registry_number: selectedCompany.cnss_registry_number || "",
                activity_code: selectedCompany.activity_code || "",

                customs_code: selectedCompany.customs_code || "",
                invoice_start_number: selectedCompany.invoice_start_number || 1,
                quote_start_number: selectedCompany.quote_start_number || 1,
                delivery_note_start_number: selectedCompany.delivery_note_start_number || 1,
                default_withholding_tax_rate: selectedCompany.default_withholding_tax_rate || 0,
            })
            setSelectedGov(selectedCompany.governorate_id ? String(selectedCompany.governorate_id) : "")
            setSelectedDel(selectedCompany.delegation_id ? String(selectedCompany.delegation_id) : "")
            setLogoPreview(selectedCompany.logo_url)
            setLogoFile(null)
        }
        setIsEditing(false)
    }

    const handleSave = async () => {
        if (!selectedCompany) return
        setIsSubmitting(true)

        try {
            let logoPublicUrl = selectedCompany.logo_url

            if (logoFile) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const fileExt = logoFile.name.split(".").pop()
                    const filePath = `${user.id}/${uuidv4()}.${fileExt}`
                    const { error: uploadError } = await supabase.storage.from("company_logos").upload(filePath, logoFile, { upsert: true })
                    if (uploadError) throw uploadError
                    const { data: urlData } = supabase.storage.from("company_logos").getPublicUrl(filePath)
                    logoPublicUrl = urlData.publicUrl
                }
            }

            const updatePayload = {
                name: formData.name,
                manager_name: formData.manager_name,
                matricule_fiscal: formData.matricule_fiscal,
                email: formData.email,
                phone_number: formData.phone_number,
                address: formData.address,
                governorate_id: selectedGov ? Number.parseInt(selectedGov) : null,
                delegation_id: selectedDel ? Number.parseInt(selectedDel) : null,
                logo_url: logoPublicUrl,
                is_fully_exporting: formData.is_fully_exporting,
                is_subject_to_fodec: formData.is_subject_to_fodec,
                activity: formData.activity || null,
                cnss_gen: formData.cnss_gen,
                cnss_ind: formData.cnss_ind,
                cnss_registry_number: formData.cnss_registry_number,
                activity_code: formData.activity_code,
                customs_code: formData.customs_code,
                invoice_start_number: Number(formData.invoice_start_number) || 1,
                quote_start_number: Number(formData.quote_start_number) || 1,

                delivery_note_start_number: Number(formData.delivery_note_start_number) || 1,
                default_withholding_tax_rate: Number(formData.default_withholding_tax_rate) || 0,
            }

            const { error } = await supabase
                .from("companies")
                .update(updatePayload)
                .eq("id", selectedCompany.id)

            if (error) throw error

            toast.success("Informations de l'entreprise mises à jour.")

            // Update global context manually or fetch again? 
            // Ideally the context might rely on a fetch or subscription, but we can optimistically update if `setSelectedCompany` allowed it, 
            // but usually `useCompany` fetches from DB on mount/auth. 
            // To keep it simple, we trust the DB update and maybe trigger a reload or wait for next fetch.
            // But if `useCompany` provides a way to refresh, we should use it. 
            // Assuming it does NOT expose a refresh method, we might just update the local display by leaving edit mode.
            // Actually, updating the DB is enough for persistence. 

            // Force update local company object to reflect changes immediately in UI without reload
            // (This assumes setSelectedCompany updates the context state)
            // We need to fetch the fresh company object to be sure.
            const { data: freshCompany } = await supabase.from("companies").select("*").eq("id", selectedCompany.id).single()
            if (freshCompany && setSelectedCompany) {
                setSelectedCompany(freshCompany)
            }

            setIsEditing(false)

        } catch (err: any) {
            console.error(err)
            toast.error("Erreur lors de la sauvegarde : " + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!selectedCompany) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">Aucune entreprise sélectionnée</h3>
                    <p>Veuillez sélectionner une entreprise dans la barre latérale pour voir ses détails.</p>
                </CardContent>
            </Card>
        )
    }

    // --- READ ONLY VIEW ---
    if (!isEditing) {
        const activityInfo = ACTIVITIES.find(a => a.id === formData.activity)
        const governorateName = governorates.find(g => String(g.id) === selectedGov)?.name
        const delegationName = delegations.find(d => String(d.id) === selectedDel)?.name

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b pb-6">
                    <div className="flex items-center gap-6">
                        <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-primary/10 bg-background flex items-center justify-center shadow-lg shadow-black/5">
                            {logoPreview ? (
                                <Image src={logoPreview} alt="Logo" fill className="object-contain p-2" />
                            ) : (
                                <Building2 className="h-10 w-10 text-muted-foreground/30" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{formData.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                {activityInfo && (
                                    <Badge variant="outline" className="gap-1.5 py-1 px-3 border-primary/20 bg-primary/5 text-primary">
                                        <activityInfo.icon className="h-3.5 w-3.5" />
                                        {activityInfo.label}
                                    </Badge>
                                )}
                                {formData.matricule_fiscal && (
                                    <span className="flex items-center gap-1.5 px-2">
                                        <CreditCard className="h-3.5 w-3.5 opacity-70" />
                                        <span className="font-medium font-mono tracking-wide">{formData.matricule_fiscal}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => setIsEditing(true)} size="lg" className="shadow-sm font-medium transition-all hover:shadow-md">
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier les informations
                    </Button>
                </div>

                {/* Contact Card - Full Width */}
                <Card className="shadow-sm border-0 ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                <Building2 className="h-5 w-5" />
                            </div>
                            Informations & Coordonnées
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12">
                            <div className="space-y-1.5 group">
                                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground/70 group-hover:text-primary transition-colors">Secteur d'activité</Label>
                                <div className="font-medium text-base flex items-center gap-2">
                                    {activityInfo ? (
                                        <div className="flex items-center gap-2">
                                            <activityInfo.icon className="h-4 w-4 text-muted-foreground" />
                                            <span>{activityInfo.label}</span>
                                        </div>
                                    ) : "-"}
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground/70 group-hover:text-primary transition-colors">Gérant</Label>
                                <div className="font-medium text-base flex items-center gap-2">
                                    {formData.manager_name || "-"}
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground/70 group-hover:text-primary transition-colors">Email</Label>
                                <div className="font-medium text-base flex items-center gap-2 truncate" title={formData.email}>
                                    {formData.email ? (
                                        <>
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <a href={`mailto:${formData.email}`} className="hover:underline hover:text-primary transition-colors">{formData.email}</a>
                                        </>
                                    ) : "-"}
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground/70 group-hover:text-primary transition-colors">Téléphone</Label>
                                <div className="font-medium text-base flex items-center gap-2">
                                    {formData.phone_number ? (
                                        <>
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <a href={`tel:${formData.phone_number}`} className="hover:underline hover:text-primary transition-colors">{formData.phone_number}</a>
                                        </>
                                    ) : "-"}
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground/70 group-hover:text-primary transition-colors">Adresse</Label>
                                <div className="font-medium text-base flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        {formData.address || "-"}
                                        {(governorateName || delegationName) && (
                                            <div className="text-sm text-muted-foreground mt-0.5">
                                                {delegationName ? `${delegationName}, ` : ""}{governorateName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Split Row: Legal & Fiscal */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Identifiants Légaux */}
                    <Card className="shadow-sm border-primary/20 bg-primary/5 h-full">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                Identifiants Légaux
                            </CardTitle>
                            <CardDescription>Immatriculations officielles</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-6">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Matricule Fiscal</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.matricule_fiscal || "-"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Code Douane</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.customs_code || "-"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Code Activité</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.activity_code || "-"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Matricule CNSS</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.cnss_registry_number || "-"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">CNSS GEN</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.cnss_gen || "-"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">CNSS IND</Label>
                                    <div className="font-semibold font-mono text-sm tracking-wide">{formData.cnss_ind || "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right: Paramètres de Facturation */}
                    <Card className="shadow-sm border-primary/20 bg-primary/5 h-full">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                Paramètres de Facturation
                            </CardTitle>
                            <CardDescription>Régime fiscal et taxes</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-background border shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">
                                            {formData.is_fully_exporting ? "Totalement Exportateur" : "Régime Local"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                            {formData.is_fully_exporting ? "Exonération TVA" : "Soumis à la TVA"}
                                        </span>
                                    </div>
                                    {formData.is_fully_exporting ? (
                                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/50">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-background border shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">
                                            {formData.is_subject_to_fodec ? "Soumis au FODEC" : "Non Soumis au FODEC"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                            {formData.is_subject_to_fodec ? "Taxe 1% Appliquée" : "Pas de taxe FODEC"}
                                        </span>
                                    </div>
                                    {formData.is_subject_to_fodec ? (
                                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/50">
                                            <X className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-dashed">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm font-semibold">Retenue à la Source (RS)</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full text-muted-foreground hover:text-primary">
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[450px] p-0" align="end">
                                                <div className="p-3 bg-muted/20 border-b font-semibold text-sm">Guide des Taux de Retenue à la Source</div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[70px]">Taux</TableHead>
                                                                <TableHead>Type de prestation</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody className="text-xs">
                                                            <TableRow>
                                                                <TableCell className="font-bold">3 %</TableCell>
                                                                <TableCell>Honoraires payés au régime réel (Avocat, Expert-comptable, Bureau d'études).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">10 %</TableCell>
                                                                <TableCell>Loyers, Commissions, Courtages (Location bureau, Intermédiaires).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">15 %</TableCell>
                                                                <TableCell>Honoraires non-résidents (Prestataires étrangers).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">2.5 %</TableCell>
                                                                <TableCell>Vente d'immeuble ou fonds de commerce.</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">1 %</TableCell>
                                                                <TableCell>Marchés publics, Taux réduit spécifique.</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">0.5 %</TableCell>
                                                                <TableCell>Cas spécifiques de marchés de l'état.</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-base px-3 py-1">
                                        {formData.default_withholding_tax_rate ? `${formData.default_withholding_tax_rate}%` : "0%"}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // --- EDIT MODE VIEW ---
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Modifier l'entreprise</h2>
                <Button variant="ghost" onClick={handleCancel}><X className="mr-2 h-4 w-4" /> Annuler</Button>
            </div>

            <form className="space-y-8 pb-20">
                <Card>
                    <CardHeader>
                        <CardTitle>Identité Visuelle & Nom</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-8">
                        {/* Logo Upload */}
                        <div className="flex flex-col gap-4 items-center shrink-0">
                            <div className="relative h-40 w-40 overflow-hidden rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors group">
                                {logoPreview ? (
                                    <Image src={logoPreview} alt="Aperçu" fill className="object-contain p-2" />
                                ) : (
                                    <div className="flex flex-col items-center text-muted-foreground/50 group-hover:text-primary/70 transition-colors">
                                        <Building2 className="h-10 w-10 mb-2" />
                                        <span className="text-xs font-medium">Glisser ou cliquer</span>
                                    </div>
                                )}
                                <Input
                                    type="file"
                                    onChange={handleLogoChange}
                                    accept="image/png, image/jpeg"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            <div className="space-y-2">
                                <Label>Nom de l'entreprise *</Label>
                                <Input id="name" value={formData.name} onChange={handleInputChange} placeholder="Nom officiel" className="text-lg h-12" />
                            </div>

                            <div className="space-y-3">
                                <Label>Secteur d'activité</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {ACTIVITIES.map(a => {
                                        const isSelected = formData.activity === a.id
                                        return (
                                            <div
                                                key={a.id}
                                                onClick={() => setFormData(p => ({ ...p, activity: a.id }))}
                                                className={cn(
                                                    "cursor-pointer flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all hover:bg-muted/50",
                                                    isSelected ? "border-primary bg-primary/5 hover:bg-primary/10" : "border-border/50 hover:border-primary/30"
                                                )}
                                            >
                                                <a.icon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                                                <span className={cn("text-xs font-medium text-center", isSelected && "text-primary")}>{a.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Email contact</Label>
                                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Téléphone</Label>
                                <Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Nom du Gérant</Label>
                                <Input id="manager_name" value={formData.manager_name} onChange={handleInputChange} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Localisation</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Adresse Rue</Label>
                                <Input id="address" value={formData.address} onChange={handleInputChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Gouvernorat</Label>
                                    <Select value={selectedGov} onValueChange={handleGovChange}>
                                        <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                                        <SelectContent>
                                            {governorates.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Délégation</Label>
                                    <Select value={selectedDel} onValueChange={setSelectedDel} disabled={!selectedGov}>
                                        <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                                        <SelectContent>
                                            {filteredDelegations.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Informations Administratives & Sociales</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Matricule CNSS</Label>
                            <Input id="cnss_registry_number" value={formData.cnss_registry_number} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Code Activité</Label>
                            <Input id="activity_code" value={formData.activity_code} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>N° CNSS GEN</Label>
                            <Input id="cnss_gen" value={formData.cnss_gen} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>N° CNSS IND</Label>
                            <Input id="cnss_ind" value={formData.cnss_ind} onChange={handleInputChange} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Renseignements Fiscaux & Douaniers</CardTitle>
                        <CardDescription>Informations légales et taxes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Matricule Fiscal</Label>
                                <Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} placeholder="0000000/A/M/000" />
                            </div>
                            <div className="space-y-2">
                                <Label>Code Douane</Label>
                                <Input id="customs_code" value={formData.customs_code} onChange={handleInputChange} />
                            </div>
                        </div>

                        <Separator />

                        <Card>
                            <CardHeader>
                                <CardTitle>Numérotation des documents</CardTitle>
                                <CardDescription>Définissez le numéro de départ pour vos prochains documents (ex: 100 pour commencer à la facture N°100).</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label>Début Factures</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        id="invoice_start_number"
                                        value={formData.invoice_start_number}
                                        onChange={handleInputChange}
                                        placeholder="1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Début Devis</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        id="quote_start_number"
                                        value={formData.quote_start_number}
                                        onChange={handleInputChange}
                                        placeholder="1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Début Bons de Livraison</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        id="delivery_note_start_number"
                                        value={formData.delivery_note_start_number}
                                        onChange={handleInputChange}
                                        placeholder="1"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center justify-between border p-4 rounded-xl space-x-4">
                                <div className="space-y-1">
                                    <Label className="text-base cursor-pointer" htmlFor="switch-export">Totalement Exportatrice</Label>
                                    <p className="text-xs text-muted-foreground">Exonération de TVA sur les ventes</p>
                                </div>
                                <Switch id="switch-export" checked={formData.is_fully_exporting} onCheckedChange={(c) => setFormData(p => ({ ...p, is_fully_exporting: c }))} />
                            </div>
                            <div className="flex items-center justify-between border p-4 rounded-xl space-x-4">
                                <div className="space-y-1">
                                    <Label className="text-base cursor-pointer" htmlFor="switch-fodec">Soumise au FODEC</Label>
                                    <p className="text-xs text-muted-foreground">Applique une taxe de 1% sur le CA</p>
                                </div>
                                <Switch id="switch-fodec" checked={formData.is_subject_to_fodec} onCheckedChange={(c) => setFormData(p => ({ ...p, is_subject_to_fodec: c }))} />
                            </div>

                            <div className="flex items-center justify-between border p-4 rounded-xl space-x-4 md:col-span-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-base cursor-pointer">Taux de Retenue à la Source</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full text-muted-foreground hover:text-primary">
                                                    <Info className="h-3 w-3" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[450px] p-0" align="end">
                                                <div className="p-3 bg-muted/20 border-b font-semibold text-sm">Guide des Taux de Retenue à la Source</div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[70px]">Taux</TableHead>
                                                                <TableHead>Type de prestation</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody className="text-xs">
                                                            <TableRow>
                                                                <TableCell className="font-bold">3 %</TableCell>
                                                                <TableCell>Honoraires payés au régime réel (Avocat, Expert-comptable, Bureau d'études).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">10 %</TableCell>
                                                                <TableCell>Loyers, Commissions, Courtages (Location bureau, Intermédiaires).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">15 %</TableCell>
                                                                <TableCell>Honoraires non-résidents (Prestataires étrangers).</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">2.5 %</TableCell>
                                                                <TableCell>Vente d'immeuble ou fonds de commerce.</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">1 %</TableCell>
                                                                <TableCell>Marchés publics, Taux réduit spécifique.</TableCell>
                                                            </TableRow>
                                                            <TableRow>
                                                                <TableCell className="font-bold">0.5 %</TableCell>
                                                                <TableCell>Cas spécifiques de marchés de l'état.</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Sélectionnez le taux applicable.</p>
                                </div>
                                <Select
                                    value={formData.default_withholding_tax_rate?.toString()}
                                    onValueChange={(val) => setFormData(p => ({ ...p, default_withholding_tax_rate: Number(val) }))}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="-" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[0, 0.5, 1, 1.5, 2.5, 3, 10, 15].map(rate => (
                                            <SelectItem key={rate} value={rate.toString()}>
                                                {rate}%
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>


                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center gap-4 sticky bottom-4 bg-background/80 backdrop-blur-md p-4 border rounded-xl shadow-2xl z-20 mx-auto max-w-2xl justify-center ring-1 ring-border/50">
                    <Button onClick={handleSave} disabled={isSubmitting} size="lg" className="min-w-[200px] shadow-lg shadow-primary/20">
                        {isSubmitting ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Enregistrer les modifications
                            </>
                        )}
                    </Button>
                    <Button variant="outline" size="lg" onClick={handleCancel} disabled={isSubmitting} className="bg-background">
                        Annuler
                    </Button>
                </div>
            </form>
        </div>
    )
}
