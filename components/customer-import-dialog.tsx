'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx' // La librairie pour lire les fichiers Excel
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadCloud } from 'lucide-react'

interface CustomerImportDialogProps {
  companyId: string;
  onImportSuccess: () => void; // Pour rafraîchir la liste des clients
}

// On définit la structure attendue des colonnes dans le fichier Excel
type ExcelRow = {
  'Nom': string;
  'Type (ENTREPRISE/PARTICULIER)': 'ENTREPRISE' | 'PARTICULIER';
  'Contact': string;
  'Email': string;
  'Telephone': string;
  'Matricule Fiscal': string;
}

export function CustomerImportDialog({ companyId, onImportSuccess }: CustomerImportDialogProps) {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError("Veuillez sélectionner un fichier.")
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

        if (json.length === 0) {
          throw new Error("Le fichier Excel est vide ou mal formaté.")
        }

        // On transforme les données lues en objets prêts pour Supabase
        const customersToInsert = json.map(row => {
          // --- CORRECTION EXACTE ICI ---
          // On nettoie la valeur du type : on la met en majuscules et on enlève les espaces
          const customerTypeRaw = (row['Type (ENTREPRISE/PARTICULIER)'] || '').toString().trim().toUpperCase();
          const customerType = customerTypeRaw === 'PARTICULIER' ? 'PARTICULIER' : 'ENTREPRISE';

          return {
            company_id: companyId,
            name: row['Nom'],
            customer_type: customerType, // On utilise la valeur nettoyée
            contact_person: row['Contact'],
            email: row['Email'],
            phone_number: row['Telephone'],
            matricule_fiscal: row['Matricule Fiscal'],
          };
        });

        // On envoie tout à Supabase en une seule requête
        const { error: insertError } = await supabase.from('customers').insert(customersToInsert)

        if (insertError) {
          throw insertError
        }

        setSuccessMessage(`${customersToInsert.length} clients ont été importés avec succès !`)
        onImportSuccess() // On rafraîchit la liste
        setFile(null)

      } catch (e: any) {
        setError(`Erreur lors de l'import : ${e.message}`)
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadCloud className="h-4 w-4 mr-2" />
          Importer depuis Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer une liste de clients</DialogTitle>
          <DialogDescription>
            Sélectionnez un fichier Excel (.xlsx). Assurez-vous que les colonnes correspondent au modèle : 
            Nom, Type (ENTREPRISE/PARTICULIER), Contact, Email, Telephone, Matricule Fiscal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="excel-file">Fichier Excel</Label>
            <Input id="excel-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={isLoading || !file}>
            {isLoading ? "Import en cours..." : "Lancer l'import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}