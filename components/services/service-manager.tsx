"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCompany } from "@/components/providers/company-provider"
import { ServiceList } from "./service-list"
import { Button } from "@/components/ui/button"
import { Plus, Wrench } from "lucide-react"
import { ServiceDialog } from "./service-dialog"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"
import { FilterToolbar } from "@/components/ui/filter-toolbar"

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
    const { selectedCompany } = useCompany()
    const selectedCompanyId = selectedCompany?.id
    const [services, setServices] = useState<Service[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<Service | undefined>(undefined)
    const [searchQuery, setSearchQuery] = useState("")

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

    // Filter services based on search query
    const filteredServices = useMemo(() => {
        if (!searchQuery.trim()) return services

        const query = searchQuery.toLowerCase()
        return services.filter(service =>
            service.name.toLowerCase().includes(query) ||
            (service.sku && service.sku.toLowerCase().includes(query)) ||
            (service.short_description && service.short_description.toLowerCase().includes(query))
        )
    }, [services, searchQuery])

    const handleCreateClick = () => {
        setSelectedService(undefined)
        setIsDialogOpen(true)
    }

    const handleEditClick = (service: Service) => {
        setSelectedService(service)
        setIsDialogOpen(true)
    }

    const handleDeleteService = async (serviceId: string) => {
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from("services")
                .delete()
                .eq("id", serviceId)

            if (error) throw error

            toast.success("Service supprimé avec succès")
            await fetchServices()
        } catch (error) {
            console.error("Error deleting service:", error)
            toast.error("Erreur lors de la suppression du service")
        }
    }

    return (
        <div className="space-y-6">
            {selectedCompanyId && (
                <>
                    <PageHeader
                        title="Services"
                        description="Gérez votre offre de prestations et tarifs."
                        icon={Wrench}
                    >
                        <Button onClick={handleCreateClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nouveau Service
                        </Button>
                    </PageHeader>

                    <FilterToolbar
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Rechercher par nom, référence ou description..."
                        resultCount={filteredServices.length}
                        resultLabel={filteredServices.length !== 1 ? 'services' : 'service'}
                    />

                    {/* Results info when searching - Optional as FilterToolbar shows count, but we can keep explicitly if needed, but FilterToolbar has it. */}
                    {/* FilterToolbar shows count, so we can remove the explicit p tag unless we want "sur X services" */}

                    <ServiceList
                        services={filteredServices}
                        isLoading={isLoading}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteService}
                    />

                    <ServiceDialog
                        open={isDialogOpen}
                        onOpenChange={(open: boolean) => {
                            setIsDialogOpen(open)
                            if (!open) fetchServices()
                        }}
                        serviceToEdit={selectedService}
                        companyId={selectedCompanyId}
                    />
                </>
            )}
        </div>
    )
}
