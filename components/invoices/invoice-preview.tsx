"use client"

import Image from "next/image"
import writtenNumber from "written-number"
import { FODEC_RATE } from "@/constants" 

export function InvoicePreview({ invoice }: { invoice: any }) {
  if (!invoice) return null

  const totalInWords = (total: number) => {
    if (total <= 0) return ""
    const [integerPart, decimalPart] = total.toFixed(3).split(".")
    const integerWords = writtenNumber(Number.parseInt(integerPart), { lang: "fr" })
    const decimalWords = writtenNumber(Number.parseInt(decimalPart), { lang: "fr" })
    return `Arrêtée la présente facture à la somme de : ${integerWords} dinars et ${decimalWords} millimes.`
  }

  const isFodecApplicable = invoice.total_fodec > 0

  return (
    <div className="bg-white text-black font-sans text-[10pt] print:text-[9pt]">
      <div className="max-w-4xl mx-auto p-8 print:p-4" style={{ width: "210mm", minHeight: "297mm" }}>
        <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-black">
          <div className="flex items-start gap-4">
            {invoice.companies?.logo_url && (
              <div className="relative w-24 h-24 print:w-20 print:h-20 flex-shrink-0">
                <Image
                  src={invoice.companies.logo_url || "/placeholder.svg"}
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="text-xs">
              <h2 className="text-xl font-bold mb-1">{invoice.companies?.name}</h2>
              <p className="max-w-xs">{invoice.companies?.address}</p>
              <p>Matricule Fiscal: {invoice.companies?.matricule_fiscal}</p>
              {invoice.companies?.email && <p>Email: {invoice.companies.email}</p>}
              {invoice.companies?.phone_number && <p>Tél: {invoice.companies.phone_number}</p>}
              {/* <-- NOUVEAU: Affichage du nom du gérant s'il existe --> */}
              {invoice.companies?.manager_name && <p>Gérant: {invoice.companies.manager_name}</p>}
            </div>
          </div>
          <div className="text-right text-xs">
            <h1 className="text-2xl font-bold tracking-wide">FACTURE</h1>
            <p>
              <span className="font-semibold">Numéro :</span> {invoice.invoice_number}
            </p>
            <p>
              <span className="font-semibold">Date :</span> {new Date(invoice.invoice_date).toLocaleDateString("fr-FR")}
            </p>
            <p>
              <span className="font-semibold">Échéance :</span> {new Date(invoice.due_date).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </header>

        {/* Le reste du fichier ne change pas */}
        <section className="mb-6 grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-md bg-gray-50 text-xs break-words">
  <h3 className="font-bold text-gray-600 mb-1">CLIENT</h3>
  <p className="text-base font-bold">{invoice.customers?.name}</p>
  
  {/* LA CORRECTION EST ICI : On assemble la nouvelle adresse structurée */}
  <p>
    {[
      invoice.customers?.street,
      invoice.customers?.delegation,
      invoice.customers?.governorate,
      invoice.customers?.country
    ].filter(Boolean).join(', ')}
  </p>

  {invoice.customers?.matricule_fiscal && <p>MF: {invoice.customers.matricule_fiscal}</p>}
  {invoice.customers?.email && <p>Email: {invoice.customers.email}</p>}
  {invoice.customers?.phone_number && <p>Tél: {invoice.customers.phone_number}</p>}
</div>
          {invoice.delivery_enabled && (
            <div className="p-3 border rounded-md bg-gray-50 text-xs">
              <h3 className="font-bold text-gray-600 mb-1">LIVRAISON</h3>
              <p>
                <span className="font-semibold">Chauffeur:</span> {invoice.driver_name || "N/A"}
              </p>
              <p>
                <span className="font-semibold">Véhicule:</span> {invoice.vehicle_registration || "N/A"}
              </p>
            </div>
          )}
        </section>

        <div className="mb-6">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border-2 border-gray-800 font-semibold w-[35%]">Description / Article</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Qté</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Prix U. HT</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Remise %</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">TVA %</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Total HT</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_lines.map((line: any, index: number) => {
                const lineTotalHT = line.quantity * line.unit_price_ht * (1 - line.remise_percentage / 100)
                const lineTotalTTC = lineTotalHT * (1 + line.tva_rate / 100)
                return (
                  <tr key={line.id || index}>
                    <td className="p-2 border-2 border-gray-800 align-top">{line.description}</td>
                    <td className="p-2 border-2 border-gray-800 text-right align-top">{line.quantity}</td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {line.unit_price_ht.toFixed(3)}
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {line.remise_percentage.toFixed(2)}%
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {line.tva_rate.toFixed(2)}%
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {lineTotalHT.toFixed(3)}
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono font-semibold align-top">
                      {lineTotalTTC.toFixed(3)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-4" style={{ pageBreakInside: "avoid" }}>
          <footer className="grid grid-cols-2 gap-4 items-start">
            <div className="p-3 border rounded-md bg-gray-50 text-xs">
              <h4 className="font-bold mb-2">Récapitulatif TVA</h4>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="font-semibold text-left">Taux</th>
                    <th className="font-semibold text-right">Base</th>
                    <th className="font-semibold text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {[19, 13, 7, 0].map((rate) => {
                    const base = invoice.invoice_lines
                      .filter((l) => l.tva_rate === rate)
                      .reduce((s, l) => s + l.quantity * l.unit_price_ht * (1 - l.remise_percentage / 100), 0)
                    if (base === 0) return null
                    const base_fodec =
                      base + (isFodecApplicable ? base * (1 - invoice.escompte_percentage / 100) * FODEC_RATE : 0)
                    const amount = base_fodec * (rate / 100)
                    return (
                      <tr key={rate}>
                        <td className="font-mono">{rate}%</td>
                        <td className="text-right font-mono">{base_fodec.toFixed(3)}</td>
                        <td className="text-right font-mono">{amount.toFixed(3)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border rounded-md font-mono text-xs">
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">Total HT Net</span>
                <span>{invoice.total_ht.toFixed(3)}</span>
              </div>
              {invoice.total_escompte > 0 && (
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">Escompte</span>
                  <span>- {invoice.total_escompte.toFixed(3)}</span>
                </div>
              )}
              {isFodecApplicable && (
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">FODEC (1%)</span>
                  <span>+ {invoice.total_fodec.toFixed(3)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">Total TVA</span>
                <span>+ {invoice.total_tva.toFixed(3)}</span>
              </div>
              {invoice.has_stamp && (
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">Timbre Fiscal</span>
                  <span>+ 1.000</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span className="font-sans">Total TTC</span>
                <span>{invoice.total_ttc.toFixed(3)} TND</span>
              </div>
            </div>
          </footer>

          <div className="mt-4 text-xs">
            <h4 className="font-bold mb-1">Notes et Conditions</h4>
            <p className="whitespace-pre-wrap">{invoice.notes || "Aucune condition spécifiée."}</p>
          </div>

          <div className="mt-4 pt-4 border-t text-[8pt] italic text-gray-600">{totalInWords(invoice.total_ttc)}</div>
        </div>
      </div>
    </div>
  )
}