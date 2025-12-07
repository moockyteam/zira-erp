'use client'
import { Button } from "./ui/button"
import { Printer, Eye } from "lucide-react" // On ajoute l'icône Oeil

interface ActionButtonProps {
  voucherId: string;
}

// Un composant pour le bouton "Aperçu"
export function PreviewButton({ voucherId }: ActionButtonProps) {
  const handlePreview = () => {
    // Ouvre la page sans le paramètre d'impression
    window.open(`/dashboard/stock-issues/print/${voucherId}`, '_blank');
  }

  return (
    <Button variant="ghost" size="sm" onClick={handlePreview}>
      <Eye className="h-4 w-4 mr-2" />
      Aperçu
    </Button>
  )
}

// Un composant pour le bouton "Imprimer"
export function PrintButton({ voucherId }: ActionButtonProps) {
  const handlePrint = () => {
    // Ouvre la page AVEC le paramètre ?print=true
    window.open(`/dashboard/stock-issues/print/${voucherId}?print=true`, '_blank');
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-2" />
      Imprimer
    </Button>
  )
}
