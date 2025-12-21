"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CompanySelector } from "@/components/company-selector"
import { ServiceList } from "./service-list"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ServiceDialog } from "./service-dialog"
import { toast } from "sonner"

export type Service = {
    id: string
    name: string
    sku: string | null
    price: number | null
    billing_type: 'fixed' | 'hourly' | 'daily' | 'subscription'
    status: 'active' | 'archived'
    category_id: string | null
    cost_price: number | null
    estimated_duration: number | null
    detailed_description: string | null
    short_description: string | null
    vat_rate: number
    currency: string | null
    unit: string | null
}

interface ServiceManagerProps {
    userCompanies: { id: string; name: string; logo_url: string | null }[]
}

export function ServiceManager({ userCompanies }: ServiceManagerProps) {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
    const [services, setServices] = useState<Service[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<Service | undefined>(undefined)

    // Auto-select if only one company
    useEffect(() => {
        if (userCompanies && userCompanies.length === 1) {
            setSelectedCompanyId(userCompanies[0].id)
        }
    }, [userCompanies])

    const fetchServices = async () => {
        if (!selectedCompanyId) return

        setIsLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase
            .from("services")
            .select("*")
            .eq("company_id", selectedCompanyId)
            .order("name", { ascending: true })

        if (error) {
            console.error("Error fetching services:", error)
            toast.error("Erreur lors du chargement des services")
        } else {
            setServices(data || [])
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchServices()
    }, [selectedCompanyId])

    const handleCreateClick = () => {
        setSelectedService(undefined)
        setIsDialogOpen(true)
    }

    const handleEditClick = (service: Service) => {
        setSelectedService(service)
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <CompanySelector
                companies={userCompanies}
                selectedCompanyId={selectedCompanyId}
                onCompanySelect={setSelectedCompanyId}
            />

            {selectedCompanyId && (
                <>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
                        <div>
                            <h2 className="text-lg font-semibold">Services ({services.length})</h2>
                            <p className="text-sm text-muted-foreground">Gérez votre offre de prestations et tarifs.</p>
                        </div>
                        <Button onClick={handleCreateClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nouveau Service
                        </Button>
                    </div>

                    <ServiceList
                        services={services}
                        isLoading={isLoading}
                        onEdit={handleEditClick}
                    />

                    <ServiceDialog
                        open={isDialogOpen}
                        onOpenChange={(open: boolean) => {
                            setIsDialogOpen(open)
                            if (!open) fetchServices() // Refresh on close
                        }}
                        serviceToEdit={selectedService}
                        companyId={selectedCompanyId}
                    />
                </>
            )}
        </div>
    )
}
