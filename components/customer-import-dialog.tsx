'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, UploadCloud } from 'lucide-react'

interface CustomerImportDialogProps {
  companyId: string;
  onImportSuccess: () => void;
}

// <-- MODIFIÉ: Structure de l'Excel avec les nouvelles colonnes
type ExcelRow = {
  'Nom': string;
  'Type (ENTREPRISE/PARTICULIER)': 'ENTREPRISE' | 'PARTICULIER';
  'Contact': string;
  'Email': string;
  'Telephone': string;
  'Matricule Fiscal': string;
  'Rue': string;
  'Delegation': string;
  'Gouvernorat': string;
  'Pays': string;
}

export function CustomerImportDialog({ companyId, onImportSuccess }: CustomerImportDialogProps) {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Avoid hydration mismatch by rendering only on client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return <Button variant="outline"><UploadCloud className="h-4 w-4 mr-2" /> Importer</Button>

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
      setError(null)
      setSuccessMessage(null)
    }
  }

  // <-- NOUVEAU: Fonction pour générer et télécharger le modèle Excel
  const downloadTemplate = () => {
    const headers = [
      ['Nom', 'Type (ENTREPRISE/PARTICULIER)', 'Contact', 'Email', 'Telephone', 'Matricule Fiscal', 'Rue', 'Delegation', 'Gouvernorat', 'Pays']
    ];
    // Exemple de ligne pour guider l'utilisateur
    const exampleRow = [
      ['Client Exemple SARL', 'ENTREPRISE', 'Mme. Flen', 'contact@exemple.com', '71123456', '1234567/A/B/000', '123 Rue de la Liberté', 'Tunis', 'Tunis', 'Tunisie']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...exampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    XLSX.writeFile(workbook, "modele_import_clients.xlsx");
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

        if (json.length === 0) throw new Error("Le fichier Excel est vide ou mal formaté.")

        // <-- MODIFIÉ: Mapping des nouvelles colonnes
        const customersToInsert = json.map(row => {
          if (!row['Nom'] || String(row['Nom']).trim() === '') return null; // Ignore les lignes sans nom

          const customerTypeRaw = (row['Type (ENTREPRISE/PARTICULIER)'] || '').toString().trim().toUpperCase();
          const customerType = customerTypeRaw === 'PARTICULIER' ? 'PARTICULIER' : 'ENTREPRISE';

          return {
            company_id: companyId,
            name: row['Nom'],
            customer_type: customerType,
            contact_person: row['Contact'],
            email: row['Email'],
            phone_number: row['Telephone'],
            matricule_fiscal: row['Matricule Fiscal'],
            street: row['Rue'],
            delegation: row['Delegation'],
            governorate: row['Gouvernorat'],
            country: row['Pays'],
          };
        }).filter(Boolean); // Filtre les lignes nulles

        if (customersToInsert.length === 0) {
          throw new Error("Aucun client avec un nom valide n'a été trouvé dans le fichier.");
        }

        const { error: insertError } = await supabase.from('customers').insert(customersToInsert)
        if (insertError) throw insertError

        setSuccessMessage(`${customersToInsert.length} clients ont été importés avec succès !`)
        onImportSuccess()
        setFile(null)

      } catch (e: any) {
        setError(`Erreur: ${e.message}`)
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <Dialog onOpenChange={() => { setFile(null); setError(null); setSuccessMessage(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UploadCloud className="h-4 w-4 mr-2" /> Importer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer une liste de clients</DialogTitle>
          <DialogDescription>
            Importez vos clients depuis un fichier Excel (.xlsx). Seul le champ 'Nom' est obligatoire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Instructions</h4>
            <p className="text-sm text-blue-700 mb-3">
              1. Téléchargez notre modèle pour vous assurer que vos colonnes sont correctement formatées.
            </p>
            {/* <-- NOUVEAU: Bouton pour télécharger le modèle --> */}
            <Button onClick={downloadTemplate} variant="secondary" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Télécharger le modèle
            </Button>
          </div>
          <div>
            <Label htmlFor="excel-file">2. Sélectionnez votre fichier complété</Label>
            <Input id="excel-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {successMessage && <p className="text-sm text-green-600 font-semibold">{successMessage}</p>}
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
