// components/stock-import-dialog.tsx
"use client"

import { useState } from "react"
import * as XLSX from "xlsx" // La bibliothèque pour manipuler les fichiers Excel
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadCloud, Download, AlertTriangle, CheckCircle2 } from "lucide-react"

// On reprend les catégories définies dans StockManager pour la validation
const validCategories = ['MARCHANDISE', 'MATIERE_PREMIERE', 'PRODUIT_SEMI_FINI', 'FOURNITURE_CONSOMMABLE']

interface StockImportDialogProps {
  companyId: string;
  onImportSuccess: () => void;
  trigger?: React.ReactNode;
}

export function StockImportDialog({ companyId, onImportSuccess, trigger }: StockImportDialogProps) {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  // Noms des colonnes pour le modèle Excel. Basé sur la structure de la table 'items'.
  const templateHeaders = [
    "name", // Obligatoire
    "category", // Obligatoire
    "reference",
    "description",
    "quantity_on_hand",
    "unit_of_measure",
    "purchase_price",
    "sale_price"
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
      setFeedback(null)
    }
  }

  // Fonction pour générer et télécharger le modèle Excel
  const handleDownloadTemplate = () => {
    // Les en-têtes restent les mêmes
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders]);

    // --- NOUVELLE LOGIQUE POUR LA LISTE DÉROULANTE ---

    // 1. Définir la plage pour la validation. 
    // La colonne B est la colonne 'category'. On l'applique de la ligne 2 à 1000.
    const validationRange = { s: { c: 1, r: 1 }, e: { c: 1, r: 999 } }; // Colonne B, de la ligne 2 à 1000

    // 2. Créer la règle de validation de type "liste".
    // La formule doit être une chaîne de caractères contenant les valeurs séparées par des virgules.
    const categoryValidation = {
      type: "list",
      formula1: `"${validCategories.join(',')}"`, // Ex: "'MARCHANDISE,MATIERE_PREMIERE,...'"
      showDropDown: true,
      errorTitle: "Catégorie invalide",
      error: `Veuillez choisir une valeur dans la liste.`,
      promptTitle: "Choix de la catégorie",
      prompt: `Sélectionnez une des catégories autorisées.`,
    };

    // 3. Appliquer la validation à la feuille de calcul.
    if (!worksheet['!dataValidations']) {
      worksheet['!dataValidations'] = [];
    }
    worksheet['!dataValidations'].push({
      sqref: XLSX.utils.encode_range(validationRange),
      ...categoryValidation
    });

    // --- FIN DE LA NOUVELLE LOGIQUE ---

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modèle Articles");

    // La feuille d'instructions ne change pas et reste très utile
    const instructions = [
      ["Instructions pour le remplissage"],
      [],
      ["Colonne", "Description", "Exemple"],
      ["name", "Nom de l'article (Obligatoire)", "Tournevis cruciforme"],
      ["category", `Catégorie (Obligatoire). Choisir dans la liste déroulante`, "MARCHANDISE"],
      ["reference", "Référence ou SKU (Optionnel)", "TRNVS-001"],
      ["description", "Description détaillée de l'article (Optionnel)", "Tournevis avec manche en caoutchouc"],
      ["quantity_on_hand", "Quantité en stock initiale (Numérique, Optionnel, défaut: 0)", "50"],
      ["unit_of_measure", "Unité de mesure (Optionnel)", "pièce"],
      ["purchase_price", "Prix d'achat HT (Numérique, Optionnel, ex: 3.50)", "3.50"],
      ["sale_price", "Prix de vente HT (Numérique, Optionnel, ex: 7.99)", "7.99"],
    ];
    const instructionsWs = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsWs, "Instructions");

    XLSX.writeFile(workbook, "modele_import_articles.xlsx");
  }

  // Fonction pour traiter le fichier importé
  const handleImport = async () => {
    if (!file) {
      setFeedback({ type: 'error', message: "Veuillez sélectionner un fichier." })
      return
    }

    setIsLoading(true)
    setFeedback(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json: any[] = XLSX.utils.sheet_to_json(worksheet)

        if (json.length === 0) {
          throw new Error("Le fichier est vide ou mal formaté.")
        }

        const itemsToInsert = []
        for (let i = 0; i < json.length; i++) {
          const row = json[i]
          const line = i + 2; // Ligne dans le fichier Excel (en comptant l'en-tête)

          // 1. Validation des données de la ligne
          if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
            throw new Error(`Ligne ${line}: Le champ 'name' est manquant ou invalide.`);
          }
          if (!row.category || !validCategories.includes(row.category)) {
            throw new Error(`Ligne ${line}: La catégorie '${row.category}' est invalide. Valeurs acceptées : ${validCategories.join(', ')}`);
          }

          // 2. Formatage des données pour Supabase
          itemsToInsert.push({
            company_id: companyId,
            name: String(row.name).trim(),
            reference: row.reference ? String(row.reference).trim() : null,
            description: row.description ? String(row.description).trim() : null,
            category: String(row.category).trim(),
            quantity_on_hand: parseFloat(row.quantity_on_hand) || 0,
            unit_of_measure: row.unit_of_measure ? String(row.unit_of_measure).trim() : null,
            purchase_price: row.purchase_price ? parseFloat(row.purchase_price) : null,
            sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
          })
        }

        // 3. Insertion en masse dans Supabase
        const { error } = await supabase.from("items").insert(itemsToInsert)

        if (error) {
          throw new Error(`Erreur Supabase: ${error.message}`)
        }

        setFeedback({ type: 'success', message: `${itemsToInsert.length} article(s) importé(s) avec succès !` })
        onImportSuccess() // Rafraîchit la liste dans le composant parent
        setFile(null)

      } catch (error: any) {
        setFeedback({ type: 'error', message: error.message || "Une erreur inconnue est survenue." })
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Dialog onOpenChange={() => { setFeedback(null); setFile(null); }}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm"><UploadCloud className="mr-2 h-4 w-4" /> Importer</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importer des Articles en Masse</DialogTitle>
          <DialogDescription>
            Ajoutez plusieurs articles à votre inventaire en une seule fois via un fichier Excel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-bold">Étape 1 : Télécharger le modèle</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Utilisez ce fichier pour garantir que vos données sont au bon format.
            </p>
            <Button variant="secondary" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Télécharger le modèle.xlsx
            </Button>
          </div>
          <div>
            <Label htmlFor="import-file" className="font-bold">Étape 2 : Importer le fichier complété</Label>
            <Input id="import-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="mt-2" />
          </div>

          {feedback && (
            <div className={`flex items-start gap-3 p-3 rounded-md ${feedback.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
              {feedback.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              <p className="text-sm font-medium">{feedback.message}</p>
            </div>
          )}

        </div>
        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button type="button" variant="ghost">Fermer</Button>
          </DialogClose>
          <Button type="button" onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "Import en cours..." : "Lancer l'Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
