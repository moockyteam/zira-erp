// components/supplier-import-dialog.tsx

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SupplierImportDialogProps {
  companyId: string;
  onImportSuccess: () => void;
}

export function SupplierImportDialog({ companyId, onImportSuccess }: SupplierImportDialogProps) {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error("Veuillez sélectionner un fichier.")
      return
    }
    setIsImporting(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet) as any[]

        if (json.length === 0) {
          toast.error("Le fichier Excel est vide ou mal formaté.")
          setIsImporting(false)
          return
        }

        const suppliersToInsert = json.map(row => ({
          company_id: companyId,
          name: row["Nom"],
          matricule_fiscal: row["Matricule Fiscal"],
          contact_person: row["Contact"],
          email: row["Email"],
          phone_number: row["Téléphone"],
          address: row["Adresse"],
          city: row["Ville"],
          country: row["Pays"],
          iban: row["IBAN"],
          notes: row["Notes"],
          balance: parseFloat(row["Solde"]) || 0,
        }))

        const { error } = await supabase.from("suppliers").insert(suppliersToInsert)

        if (error) {
          throw new Error(error.message)
        }

        toast.success(`${suppliersToInsert.length} fournisseurs importés avec succès.`)
        onImportSuccess()
        setIsOpen(false)
      } catch (err: any) {
        toast.error("Erreur lors de l'importation.", { description: err.message })
      } finally {
        setIsImporting(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Importer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer des Fournisseurs</DialogTitle>
          <DialogDescription>
            Sélectionnez un fichier Excel (.xlsx) avec les colonnes : Nom, Matricule Fiscal, Contact, Email, Téléphone, Adresse, Ville, Pays, IBAN, Notes, Solde.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="import-file">Fichier Excel</Label>
          <Input id="import-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={isImporting}>{isImporting ? "Importation..." : "Lancer l'import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
