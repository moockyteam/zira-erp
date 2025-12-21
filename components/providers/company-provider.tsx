"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type Company = {
    id: string
    name: string
    logo_url: string | null
    activity: string | null
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
    const [companies] = useState<Company[]>(initialCompanies)
    const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // 1. Try to load from localStorage
        const storedCompanyId = localStorage.getItem("selectedCompanyId")
        if (storedCompanyId) {
            const found = companies.find((c) => c.id === storedCompanyId)
            if (found) {
                setSelectedCompanyState(found)
            } else if (companies.length > 0) {
                // Fallback to first company if stored one not found
                setSelectedCompanyState(companies[0])
            }
        } else if (companies.length > 0) {
            // Default to first company
            setSelectedCompanyState(companies[0])
        }
        setIsLoading(false)
    }, [companies])

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
