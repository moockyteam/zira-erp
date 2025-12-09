"use client"

import { Card, CardContent } from "@/components/ui/card"
import { RotateCcw, Package } from "lucide-react"

export function ReturnsChart({ data }: { data: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-2 border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <RotateCcw className="h-8 w-8 text-orange-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">{data.total}</div>
              <p className="text-sm text-orange-700">Bons de retour</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Package className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600">{data.items}</div>
              <p className="text-sm text-red-700">Articles retournés</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
