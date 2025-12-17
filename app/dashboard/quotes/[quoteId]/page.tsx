// app/dashboard/quotes/[quoteId]/page.tsx

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QuoteForm } from "@/components/quotes/quote-form"
import Link from "next/link"
import { FileText } from "lucide-react"

export default async function QuoteEditorPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // MODIFIÉ: On récupère 'is_subject_to_fodec' pour le calcul correct
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, is_subject_to_fodec")
    .eq("user_id", user.id)

  if (!companies || companies.length === 0) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Aucune entreprise trouvée</h1>
        <p className="mb-6">Vous devez d'abord créer une entreprise avant de pouvoir créer un devis.</p>
        <Link href="/dashboard/companies" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
          Créer ma première entreprise
        </Link>
      </div>
    )
  }

  const isNew = quoteId === "new"
  let quoteData = null
  let companyIdForData = companies[0].id

  if (!isNew) {
    const { data } = await supabase.from("quotes").select("*, quote_lines(*)").eq("id", quoteId).single()
    if (!data) {
      return redirect("/dashboard/quotes")
    }
    quoteData = data
    companyIdForData = data.company_id
  }

  // MODIFIÉ: On récupère 'is_subject_to_vat' pour la logique de TVA par défaut
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, is_subject_to_vat")
    .eq("company_id", companyIdForData)

  const { data: items } = await supabase
    .from("items")
    .select("id, name, sale_price, reference")
    .eq("company_id", companyIdForData)

  // ... le reste du fichier reste identique
  let defaultTerms = null
  const { data: companyDefaults } = await supabase
    .from("company_defaults")
    .select("default_quote_terms")
    .eq("company_id", companyIdForData)
    .single()

  if (companyDefaults) {
    defaultTerms = companyDefaults.default_quote_terms
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {isNew ? "Créer un nouveau Devis" : `Modifier le Devis`}
          </h1>
        </div>
        <QuoteForm
          initialData={quoteData}
          companies={companies}
          customers={customers || []}
          items={items || []}
          defaultTerms={defaultTerms}
        />
      </div>
    </div>
  )
}
