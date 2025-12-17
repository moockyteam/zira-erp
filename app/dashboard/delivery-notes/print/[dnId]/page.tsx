//  app/dashboard/delivery-notes/print/[dnId]/page.tsx

import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { DeliveryNotePreview } from "@/components/delivery-notes/delivery-note-preview"
import { PrintTrigger } from "@/components/print-trigger"

export default async function PrintDnPage({
  params,
  searchParams,
}: {
  params: Promise<{ dnId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { dnId } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  const { data: deliveryNote, error } = await supabase
    .from("delivery_notes")
    .select(`*, companies(*), customers(*), delivery_note_lines(*)`)
    .eq("id", dnId)
    .single()

  if (error || !deliveryNote) {
    return notFound()
  }

  const shouldPrint = resolvedSearchParams.print === "true"
  const language = (resolvedSearchParams.lang as string) || "fr"

  return (
    <>
      <DeliveryNotePreview deliveryNote={deliveryNote} language={language} />
      {shouldPrint && <PrintTrigger />}
    </>
  )
}
