"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"

// Type de l'objet Company, incluant le nouveau champ 'manager_name'
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
}
type Governorate = { id: number; name: string }
type Delegation = { id: number; name: string; governorate_id: number }

// État initial du formulaire, incluant le nouveau champ
const initialFormData = {
  name: "",
  manager_name: "",
  matricule_fiscal: "",
  email: "",
  phone_number: "",
  address: "",
  is_fully_exporting: false,
  is_subject_to_fodec: false,
}

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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([fetchCompanies(), fetchGovernorates(), fetchDelegations()])
    }
    fetchInitialData()
  }, [])

  async function fetchCompanies() {
    const { data, error } = await supabase.from("companies").select("*")
    if (error) console.error("Erreur chargement entreprises:", error)
    else setCompanies(data)
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
      setLogoFile(e.target.files[0])
    }
  }

  const resetForm = () => {
    setEditingCompany(null)
    setFormData(initialFormData)
    setSelectedGov("")
    setSelectedDel("")
    setLogoFile(null)
    const logoInput = document.getElementById("logo") as HTMLInputElement
    if (logoInput) logoInput.value = ""
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
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("Utilisateur non authentifié.")
      setIsLoading(false)
      return
    }

    let logoPublicUrl = editingCompany?.logo_url || null

    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop()
      const filePath = `${user.id}/${uuidv4()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from("company_logos").upload(filePath, logoFile)
      if (uploadError) {
        setError("Erreur lors de l'upload du logo.")
        console.error(uploadError)
        setIsLoading(false)
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
    }

    if (editingCompany) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", editingCompany.id)
      if (updateError) {
        setError("Erreur lors de la mise à jour de l'entreprise.")
        console.error(updateError)
      } else {
        resetForm()
        await fetchCompanies()
      }
    } else {
      const { error: insertError } = await supabase.from("companies").insert({
        ...companyData,
        user_id: user.id
      })
      if (insertError) {
        setError("Erreur lors de la création de l'entreprise.")
        console.error(insertError)
      } else {
        resetForm()
        await fetchCompanies()
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Mes Entreprises</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Logo</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Matricule Fiscal</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      {company.logo_url && (
                        <Image
                          src={company.logo_url || "/placeholder.svg"}
                          alt={`Logo de ${company.name}`}
                          width={40}
                          height={40}
                          className="rounded-md object-contain"
                        />
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card ref={formCardRef}>
        <CardHeader>
          <CardTitle>{editingCompany ? `Modifier l'entreprise : ${editingCompany.name}` : "Ajouter une nouvelle entreprise"}</CardTitle>
          <CardDescription>{editingCompany ? "Modifiez les informations ci-dessous." : "Remplissez les informations de votre entreprise."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Colonne 1 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom de l'entreprise *</Label>
                <Input id="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="manager_name">Nom du gérant</Label>
                <Input id="manager_name" value={formData.manager_name} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="matricule_fiscal">Matricule Fiscal</Label>
                <Input id="matricule_fiscal" value={formData.matricule_fiscal} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="email">Adresse Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
              </div>
            </div>

            {/* Colonne 2 */}
            <div className="space-y-4">
               <div>
                <Label htmlFor="phone_number">Numéro de téléphone</Label>
                <Input id="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div>
                <Label>Gouvernorat</Label>
                <Select value={selectedGov} onValueChange={handleGovChange}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez un gouvernorat" /></SelectTrigger>
                  <SelectContent>
                    {governorates.map((gov) => (<SelectItem key={gov.id} value={String(gov.id)}>{gov.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Délégation</Label>
                <Select value={selectedDel} onValueChange={setSelectedDel} disabled={!selectedGov}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez une délégation" /></SelectTrigger>
                  <SelectContent>
                    {filteredDelegations.map((del) => (<SelectItem key={del.id} value={String(del.id)}>{del.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_fully_exporting">Société totalement exportatrice ?</Label>
                </div>
                <Switch
                  id="is_fully_exporting"
                  checked={formData.is_fully_exporting}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_fully_exporting: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_subject_to_fodec">Société soumise au Fodec ?</Label>
                </div>
                 <Switch
                  id="is_subject_to_fodec"
                  checked={formData.is_subject_to_fodec}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_subject_to_fodec: checked }))}
                />
              </div>
               <div className="sm:col-span-2">
                <Label htmlFor="logo">Logo de l'entreprise</Label>
                <Input id="logo" type="file" onChange={handleLogoChange} accept="image/png, image/jpeg" />
              </div>
            </div>

            {/* Boutons et Erreurs */}
            <div className="md:col-span-2 mt-4 flex items-center gap-4">
              <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                {isLoading ? "Sauvegarde..." : editingCompany ? "Mettre à jour l'entreprise" : "Ajouter l'entreprise"}
              </Button>
              {editingCompany && (
                <Button type="button" variant="ghost" onClick={resetForm} disabled={isLoading}>
                  Annuler
                </Button>
              )}
               {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}