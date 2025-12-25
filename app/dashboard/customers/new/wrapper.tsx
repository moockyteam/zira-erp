
"use client"

import { useCompany } from "@/components/providers/company-provider"
import { CustomerForm } from "@/components/customers/customer-form"
import { Card, CardContent } from "@/components/ui/card"

export function NewCustomerWrapper() {
    const { selectedCompany, isLoading } = useCompany()

    if (isLoading) return <div>Chargement...</div>

    if (!selectedCompany) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p>Veuillez sélectionner une entreprise.</p>
                </CardContent>
            </Card>
        )
    }

    return <CustomerForm companyId={selectedCompany.id} />
}
