"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"
import { toast } from "sonner"
import { Store, Wrench, Factory, Pickaxe, Building2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/ui/page-header"

type Company = {
  id: string
  name: string
  manager_name: string | null
  matricule_fiscal: string | null
  email: string | null
  phone_number: string | null
  address: string | null
  logo_url: string | null
  governorate_id: number | null
  delegation_id: number | null
  is_fully_exporting: boolean | null
  is_subject_to_fodec: boolean | null
  activity: "commercial" | "service" | "industriel" | "extractive" | null
}
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
}

const ACTIVITIES = [
  { id: "commercial", label: "Commerciale", icon: Store, description: "Commerce et distribution" },
  { id: "service", label: "Service", icon: Wrench, description: "Prestations de services" },
  { id: "industriel", label: "Industrielle", icon: Factory, description: "Production et fabrication" },
  { id: "extractive", label: "Extractive", icon: Pickaxe, description: "Mines et carrières" },
] as const

export function CompanyManager() {
  const supabase = createClient()
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [governorates, setGovernorates] = useState<Governorate[]>([])
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [filteredDelegations, setFilteredDelegations] = useState<Delegation[]>([])
  const [formData, setFormData] = useState(initialFormData)
  const [selectedGov, setSelectedGov] = useState<string>("")
  const [selectedDel, setSelectedDel] = useState<string>("")
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsInitialLoading(true)
      await Promise.all([fetchCompanies(), fetchGovernorates(), fetchDelegations()])
      setIsInitialLoading(false)
    }
    fetchInitialData()
  }, [])

  async function fetchCompanies() {
    const { data, error } = await supabase.from("companies").select("*").order("name")
    if (error) {
      console.error("Erreur chargement entreprises:", error)
      toast.error("Impossible de charger les entreprises.")
    } else {
      setCompanies(data)
    }
  }

  async function fetchGovernorates() {
    const { data, error } = await supabase.from("governorates").select("id, name")
    if (error) console.error("Erreur chargement gouvernorats:", error)
    else setGovernorates(data)
  }

  async function fetchDelegations() {
    const { data, error } = await supabase.from("delegations").select("id, name, governorate_id")
    if (error) console.error("Erreur chargement délégations:", error)
    else setDelegations(data)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

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

  const resetFormAndClose = () => {
    setEditingCompany(null)
    setFormData(initialFormData)
    setSelectedGov("")
    setSelectedDel("")
    setLogoFile(null)
    setLogoPreview(null)
    setIsFormOpen(false)
    setError(null)
  }

  const handleAddNewClick = () => {
    setEditingCompany(null)
    setFormData(initialFormData)
    setSelectedGov("")
    setSelectedDel("")
    setLogoPreview(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (company: Company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name,
      manager_name: company.manager_name || "",
      matricule_fiscal: company.matricule_fiscal || "",
      email: company.email || "",
      phone_number: company.phone_number || "",
      address: company.address || "",
      is_fully_exporting: company.is_fully_exporting || false,
      is_subject_to_fodec: company.is_subject_to_fodec || false,
      activity: company.activity || "",
    })
    if (company.governorate_id) {
      const govIdStr = String(company.governorate_id)
      setSelectedGov(govIdStr)
      const filtered = delegations.filter((d) => d.governorate_id === company.governorate_id)
      setFilteredDelegations(filtered)
    } else {
      setSelectedGov("")
      setFilteredDelegations([])
    }
    setSelectedDel(company.delegation_id ? String(company.delegation_id) : "")
    setLogoPreview(company.logo_url)
    setIsFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Utilisateur non authentifié.")
      setIsSubmitting(false)
      return
    }

    let logoPublicUrl = editingCompany?.logo_url || null

    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop()
      const filePath = `${user.id}/${uuidv4()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from("company_logos").upload(filePath, logoFile, { upsert: true })
      if (uploadError) {
        setError("Erreur lors de l'upload du logo.")
        toast.error("Erreur lors de l'upload du logo.")
        console.error(uploadError)
        setIsSubmitting(false)
        return
      }
      const { data: urlData } = supabase.storage.from("company_logos").getPublicUrl(filePath)
      logoPublicUrl = urlData.publicUrl
    }

    const companyData = {
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
    }

    if (editingCompany) {
      const { error: updateError } = await supabase.from("companies").update(companyData).eq("id", editingCompany.id)
      if (updateError) {
        setError("Erreur lors de la mise à jour.")
        toast.error(`Erreur: ${updateError.message}`)
        console.error(updateError)
      } else {
        toast.success(`L'entreprise "${formData.name}" a été mise à jour.`)
        resetFormAndClose()
        await fetchCompanies()
      }
    } else {
      const { error: insertError } = await supabase.from("companies").insert({ ...companyData, user_id: user.id })
      if (insertError) {
        setError("Erreur lors de la création.")
        toast.error(`Erreur: ${insertError.message}`)
        console.error(insertError)
      } else {
        toast.success("Nouvelle entreprise ajoutée avec succès !")
        resetFormAndClose()
        await fetchCompanies()
      }
    }
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes Entreprises"
        description="Gérez les informations de vos structures."
        icon={Building2}
      >
        <Button onClick={handleAddNewClick}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une entreprise
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[80px] py-4">Logo</TableHead>
                <TableHead className="py-4">Nom</TableHead>
                <TableHead className="hidden sm:table-cell py-4">Matricule Fiscal</TableHead>
                <TableHead className="hidden md:table-cell py-4">Email</TableHead>
                <TableHead className="py-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[180px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-[70px]" /></TableCell>
                  </TableRow>
                ))
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Vous n'avez pas encore d'entreprise.
                    <Button variant="link" className="pl-1" onClick={handleAddNewClick}>
                      Commencez par en ajouter une.
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      {company.logo_url ? (
                        <Image src={company.logo_url} alt={`Logo de ${company.name}`} width={40} height={40} className="rounded-md object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs">Pas de logo</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{company.matricule_fiscal}</TableCell>
                    <TableCell className="hidden md:table-cell">{company.email}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(company)}>
                        Gérer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-1">
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              {editingCompany ? (
                <>
                  <Building2 className="h-6 w-6 text-primary" />
                  Modifier l'entreprise
                </>
              ) : (
                <>
                  <Building2 className="h-6 w-6 text-primary" />
                  Nouvelle entreprise
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground/80">
              {editingCompany
                ? "Mettez à jour les informations de votre structure ci-dessous."
                : "Configurez les détails essentiels de votre nouvelle structure."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-8 py-4">

            {/* SECTION 1: Informations Générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
                Informations Générales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nom de l'entreprise *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: Ma Société SARL"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager_name">Nom du gérant</Label>
                  <Input
                    id="manager_name"
                    value={formData.manager_name}
                    onChange={handleInputChange}
                    placeholder="Nom complet du gérant"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matricule_fiscal">Matricule Fiscal</Label>
                  <Input
                    id="matricule_fiscal"
                    value={formData.matricule_fiscal}
                    onChange={handleInputChange}
                    placeholder="1234567/A/M/000"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="contact@entreprise.com"
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Secteur d'activité */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
                Secteur d'Activité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ACTIVITIES.map((act) => {
                  const isSelected = formData.activity === act.id
                  const Icon = act.icon
                  return (
                    <div
                      key={act.id}
                      onClick={() => setFormData(prev => ({ ...prev, activity: act.id }))}
                      className={cn(
                        "cursor-pointer relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                          : "border-muted hover:border-primary/50 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className={cn(
                          "p-3 rounded-full transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className={cn("font-semibold leading-none", isSelected ? "text-primary" : "text-foreground")}>
                            {act.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{act.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SECTION 3: Coordonnées & Localisation */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
                Coordonnées & Localisation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Numéro de téléphone</Label>
                  <Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} placeholder="+216 00 000 000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input id="address" value={formData.address} onChange={handleInputChange} placeholder="Rue, Ville, Code Postal" />
                </div>
                <div className="space-y-2">
                  <Label>Gouvernorat</Label>
                  <Select value={selectedGov} onValueChange={handleGovChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                    <SelectContent>
                      {governorates.map((gov) => (<SelectItem key={gov.id} value={String(gov.id)}>{gov.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Délégation</Label>
                  <Select value={selectedDel} onValueChange={setSelectedDel} disabled={!selectedGov}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                    <SelectContent>
                      {filteredDelegations.map((del) => (<SelectItem key={del.id} value={String(del.id)}>{del.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SECTION 4: Paramètres & Logo */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
                Paramètres & Logo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/10">
                    <Label htmlFor="is_fully_exporting" className="flex flex-col space-y-1 cursor-pointer">
                      <span className="font-medium">Totalement exportatrice</span>
                      <span className="font-normal text-xs text-muted-foreground">Exonération de TVA pour les achats locaux</span>
                    </Label>
                    <Switch id="is_fully_exporting" checked={formData.is_fully_exporting} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_fully_exporting: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/10">
                    <Label htmlFor="is_subject_to_fodec" className="flex flex-col space-y-1 cursor-pointer">
                      <span className="font-medium">Soumise au FODEC</span>
                      <span className="font-normal text-xs text-muted-foreground">Appliquer la taxe FODEC de 1%</span>
                    </Label>
                    <Switch id="is_subject_to_fodec" checked={formData.is_subject_to_fodec} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_subject_to_fodec: checked }))} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="logo" className="block text-sm font-medium">Logo de l'entreprise</Label>
                  <div className="flex items-start gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Aperçu" fill className="object-contain p-1" />
                      ) : (
                        <Building2 className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input id="logo" type="file" onChange={handleLogoChange} accept="image/png, image/jpeg" className="cursor-pointer file:cursor-pointer" />
                      <p className="text-xs text-muted-foreground">Format: PNG, JPG. Max 5MB.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">{error}</div>}

            <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-0 z-10 gap-2">
              <Button type="button" variant="outline" onClick={resetFormAndClose} disabled={isSubmitting} className="h-11">
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px] h-11">
                {isSubmitting ? (
                  <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" /> Sauvegarde...</span>
                ) : editingCompany ? "Enregistrer les modifications" : "Ajouter l'entreprise"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
