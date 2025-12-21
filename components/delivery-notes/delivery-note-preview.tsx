"use client"
import Image from "next/image"
import { TRANSLATIONS, type Language } from "@/lib/translations"

export function DeliveryNotePreview({ deliveryNote, language = "fr" }: { deliveryNote: any; language?: string }) {
  if (!deliveryNote) return null

  const t = TRANSLATIONS[language as Language] || TRANSLATIONS.fr
  const isFodecApplicable = deliveryNote.total_fodec > 0

  const calculatedTotalHT = deliveryNote.delivery_note_lines.reduce(
    (sum: number, l: any) =>
      sum + l.quantity * l.unit_price_ht * (1 - (l.remise_percentage || 0) / 100),
    0,
  )

  const calculatedTotalTVA = [19, 13, 7, 0].reduce((acc, rate) => {
    const linesForRate = deliveryNote.delivery_note_lines.filter((l: any) => l.tva_rate === rate)
    const base = linesForRate.reduce(
      (s: number, l: any) => s + l.quantity * l.unit_price_ht * (1 - (l.remise_percentage || 0) / 100),
      0,
    )
    const base_fodec =
      base + (isFodecApplicable ? base * (1 - (deliveryNote.escompte_percentage || 0) / 100) * 0.01 : 0)
    const amount = base_fodec * (rate / 100)
    return acc + amount
  }, 0)

  const stampAmount = deliveryNote.has_stamp ? 1.0 : 0
  const fodecAmount = isFodecApplicable ? deliveryNote.total_fodec : 0
  const escompteAmount = deliveryNote.total_escompte || 0

  const displayTotalHT = deliveryNote.total_ht || calculatedTotalHT
  const displayTotalTVA = deliveryNote.total_tva || calculatedTotalTVA
  const displayTotalTTC =
    deliveryNote.total_ttc || displayTotalHT - escompteAmount + fodecAmount + displayTotalTVA + stampAmount

  return (
    <div className="bg-white text-black font-sans text-[10pt] print:text-[9pt]">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          body { margin: 0px; }
        `}
      </style>
      <div className="max-w-4xl mx-auto p-8 print:p-8 min-h-[297mm] print:min-h-0 print:w-full" style={{ width: "210mm" }}>
        <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-black">
          <div className="flex items-center gap-4">
            {deliveryNote.companies?.logo_url && (
              <div className="relative w-24 h-24 print:w-20 print:h-20 flex-shrink-0">
                <Image
                  src={deliveryNote.companies.logo_url || "/placeholder.svg"}
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="text-xs">
              <h2 className="text-xl font-bold">{deliveryNote.companies?.name}</h2>
              <p>Adresse: {deliveryNote.companies?.address}</p>
              <p>Matricule Fiscal: {deliveryNote.companies?.matricule_fiscal}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <h1 className="text-2xl font-bold tracking-wide">{t.deliveryNote}</h1>
            <p>
              <span className="font-semibold">{t.invoiceNumber} :</span> {deliveryNote.delivery_note_number}
            </p>
            <p>
              <span className="font-semibold">{t.deliveryDate} :</span>{" "}
              {new Date(deliveryNote.delivery_date).toLocaleDateString(
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
        <section className="mb-6 grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 border rounded-md bg-gray-50">
            <h3 className="font-bold text-gray-600 mb-1">{t.client}</h3>
            <p className="text-base font-bold">{deliveryNote.customers?.name}</p>
            <p>
              {[
                deliveryNote.customers?.street,
                deliveryNote.customers?.delegation,
                deliveryNote.customers?.governorate,
                deliveryNote.customers?.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {deliveryNote.customers?.matricule_fiscal && <p>MF: {deliveryNote.customers.matricule_fiscal}</p>}
          </div>
          <div className="p-3 border rounded-md bg-gray-50">
            <h3 className="font-bold text-gray-600 mb-1">{t.deliveryAddress}</h3>
            <p className="whitespace-pre-wrap">{deliveryNote.delivery_address || t.notSpecified}</p>
          </div>
        </section>

        <section className="text-xs border p-3 rounded-md mb-6 bg-gray-50">
          <h4 className="font-bold mb-1 text-gray-600">{t.transportInfo}</h4>
          <p>
            <span className="font-semibold">{t.driver}:</span> {deliveryNote.driver_name || "N/A"} |{" "}
            <span className="font-semibold">{t.vehicle}:</span> {deliveryNote.vehicle_registration || "N/A"}
          </p>
        </section>

        <div className="mb-6">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border font-semibold w-[50%]">{t.description}</th>
                <th className="p-2 border font-semibold text-right">{t.quantity}</th>
                {deliveryNote.is_valued && <th className="p-2 border font-semibold text-right">{t.unitPriceHT}</th>}
                {deliveryNote.is_valued && deliveryNote.show_remise_column && (
                  <th className="p-2 border font-semibold text-right">{t.discount}</th>
                )}
                {deliveryNote.is_valued && <th className="p-2 border font-semibold text-right">{t.unitPriceTTC}</th>}
                {deliveryNote.is_valued && <th className="p-2 border font-semibold text-right">{t.totalHT}</th>}
              </tr>
            </thead>
            <tbody>
              {deliveryNote.delivery_note_lines.map((line: any) => {
                const unitPriceTTC = line.unit_price_ht * (1 + line.tva_rate / 100)
                const lineTotalHT = line.quantity * line.unit_price_ht * (1 - (line.remise_percentage || 0) / 100)
                return (
                  <tr key={line.id}>
                    <td className="p-2 border">{line.description}</td>
                    <td className="p-2 border text-right">{line.quantity}</td>
                    {deliveryNote.is_valued && (
                      <td className="p-2 border text-right font-mono">{line.unit_price_ht.toFixed(3)}</td>
                    )}
                    {deliveryNote.is_valued && deliveryNote.show_remise_column && (
                      <td className="p-2 border text-right font-mono">{(line.remise_percentage || 0).toFixed(2)}%</td>
                    )}

                    {deliveryNote.is_valued && (
                      <td className="p-2 border text-right font-mono">{unitPriceTTC.toFixed(3)}</td>
                    )}

                    {deliveryNote.is_valued && (
                      <td className="p-2 border text-right font-mono font-semibold">{lineTotalHT.toFixed(3)}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {deliveryNote.is_valued && (
          <footer className="pt-4" style={{ pageBreakInside: "avoid" }}>
            <div className="grid grid-cols-2 gap-4 items-start">
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
                      const base = deliveryNote.delivery_note_lines
                        .filter((l: any) => l.tva_rate === rate)
                        .reduce(
                          (s: number, l: any) =>
                            s + l.quantity * l.unit_price_ht * (1 - (l.remise_percentage || 0) / 100),
                          0,
                        )
                      if (base === 0) return null
                      const base_fodec =
                        base +
                        (isFodecApplicable ? base * (1 - (deliveryNote.escompte_percentage || 0) / 100) * 0.01 : 0)
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
                  <span>{displayTotalHT.toFixed(3)}</span>
                </div>
                {deliveryNote.total_escompte > 0 && (
                  <div className="flex justify-between">
                    <span className="font-sans text-muted-foreground">{t.discount_label}</span>
                    <span>- {deliveryNote.total_escompte.toFixed(3)}</span>
                  </div>
                )}
                {isFodecApplicable && (
                  <div className="flex justify-between">
                    <span className="font-sans text-muted-foreground">{t.fodec}</span>
                    <span>+ {deliveryNote.total_fodec.toFixed(3)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-sans text-muted-foreground">{t.totalVAT}</span>
                  <span>+ {displayTotalTVA.toFixed(3)}</span>
                </div>
                {deliveryNote.has_stamp && (
                  <div className="flex justify-between">
                    <span className="font-sans text-muted-foreground">{t.stampDuty}</span>
                    <span>+ 1.000</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span className="font-sans">{t.totalTTC}</span>
                  <span>{displayTotalTTC.toFixed(3)} TND</span>
                </div>
              </div>
            </div>
          </footer>
        )}

        <div className="mt-4 text-xs">
          <h4 className="font-bold mb-1">{t.notes}</h4>
          <p className="whitespace-pre-wrap">{deliveryNote.notes || t.noNotes}</p>
        </div>

        {(deliveryNote.bank_name || deliveryNote.iban || deliveryNote.rib || deliveryNote.bic_swift) && (
          <div className="mt-4 p-3 border rounded-md bg-gray-50 text-xs">
            <h4 className="font-bold mb-2 text-gray-700">{t.bankDetails || "Coordonnées Bancaires"}</h4>
            <div className="grid grid-cols-2 gap-2">
              {deliveryNote.bank_name && (
                <div>
                  <span className="font-semibold">Banque:</span> {deliveryNote.bank_name}
                </div>
              )}
              {deliveryNote.rib && (
                <div>
                  <span className="font-semibold">RIB:</span> {deliveryNote.rib}
                </div>
              )}
              {deliveryNote.iban && (
                <div className="col-span-2">
                  <span className="font-semibold">IBAN:</span> {deliveryNote.iban}
                </div>
              )}
              {deliveryNote.bic_swift && (
                <div>
                  <span className="font-semibold">BIC/SWIFT:</span> {deliveryNote.bic_swift}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-16" style={{ pageBreakInside: "avoid" }}>
          <div className="grid grid-cols-2 gap-8 items-end">
            <div className="text-center">
              <p className="text-sm font-semibold">{t.stampAndSignature}</p>
              <div className="border-t mt-16"></div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">{t.receivedByClient}</p>
              <div className="border-t mt-16 pt-2">
                <p className="text-xs">{t.receivedMention}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {deliveryNote.show_manager_name && deliveryNote.companies?.manager_name && (
        <div className="mt-8 text-left text-xs">
          <p className="font-semibold">Le Gérant:</p>
          <p className="mt-1">{deliveryNote.companies.manager_name}</p>
        </div>
      )}
    </div>
  )
}
