// Fichier : app/dashboard/invoices/[invoiceId]/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { InvoiceForm } from "@/components/invoices/invoice-form"
import Link from "next/link"
import { Building2 } from "lucide-react"

export default async function InvoiceEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { invoiceId } = await params
  const resolvedSearchParams = await searchParams
  const fromQuoteId = resolvedSearchParams.fromQuote as string | undefined

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, is_subject_to_fodec")
    .eq("user_id", user.id)

  if (!companies || companies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-indigo-100 dark:bg-indigo-900/20 rounded-full">
              <Building2 className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Aucune entreprise trouvée</h1>
            <p className="text-muted-foreground">
              Vous devez d'abord créer une entreprise avant de pouvoir créer une facture.
            </p>
          </div>
          <Link href="/dashboard/companies">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all">
              Créer ma première entreprise
            </button>
          </Link>
        </div>
      </div>
    )
  }

  let companyIdForData = companies[0].id
  let quoteInitialData = null

  if (fromQuoteId) {
    const { data: quoteData } = await supabase.from("quotes").select("*, quote_lines(*)").eq("id", fromQuoteId).single()
    quoteInitialData = quoteData
    if (quoteData) {
      companyIdForData = quoteData.company_id
    }
  }

  const isNew = invoiceId === "new"
  let invoiceData = null

  if (!isNew) {
    const { data } = await supabase.from("invoices").select("*, invoice_lines(*)").eq("id", invoiceId).single()

    if (!data) {
      return redirect("/dashboard/invoices")
    }
    invoiceData = data
    companyIdForData = data.company_id
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, balance")
    .eq("company_id", companyIdForData)

  const { data: items } = await supabase
    .from("items")
    .select("id, name, sale_price, reference, quantity_on_hand")
    .eq("company_id", companyIdForData)

  const { data: confirmedQuotes } = await supabase
    .from("quotes")
    .select("id, quote_number")
    .eq("company_id", companyIdForData)
    .eq("status", "CONFIRME")

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/20 dark:to-emerald-950/20 rounded-lg p-6 border border-indigo-100 dark:border-indigo-900/20">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 dark:from-indigo-400 dark:to-emerald-400 bg-clip-text text-transparent">
            {isNew ? "Créer une nouvelle Facture" : `Modifier la Facture`}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isNew
              ? "Remplissez les informations ci-dessous pour générer une nouvelle facture"
              : "Modifiez les détails de votre facture existante"}
          </p>
        </div>

        <InvoiceForm
          initialData={invoiceData}
          quoteInitialData={quoteInitialData}
          companies={companies}
          customers={customers || []}
          items={items || []}
          confirmedQuotes={confirmedQuotes || []}
        />
      </div>
    </div>
  )
}
