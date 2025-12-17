// components/stock-empty-state.tsx

import { Button } from "@/components/ui/button"
import { Boxes } from "lucide-react"

interface StockEmptyStateProps {
  onAddItemClick: () => void;
}

export function StockEmptyState({ onAddItemClick }: StockEmptyStateProps) {
  return (
    <div className="text-center py-16">
      <Boxes className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">Votre inventaire est vide</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Commencez par ajouter vos articles pour suivre vos quantités, valoriser votre stock et simplifier vos commandes.
      </p>
      <div className="mt-6">
        <Button onClick={onAddItemClick}>
          Ajouter votre premier article
        </Button>
      </div>
    </div>
  )
}
