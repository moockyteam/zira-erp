// Fichier : components/delivery-notes/delivery-note-preview.tsx

"use client"
import Image from "next/image"
export function DeliveryNotePreview({ deliveryNote }: { deliveryNote: any }) {
if (!deliveryNote) return null
const isFodecApplicable = deliveryNote.total_fodec > 0
return (
<div className="bg-white text-black font-sans text-[10pt] print:text-[9pt]">
<div className="max-w-4xl mx-auto p-8 print:p-4" style={{ width: "210mm", minHeight: "297mm" }}>
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
<h1 className="text-2xl font-bold tracking-wide">BON DE LIVRAISON</h1>
<p>
<span className="font-semibold">Numéro :</span> {deliveryNote.delivery_note_number}
</p>
<p>
<span className="font-semibold">Date d'Expédition/Livraison :</span>{" "}
{new Date(deliveryNote.delivery_date).toLocaleDateString("fr-FR")}
</p>
</div>
</header>
<section className="mb-6 grid grid-cols-2 gap-4 text-xs">
      <div className="p-3 border rounded-md bg-gray-50">
        <h3 className="font-bold text-gray-600 mb-1">CLIENT</h3>
        <p className="text-base font-bold">{deliveryNote.customers?.name}</p>
        <p>{[deliveryNote.customers?.street, deliveryNote.customers?.delegation, deliveryNote.customers?.governorate, deliveryNote.customers?.country].filter(Boolean).join(', ')}</p>
        {deliveryNote.customers?.matricule_fiscal && <p>MF: {deliveryNote.customers.matricule_fiscal}</p>}
      </div>
      <div className="p-3 border rounded-md bg-gray-50">
        <h3 className="font-bold text-gray-600 mb-1">ADRESSE DE LIVRAISON</h3>
        <p className="whitespace-pre-wrap">{deliveryNote.delivery_address || "Non spécifiée"}</p>
      </div>
    </section>

    <section className="text-xs border p-3 rounded-md mb-6 bg-gray-50">
      <h4 className="font-bold mb-1 text-gray-600">INFORMATIONS DE TRANSPORT</h4>
      <p><span className="font-semibold">Chauffeur:</span> {deliveryNote.driver_name || "N/A"} | <span className="font-semibold">Véhicule:</span> {deliveryNote.vehicle_registration || "N/A"}</p>
    </section>

    <div className="mb-6">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border font-semibold w-[50%]">Description / Article</th>
            <th className="p-2 border font-semibold text-right">Qté</th>
            {deliveryNote.is_valued && <th className="p-2 border font-semibold text-right">Prix U. HT</th>}
            {deliveryNote.is_valued && deliveryNote.show_remise_column && <th className="p-2 border font-semibold text-right">Remise %</th>}
            {deliveryNote.is_valued && <th className="p-2 border font-semibold text-right">Total HT</th>}
          </tr>
        </thead>
        <tbody>
          {deliveryNote.delivery_note_lines.map((line: any) => {
            const lineTotalHT = line.quantity * line.unit_price_ht * (1 - (line.remise_percentage || 0) / 100)
            return (
              <tr key={line.id}>
                <td className="p-2 border">{line.description}</td>
                <td className="p-2 border text-right">{line.quantity}</td>
                {deliveryNote.is_valued && <td className="p-2 border text-right font-mono">{line.unit_price_ht.toFixed(3)}</td>}
                {deliveryNote.is_valued && deliveryNote.show_remise_column && <td className="p-2 border text-right font-mono">{(line.remise_percentage || 0).toFixed(2)}%</td>}
                {deliveryNote.is_valued && <td className="p-2 border text-right font-mono font-semibold">{lineTotalHT.toFixed(3)}</td>}
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
                  const base = deliveryNote.delivery_note_lines
                    .filter((l: any) => l.tva_rate === rate)
                    .reduce((s: number, l: any) => s + l.quantity * l.unit_price_ht * (1 - (l.remise_percentage || 0) / 100), 0)
                  if (base === 0) return null
                  const base_fodec =
                    base + (isFodecApplicable ? base * (1 - (deliveryNote.escompte_percentage || 0) / 100) * 0.01 : 0)
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
              <span>{deliveryNote.total_ht.toFixed(3)}</span>
            </div>
            {deliveryNote.total_escompte > 0 && (
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">Escompte</span>
                <span>- {deliveryNote.total_escompte.toFixed(3)}</span>
              </div>
            )}
            {isFodecApplicable && (
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">FODEC (1%)</span>
                <span>+ {deliveryNote.total_fodec.toFixed(3)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">Total TVA</span>
              <span>+ {deliveryNote.total_tva.toFixed(3)}</span>
            </div>
            {deliveryNote.has_stamp && (
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">Timbre Fiscal</span>
                <span>+ 1.000</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span className="font-sans">Total TTC</span>
              <span>{deliveryNote.total_ttc.toFixed(3)} TND</span>
            </div>
          </div>
        </div>
      </footer>
    )}

    <div className="mt-4 text-xs">
      <h4 className="font-bold mb-1">Notes</h4>
      <p className="whitespace-pre-wrap">{deliveryNote.notes || "Aucune note spécifiée."}</p>
    </div>

    <div className="pt-16" style={{ pageBreakInside: "avoid" }}>
      <div className="grid grid-cols-2 gap-8 items-end">
        <div className="text-center">
          <p className="text-sm font-semibold">Cachet & Signature</p>
          <div className="border-t mt-16"></div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">Réceptionné par le client</p>
          <div className="border-t mt-16 pt-2">
            <p className="text-xs">(Nom, Cachet et Signature précédés de la mention "Reçu le")</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
)
}