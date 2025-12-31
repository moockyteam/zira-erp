"use client"

import { useState } from "react"
import { GlobalPaymentForm } from "./global-payment-form"
import { PaymentHistoryList } from "./payment-history-list"
import { CustomerPaymentOverview } from "./customer-payment-overview"
import { PageHeader } from "@/components/ui/page-header"
import { Wallet, ArrowLeft } from "lucide-react"
import { useCompany } from "@/components/providers/company-provider"
import { Button } from "@/components/ui/button"

// Remove props interface since we use context
export function PaymentManager({ companyId: initialCompanyId }: { companyId?: string }) {
    const { selectedCompany } = useCompany()
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null)

    // Use selectedCompany from context, fallback to prop if needed (though context should prevail)
    const activeCompanyId = selectedCompany?.id || initialCompanyId || ""

    const handlePaymentSuccess = () => {
        setRefreshTrigger(prev => prev + 1)
    }

    const handleCustomerSelect = (customerId: string) => {
        setViewingCustomerId(customerId)
    }

    if (!activeCompanyId) {
        return <div className="p-8 text-center bg-muted/20 rounded-lg">Veuillez sélectionner une entreprise.</div>
    }

    return (
        <div className="space-y-6 print:space-y-0">
            <div className="print:hidden">
                <PageHeader
                    title="Gestion des Encaissements"
                    description="Enregistrez vos paiements clients et suivez les flux de trésorerie (Allocation FIFO)."
                    icon={Wallet}
                >
                    {viewingCustomerId && (
                        <Button variant="outline" size="sm" onClick={() => setViewingCustomerId(null)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour au global
                        </Button>
                    )}
                </PageHeader>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block print:gap-0">
                <div className="lg:col-span-5 print:hidden">
                    <GlobalPaymentForm
                        companyId={activeCompanyId}
                        onPaymentSuccess={handlePaymentSuccess}
                        onCustomerSelect={handleCustomerSelect}
                    />
                </div>
                <div className="lg:col-span-7 print:w-full">
                    {viewingCustomerId ? (
                        <CustomerPaymentOverview
                            customerId={viewingCustomerId}
                            company={selectedCompany} // Pass company details
                            refreshTrigger={refreshTrigger}
                        />
                    ) : (
                        <PaymentHistoryList
                            companyId={activeCompanyId}
                            refreshTrigger={refreshTrigger}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
