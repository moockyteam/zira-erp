// Fichier : components/company-selector.tsx

"use client"

import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CompanySelectorProps {
  companies: Company[];
  selectedCompanyId: string | null;
  onCompanySelect: (id: string) => void;
}

export function CompanySelector({ companies, selectedCompanyId, onCompanySelect }: CompanySelectorProps) {
  if (!companies || companies.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sélectionnez une entreprise</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => onCompanySelect(company.id)}
              className={cn(
                "border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all hover:shadow-md",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                selectedCompanyId === company.id ? "ring-2 ring-primary ring-offset-2 shadow-lg" : "bg-muted/40"
              )}
            >
              <div className="w-16 h-16 relative flex items-center justify-center bg-background rounded-full overflow-hidden">
                {company.logo_url ? (
                  <Image
                    src={company.logo_url}
                    alt={`Logo de ${company.name}`}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {company.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-center truncate w-full">
                {company.name}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
