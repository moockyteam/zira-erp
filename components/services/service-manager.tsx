"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCompany } from "@/components/providers/company-provider"
import { ServiceList } from "./service-list"
import { Button } from "@/components/ui/button"
import { PlusCircle, Wrench, Filter, Coins, CreditCard } from "lucide-react"
import { ServiceDialog } from "./service-dialog"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"
import { FilterToolbar } from "@/components/ui/filter-toolbar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

    // Filter states
    const [searchQuery, setSearchQuery] = useState("")
    const [billingTypeFilter, setBillingTypeFilter] = useState("all")
    const [currencyFilter, setCurrencyFilter] = useState("all")

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

    // Get unique currencies for filter options
    const availableCurrencies = useMemo(() => {
        const currencies = new Set(services.map(s => s.currency).filter(Boolean))
        return Array.from(currencies) as string[]
    }, [services])

    // Filter services based on all criteria
    const filteredServices = useMemo(() => {
        return services.filter(service => {
            // 1. Search Query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase()
                const matchesSearch =
                    service.name.toLowerCase().includes(query) ||
                    (service.sku && service.sku.toLowerCase().includes(query)) ||
                    (service.short_description && service.short_description.toLowerCase().includes(query))

                if (!matchesSearch) return false
            }

            // 2. Billing Type Filter
            if (billingTypeFilter !== "all" && service.billing_type !== billingTypeFilter) {
                return false
            }

            // 3. Currency Filter
            if (currencyFilter !== "all" && service.currency !== currencyFilter) {
                return false
            }

            return true
        })
    }, [services, searchQuery, billingTypeFilter, currencyFilter])

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

    const resetFilters = () => {
        setSearchQuery("")
        setBillingTypeFilter("all")
        setCurrencyFilter("all")
    }

    const hasActiveFilters = searchQuery !== "" || billingTypeFilter !== "all" || currencyFilter !== "all"

    return (
        <div className="space-y-6">
            {selectedCompanyId && (
                <>
                    <PageHeader
                        title="Services"
                        description="Gérez votre offre de prestations et tarifs."
                        icon={Wrench}
                    >
                        <Button size="lg" className="shadow-sm" onClick={handleCreateClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nouveau Service
                        </Button>
                    </PageHeader>

                    <FilterToolbar
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Rechercher par nom, référence..."
                        resultCount={filteredServices.length}
                        resultLabel={filteredServices.length !== 1 ? 'services' : 'service'}
                        showReset={hasActiveFilters}
                        onReset={resetFilters}
                    >
                        {/* Billing Type Filter */}
                        <Select value={billingTypeFilter} onValueChange={setBillingTypeFilter}>
                            <SelectTrigger className="w-[180px] h-9 bg-background">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Facturation" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous types</SelectItem>
                                <SelectItem value="fixed">Forfait</SelectItem>
                                <SelectItem value="hourly">Taux horaire</SelectItem>
                                <SelectItem value="daily">Taux journalier</SelectItem>
                                <SelectItem value="subscription">Abonnement</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Currency Filter */}
                        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                            <SelectTrigger className="w-[160px] h-9 bg-background">
                                <div className="flex items-center gap-2">
                                    <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Devise" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes devises</SelectItem>
                                {availableCurrencies.map(currency => (
                                    <SelectItem key={currency} value={currency}>
                                        {currency}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FilterToolbar>

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
