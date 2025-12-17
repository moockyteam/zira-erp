"use client"

import Image from "next/image"
import writtenNumber from "written-number"
import { TRANSLATIONS, type Language } from "@/lib/translations"

const FODEC_RATE = 0.01

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = {
    TND: "TND",
    USD: "$",
    EUR: "€",
  }
  return symbols[currency] || currency
}

export function InvoicePreview({ invoice, language = "fr" }: { invoice: any; language?: string }) {
  if (!invoice) return null

  const t = TRANSLATIONS[language as Language] || TRANSLATIONS.fr
  const currencySymbol = getCurrencySymbol(invoice.currency || "TND")

  const totalInWords = (total: number, netToPay: number, hasWithholding: boolean) => {
    const amountToConvert = hasWithholding ? netToPay : total
    if (amountToConvert <= 0) return ""
    const [integerPart, decimalPart] = amountToConvert.toFixed(3).split(".")
    const langCode = language === "fr" ? "fr" : language === "es" ? "es" : language === "pt" ? "pt" : "en"
    const integerWords = writtenNumber(Number.parseInt(integerPart), { lang: langCode })
    const decimalWords = writtenNumber(Number.parseInt(decimalPart), { lang: langCode })
    const label = hasWithholding ? t.amountInWordsWithholding : t.amountInWordsSuffix
    const currencyName = invoice.currency === "USD" ? t.dollars : invoice.currency === "EUR" ? t.euros : t.dinars
    const smallUnit = invoice.currency === "TND" ? t.millimes : t.centimes
    return `${t.amountInWords} ${label} : ${integerWords} ${currencyName} ${t.notesAndConditions.toLowerCase().includes("et") ? "et" : "and"} ${decimalWords} ${smallUnit}.`
  }

  const isFodecApplicable = invoice.total_fodec > 0
  const netToPay = invoice.total_ttc - (invoice.withholding_tax_amount || 0)

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
              {invoice.companies?.manager_name && <p>Gérant: {invoice.companies.manager_name}</p>}
            </div>
          </div>
          <div className="text-right text-xs">
            <h1 className="text-2xl font-bold tracking-wide">{t.invoice}</h1>
            <p>
              <span className="font-semibold">{t.invoiceNumber} :</span> {invoice.invoice_number}
            </p>
            <p>
              <span className="font-semibold">{t.date} :</span>{" "}
              {new Date(invoice.invoice_date).toLocaleDateString(
                language === "fr"
                  ? "fr-FR"
                  : language === "es"
                    ? "es-ES"
                    : language === "de"
                      ? "de-DE"
                      : language === "it"
                        ? "it-IT"
                        : language === "pt"
                          ? "pt-PT"
                          : "en-US",
              )}
            </p>
            <p>
              <span className="font-semibold">{t.dueDate} :</span>{" "}
              {new Date(invoice.due_date).toLocaleDateString(
                language === "fr"
                  ? "fr-FR"
                  : language === "es"
                    ? "es-ES"
                    : language === "de"
                      ? "de-DE"
                      : language === "it"
                        ? "it-IT"
                        : language === "pt"
                          ? "pt-PT"
                          : "en-US",
              )}
            </p>
          </div>
        </header>

        <section className="mb-6">
          <div className="p-3 border rounded-md bg-gray-50 text-xs break-words">
            <h3 className="font-bold text-gray-600 mb-1">{t.client}</h3>
            <p className="text-base font-bold">{invoice.customers?.name || invoice.prospect_name}</p>
            <p>
              {[
                invoice.customers?.street,
                invoice.customers?.delegation,
                invoice.customers?.governorate,
                invoice.customers?.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {invoice.customers?.matricule_fiscal && <p>MF: {invoice.customers.matricule_fiscal}</p>}
            {invoice.customers?.email && <p>Email: {invoice.customers.email}</p>}
            {invoice.customers?.phone_number && <p>Tél: {invoice.customers.phone_number}</p>}
          </div>
        </section>

        <div className="mb-6">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border-2 border-gray-800 font-semibold w-[35%]">{t.description}</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.quantity}</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.unitPriceHT}</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.unitPriceTTC}</th>
                {invoice.show_remise_column && (
                  <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.discount}</th>
                )}
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.vat}</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">{t.totalHT}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_lines.map((line: any, index: number) => {
                const unitPriceTTC = (line.unit_price_ht || 0) * (1 + (line.tva_rate || 0) / 100)
                const lineTotalHT =
                  (line.quantity || 0) * (line.unit_price_ht || 0) * (1 - (line.remise_percentage || 0) / 100)
                return (
                  <tr key={line.id || index}>
                    <td className="p-2 border-2 border-gray-800 align-top">{line.description}</td>
                    <td className="p-2 border-2 border-gray-800 text-right align-top">{line.quantity}</td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {(line.unit_price_ht || 0).toFixed(3)}
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {unitPriceTTC.toFixed(3)}
                    </td>
                    {invoice.show_remise_column && (
                      <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                        {(line.remise_percentage || 0).toFixed(2)}%
                      </td>
                    )}
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {(line.tva_rate || 0).toFixed(2)}%
                    </td>
                    <td className="p-2 border-2 border-gray-800 text-right font-mono align-top">
                      {lineTotalHT.toFixed(3)}
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
              <h4 className="font-bold mb-2">{t.vatSummary}</h4>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="font-semibold text-left">{t.rate}</th>
                    <th className="font-semibold text-right">{t.base}</th>
                    <th className="font-semibold text-right">{t.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {[19, 13, 7, 0].map((rate) => {
                    const base = invoice.invoice_lines
                      .filter((l: any) => l.tva_rate === rate)
                      .reduce(
                        (s: number, l: any) => s + l.quantity * l.unit_price_ht * (1 - l.remise_percentage / 100),
                        0,
                      )
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
                <span className="font-sans text-muted-foreground">{t.totalHTNet}</span>
                <span>
                  {invoice.total_ht.toFixed(3)} {currencySymbol}
                </span>
              </div>
              {invoice.total_fodec > 0 && (
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">{t.fodec}</span>
                  <span>
                    + {invoice.total_fodec.toFixed(3)} {currencySymbol}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">{t.totalVAT}</span>
                <span>
                  + {invoice.total_tva.toFixed(3)} {currencySymbol}
                </span>
              </div>
              {invoice.has_stamp && (
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">{t.stampDuty}</span>
                  <span>+ 1.000 {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span className="font-sans">{t.totalTTC}</span>
                <span>
                  {invoice.total_ttc.toFixed(3)} {currencySymbol}
                </span>
              </div>
              {invoice.has_withholding_tax && (
                <>
                  <div className="flex justify-between text-red-600">
                    <span className="font-sans">{t.withholding}</span>
                    <span>
                      - {invoice.withholding_tax_amount.toFixed(3)} {currencySymbol}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t-2 pt-2 mt-2 text-emerald-600">
                    <span className="font-sans">{t.netToPay}</span>
                    <span>
                      {netToPay.toFixed(3)} {currencySymbol}
                    </span>
                  </div>
                </>
              )}
            </div>
          </footer>

          <div className="mt-4 text-xs">
            <h4 className="font-bold mb-1">{t.notesAndConditions}</h4>
            <p className="whitespace-pre-wrap">{invoice.notes || t.noConditions}</p>
          </div>

          <div className="mt-4 pt-4 border-t text-[8pt] italic text-gray-600">
            {totalInWords(invoice.total_ttc, netToPay, invoice.has_withholding_tax)}
          </div>
        </div>
      </div>
    </div>
  )
}
