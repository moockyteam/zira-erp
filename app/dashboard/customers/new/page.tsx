
import { createClient } from "@/lib/supabase/server"
import { CustomerForm } from "@/components/customers/customer-form"
import { redirect } from "next/navigation"

export default async function NewCustomerPage() {
    // We need to get the active company from the session/context
    // Since we are server-side, we might rely on a query param or the user's default company.
    // However, the `CustomerForm` expects `companyId`.
    // Similar to other pages, we can check the user's metadata or latest used company.
    // Ideally, the layout logic handles company selection, but for now let's reuse the logic found in other pages.
    // OR, we can pass the companyId via query param if the list page sends it.

    // Simpler approach for now: Get the user's first company or handle it in Client Component via Context.
    // But `CustomerForm` is a Client Component. 
    // Let's make this page just render the form, and the form handles fetching the company from the context provider if not passed?
    // Actually, `CustomerForm` takes `companyId`. The existing `CustomerManager` used `useCompany` context.

    // To keep it robust, let's wrap the Form in a client component that gets the company ID from the Provider,
    // OR, we just fetch it server side if possible.

    // Let's create a wrapper client component for the new page to grab context.
    // Wait, `CustomerForm` IS a client component. It can use `useCompany` directly if we modify it?
    // The current `CustomerForm` props are `companyId: string`.

    // Let's modify `CustomerForm` slightly or wrap it here.
    // Actually best practice: `CustomerForm` uses the prop. The PAGE can just be a shell.
    // But how do we get `companyId` into the page? 
    // Option A: The user is in `/dashboard/customers`, `CustomerList` is Client side.
    // When clicking "New", we could pass `?companyId=...`.

    return (
        <NewCustomerWrapper />
    )
}

import { NewCustomerWrapper } from "./wrapper"
