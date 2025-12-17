// app/dashboard/quotes/print/[quoteId]/page.tsx

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { QuotePreview } from "@/components/quotes/quote-preview"

export default async function PrintQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { quoteId } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  // MODIFIÉ: Le select inclut maintenant tous les champs nécessaires
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      *, 
      companies(*), 
      customers(*), 
      quote_lines(*, items(reference))
    `)
    .eq("id", quoteId)
    .single()

  if (error || !quote) {
    return notFound()
  }

  const shouldPrint = resolvedSearchParams.print === "true"
  const language = (resolvedSearchParams.lang as string) || "fr"

  return (
    <>
      <QuotePreview quote={quote} language={language} />
      {shouldPrint && <script dangerouslySetInnerHTML={{ __html: "window.print();" }} />}
    </>
  )
}
