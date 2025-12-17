// Créez le dossier et le fichier : components/dashboard/period-selector.tsx

"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const periods = [
    { value: 'this_month', label: 'Ce mois-ci' },
    { value: 'last_month', label: 'Mois dernier' },
    { value: 'this_year', label: 'Cette année' },
    { value: 'last_year', label: 'Année dernière' },
]

export function PeriodSelector({ selectedCompanyId }: { selectedCompanyId: string | undefined }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentPeriod = searchParams.get('period') || 'this_month';

    const handlePeriodChange = (period: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('period', period);
        // On s'assure de garder l'ID de l'entreprise dans l'URL
        if (selectedCompanyId) {
            params.set('companyId', selectedCompanyId);
        }
        router.push(`${pathname}?${params.toString()}`);
    }

    return (
        <Select value={currentPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
                {periods.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
