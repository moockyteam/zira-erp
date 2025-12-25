"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type Company = {
    id: string
    name: string
    logo_url: string | null
    activity: string | null
    manager_name: string | null
    matricule_fiscal: string | null
    email: string | null
    phone_number: string | null
    address: string | null
    governorate_id: number | null
    delegation_id: number | null
    is_fully_exporting: boolean | null
    is_subject_to_fodec: boolean | null
    cnss_gen: string | null
    cnss_ind: string | null
    cnss_registry_number: string | null
    activity_code: string | null
    customs_code: string | null
}

interface CompanyContextType {
    companies: Company[]
    selectedCompany: Company | null
    setSelectedCompany: (company: Company) => void
    isLoading: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({
    children,
    initialCompanies,
}: {
    children: React.ReactNode
    initialCompanies: Company[]
}) {
    const [companies, setCompanies] = useState<Company[]>(initialCompanies)
    const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        setCompanies(initialCompanies)
    }, [initialCompanies])

    useEffect(() => {
        // 1. Try to load from localStorage
        const storedCompanyId = localStorage.getItem("selectedCompanyId")
        if (storedCompanyId) {
            const found = companies.find((c) => c.id === storedCompanyId)
            if (found) {
                setSelectedCompanyState(found)
            } else if (companies.length > 0 && !selectedCompany) {
                // Only fallback if nothing selected yet
                setSelectedCompanyState(companies[0])
            } else if (found && selectedCompany && found.id === selectedCompany.id && JSON.stringify(found) !== JSON.stringify(selectedCompany)) {
                // Update selected company if data changed
                setSelectedCompanyState(found)
            }
        } else if (companies.length > 0 && !selectedCompany) {
            // Default to first company
            setSelectedCompanyState(companies[0])
        }
        setIsLoading(false)
    }, [companies, selectedCompany])

    const setSelectedCompany = (company: Company) => {
        setSelectedCompanyState(company)
        localStorage.setItem("selectedCompanyId", company.id)
        router.refresh() // Optional: refresh to reload server components if needed
    }

    return (
        <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany, isLoading }}>
            {children}
        </CompanyContext.Provider>
    )
}

export function useCompany() {
    const context = useContext(CompanyContext)
    if (context === undefined) {
        throw new Error("useCompany must be used within a CompanyProvider")
    }
    return context
}
