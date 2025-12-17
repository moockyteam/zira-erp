// Créez le dossier et le fichier : components/dashboard/dashboard-company-selector.tsx

"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CompanySelector } from "@/components/company-selector";

export function DashboardCompanySelector({ companies, selectedCompanyId }: {
    companies: any[];
    selectedCompanyId: string | undefined;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleCompanyChange = (companyId: string) => {
        if (!companyId) return;
        const params = new URLSearchParams(searchParams);
        params.set('companyId', companyId);
        router.push(`${pathname}?${params.toString()}`);
    }

    return (
        <CompanySelector 
            companies={companies}
            selectedCompanyId={selectedCompanyId || null}
            onCompanySelect={handleCompanyChange}
        />
    )
}
