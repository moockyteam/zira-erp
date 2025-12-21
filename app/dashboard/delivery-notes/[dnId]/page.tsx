//app/dashboard/delivery-notes/[dnId]/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DeliveryNoteForm } from "@/components/delivery-notes/delivery-note-form"
import Link from "next/link"

export default async function DnEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ dnId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { dnId } = await params
  const resolvedSearchParams = await searchParams
  const fromInvoiceId = resolvedSearchParams.fromInvoice as string | undefined
  const fromQuoteId = resolvedSearchParams.fromQuote as string | undefined

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data: companies } = await supabase.from("companies").select("id, name").eq("user_id", user.id)
  if (!companies || companies.length === 0) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Aucune entreprise trouvée</h1>
        <p className="mb-6">Vous devez d'abord créer une entreprise.</p>
        <Link href="/dashboard/companies" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
          Créer ma première entreprise
        </Link>
      </div>
    )
  }

  let companyIdForData = companies[0].id
  let initialDataSource = null

  if (fromQuoteId) {
    const { data } = await supabase.from("quotes").select("*, quote_lines(*)").eq("id", fromQuoteId).single()
    if (data) {
      initialDataSource = { type: "quote", data }
      companyIdForData = data.company_id
    }
  } else if (fromInvoiceId) {
    const { data } = await supabase.from("invoices").select("*, invoice_lines(*)").eq("id", fromInvoiceId).single()
    if (data) {
      initialDataSource = { type: "invoice", data }
      companyIdForData = data.company_id
    }
  }

  const isNew = dnId === "new"
  let dnData = null
  if (!isNew) {
    const { data } = await supabase.from("delivery_notes").select("*, delivery_note_lines(*)").eq("id", dnId).single()
    if (!data) redirect("/dashboard/delivery-notes")
    dnData = data
    companyIdForData = data.company_id
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyIdForData)

  const { data: items } = await supabase
    .from("items")
    .select("id, name, reference, quantity_on_hand, sale_price")
    .eq("company_id", companyIdForData)
    .eq("is_archived", false)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {isNew ? "Créer un Bon de Livraison" : `Modifier le BL`}
        </h1>
        {isNew ? (
          /* Feature: Auto-fill driver and vehicle from last delivery note */
          <DeliveryNoteForm
            initialData={dnData}
            initialDataSource={initialDataSource}
            companies={companies}
            customers={customers || []}
            items={items || []}
            lastUsedValues={await supabase
              .from("delivery_notes")
              .select("driver_name, vehicle_registration")
              .eq("company_id", companyIdForData)
              .order("created_at", { ascending: false })
              .limit(1)
              .single()
              .then(({ data }) => data || { driver_name: "", vehicle_registration: "" })}
          />
        ) : (
          <DeliveryNoteForm
            initialData={dnData}
            initialDataSource={initialDataSource}
            companies={companies}
            customers={customers || []}
            items={items || []}
          />
        )}
      </div>
    </div>
  )
}
