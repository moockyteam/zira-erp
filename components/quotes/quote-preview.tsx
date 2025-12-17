"use client"

import writtenNumber from "written-number"
import Image from "next/image"
import { TRANSLATIONS, type Language } from "@/lib/translations"

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = {
    TND: "TND",
    USD: "$",
    EUR: "€",
  }
  return symbols[currency] || currency
}

type QuotePreviewData = {
  id: string
  quote_number: string
  quote_date: string
  currency: string
  prospect_name: string | null
  prospect_address: string | null
  prospect_email: string | null
  prospect_phone: string | null
  terms_and_conditions: string | null
  has_stamp: boolean
  show_remise_column: boolean
  total_ttc: number
  companies: { name: string; address: string | null; matricule_fiscal: string | null; logo_url: string | null } | null
  customers: { name: string; address: string | null; matricule_fiscal: string | null } | null
  quote_lines: {
    id: string
    description: string
    quantity: number
    unit_price_ht: number
    remise_percentage: number
    tva_rate: number
    items: { reference: string | null } | null
  }[]
  total_ht: number
  total_remise: number
  total_fodec: number
  total_tva: number
}

export function QuotePreview({ quote, language = "fr" }: { quote: QuotePreviewData; language?: string }) {
  if (!quote) return null

  const t = TRANSLATIONS[language as Language] || TRANSLATIONS.fr
  const currencySymbol = getCurrencySymbol(quote.currency || "TND")

  const totalInWords = (total: number) => {
    if (total <= 0) return ""
    const [integerPart, decimalPart] = total.toFixed(3).split(".")
    const langCode = language === "fr" ? "fr" : language === "es" ? "es" : language === "pt" ? "pt" : "en"
    const integerWords = writtenNumber(Number.parseInt(integerPart), { lang: langCode })
    const decimalWords = writtenNumber(Number.parseInt(decimalPart), { lang: langCode })
    const currencyName = quote.currency === "USD" ? t.dollars : quote.currency === "EUR" ? t.euros : t.dinars
    const smallUnit = quote.currency === "TND" ? t.millimes : t.centimes
    return `${t.quoteAmountInWords} : ${integerWords} ${currencyName} ${language === "fr" ? "et" : "and"} ${decimalWords} ${smallUnit}.`
  }

  return (
    <div className="bg-white p-4">
      <div className="max-w-4xl mx-auto font-sans text-black text-sm">
        <header className="grid grid-cols-2 gap-8 mb-10 border-b-2 border-black pb-4">
          <div>
            {quote.companies?.logo_url && (
              <div className="relative w-20 h-20 mb-2">
                <Image
                  src={quote.companies.logo_url || "/placeholder.svg"}
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <h2 className="text-xl font-bold">{quote.companies?.name}</h2>
            <p className="text-xs">{quote.companies?.address}</p>
            <p className="text-xs">MF: {quote.companies?.matricule_fiscal}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-wide">{t.quoteNumber.replace("N°", quote.quote_number)}</h1>
            <p>
              {t.date} :{" "}
              {new Date(quote.quote_date).toLocaleDateString(
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
            <div className="mt-4 p-3 border rounded-md bg-gray-50 text-left">
              <h3 className="font-bold text-gray-600 mb-1">{t.recipient}</h3>
              <p className="text-lg font-bold break-words">{quote.customers?.name || quote.prospect_name}</p>
              <p className="text-sm">{quote.customers?.address || quote.prospect_address}</p>
              {quote.customers?.matricule_fiscal && <p className="text-sm">MF: {quote.customers.matricule_fiscal}</p>}
              {!quote.customers && quote.prospect_email && <p className="text-sm">Email: {quote.prospect_email}</p>}
              {!quote.customers && quote.prospect_phone && <p className="text-sm">Tél: {quote.prospect_phone}</p>}
            </div>
          </div>
        </header>

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border font-semibold">{t.designation}</th>
                <th className="p-2 border font-semibold text-right">{t.quantity}</th>
                <th className="p-2 border font-semibold text-right">{t.unitPriceHT}</th>
                {quote.show_remise_column && <th className="p-2 border font-semibold text-right">{t.discount}</th>}
                <th className="p-2 border font-semibold text-right">{t.vat}</th>
                <th className="p-2 border font-semibold text-right">{t.totalHT}</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_lines.map((line, index) => {
                const lineTotalHT = line.quantity * line.unit_price_ht * (1 - (line.remise_percentage || 0) / 100)
                return (
                  <tr key={line.id || index}>
                    <td className="p-2 border">{line.description}</td>
                    <td className="p-2 border text-right">{line.quantity}</td>
                    <td className="p-2 border text-right">{line.unit_price_ht.toFixed(3)}</td>
                    {quote.show_remise_column && (
                      <td className="p-2 border text-right">{(line.remise_percentage || 0).toFixed(2)}%</td>
                    )}
                    <td className="p-2 border text-right">{line.tva_rate.toFixed(2)}%</td>
                    <td className="p-2 border text-right font-medium">{lineTotalHT.toFixed(3)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer className="mt-10 grid grid-cols-2 gap-8">
          <div className="text-xs">
            <h4 className="font-bold mb-2">{t.notesAndConditions}</h4>
            <p className="whitespace-pre-wrap">{quote.terms_and_conditions || t.noConditions}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md border">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>{t.totalHTNet} :</span>
                <span className="font-mono">
                  {quote.total_ht.toFixed(3)} {currencySymbol}
                </span>
              </div>
              {quote.total_fodec > 0 && (
                <div className="flex justify-between">
                  <span>{t.fodec} :</span>
                  <span className="font-mono">
                    + {quote.total_fodec.toFixed(3)} {currencySymbol}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t.totalVAT} :</span>
                <span className="font-mono">
                  + {quote.total_tva.toFixed(3)} {currencySymbol}
                </span>
              </div>
              {quote.has_stamp && (
                <div className="flex justify-between">
                  <span>{t.stampDuty} :</span>
                  <span className="font-mono">+ 1.000 {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>{t.totalTTC} :</span>
                <span className="font-mono">
                  {quote.total_ttc.toFixed(3)} {currencySymbol}
                </span>
              </div>
            </div>
          </div>
        </footer>
        <div className="mt-8 pt-4 border-t text-xs italic text-gray-600">{totalInWords(quote.total_ttc)}</div>
      </div>
    </div>
  )
}
