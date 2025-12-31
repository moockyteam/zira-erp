import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PaymentManager } from "@/components/payments/payment-manager"

export default async function PaymentsPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/auth/login")
    }

    // Fetch the selected company preference or similar if needed, 
    // but usually we rely on client-side provider or just fetch the first one if not set.
    // Here we'll pass the user ID context to the client component or handle it there.
    // Actually, usually we pass the companies or similar. 
    // But wait, the Sidebar handles company selection via Context. 
    // The client component can use useCompany(). 
    // However, PaymentManager needs companyId prop? 
    // Let's make PaymentManager use the context internally for companyId if possible, 
    // OR fetch the companies here server side to pass the initial one.

    // Checking how other pages do it. e.g. /dashboard/stock/page.tsx
    // It fetches companies server side.

    const { data: companies } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .order("name")

    if (!companies || companies.length === 0) {
        // Handle no company case
    }

    return (
        <div className="container mx-auto py-6 print:p-0 print:m-0 print:max-w-none">
            <PaymentManager companyId={companies?.[0]?.id || ""} />
        </div>
    )
}
