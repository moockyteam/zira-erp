"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCompany } from "@/components/providers/company-provider"
import { ServiceList } from "./service-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, X } from "lucide-react"
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
                    {/* Header with title and actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
                        <div>
                            <h2 className="text-lg font-semibold">Services ({filteredServices.length})</h2>
                            <p className="text-sm text-muted-foreground">Gérez votre offre de prestations et tarifs.</p>
                        </div>
                        <Button onClick={handleCreateClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nouveau Service
                        </Button>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Rechercher par nom, référence ou description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-10 bg-white dark:bg-slate-900"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Results info when searching */}
                    {searchQuery && (
                        <p className="text-sm text-muted-foreground">
                            {filteredServices.length} résultat{filteredServices.length !== 1 ? 's' : ''}
                            {filteredServices.length !== services.length && ` sur ${services.length} services`}
                        </p>
                    )}

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
