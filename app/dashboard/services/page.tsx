import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ServiceManager } from "@/components/services/service-manager"

export default async function ServicesPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: companies } = await supabase
        .from("companies")
        .select("id, name, logo_url")
        .eq("user_id", user.id)

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Catalogue de Services</h1>
                <ServiceManager userCompanies={companies || []} />
            </div>
        </div>
    )
}
