// Placez ce code dans : app/dashboard/delivery-notes/[dnId]/page.tsx

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
      <div className="p-8 text-center max-w-md mx-auto mt-12">
        <div className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-indigo-900">Aucune entreprise trouvée</h1>
          <p className="mb-6 text-indigo-700">
            Vous devez d'abord créer une entreprise avant de pouvoir créer un bon de livraison.
          </p>
          <Link
            href="/dashboard/companies"
            className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-md transition-all"
          >
            Créer ma première entreprise
          </Link>
        </div>
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
  const dnData = null
  if (!isNew) {
    // Logique d'édition d'un BL existant
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, address")
    .eq("company_id", companyIdForData)
  const { data: items } = await supabase
    .from("items")
    .select("id, name, reference, quantity_on_hand, sale_price")
    .eq("company_id", companyIdForData)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {isNew ? "Créer un Bon de Livraison" : `Modifier le BL`}
        </h1>
        <DeliveryNoteForm
          initialData={dnData}
          initialDataSource={initialDataSource}
          companies={companies}
          customers={customers || []}
          items={items || []}
        />
      </div>
    </div>
  )
}
