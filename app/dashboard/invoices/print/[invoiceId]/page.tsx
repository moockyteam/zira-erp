// Fichier : app/dashboard/invoices/print/[invoiceId]/page.tsx

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { InvoicePreview } from "@/components/invoices/invoice-preview"
import { PrintTrigger } from "@/components/print-trigger" // <-- NOUVELLE IMPORTATION

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { invoiceId } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`*, companies(*), customers(*), invoice_lines(*)`)
    .eq("id", invoiceId)
    .single()

  if (error || !invoice) {
    return notFound()
  }

  const shouldPrint = resolvedSearchParams.print === "true"
  const language = (resolvedSearchParams.lang as string) || "fr"

  return (
    <>
      <InvoicePreview invoice={invoice} language={language} />
      {shouldPrint && <PrintTrigger />}
    </>
  )
}
