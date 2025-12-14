"use client"

import Image from "next/image"

export function ReturnVoucherPreview({ returnVoucher }: { returnVoucher: any }) {
  // Sécurité pour éviter un crash si les données sont manquantes
  if (!returnVoucher) {
    return (
      <div className="p-8 text-center text-red-500">
        Erreur : Impossible de charger les données du bon de retour pour l'aperçu.
      </div>
    );
  }

  return (
    <div className="bg-white text-black font-sans text-[10pt] print:text-[9pt]">
      <div className="max-w-4xl mx-auto p-8 print:p-4" style={{ width: "210mm", minHeight: "297mm" }}>
        <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-black">
          <div className="flex items-center gap-4">
            {returnVoucher.companies?.logo_url && (
              <div className="relative w-24 h-24 print:w-20 print:h-20 flex-shrink-0">
                <Image
                  src={returnVoucher.companies.logo_url}
                  alt="Logo de l'entreprise"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="text-xs">
              <h2 className="text-xl font-bold">{returnVoucher.companies?.name}</h2>
              <p>Adresse: {returnVoucher.companies?.address}</p>
              <p>Matricule Fiscal: {returnVoucher.companies?.matricule_fiscal}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <h1 className="text-2xl font-bold tracking-wide">BON DE RETOUR</h1>
            <p>
              <span className="font-semibold">Numéro :</span> {returnVoucher.return_voucher_number}
            </p>
            <p>
              <span className="font-semibold">Date du Retour :</span>{" "}
              {new Date(returnVoucher.return_date).toLocaleDateString("fr-FR")}
            </p>
            {returnVoucher.source_document_ref && (
              <p>
                <span className="font-semibold">Réf. Document d'origine :</span> {returnVoucher.source_document_ref}
              </p>
            )}
          </div>
        </header>

        <section className="mb-6 text-xs">
          <div className="p-3 border rounded-md bg-gray-50">
            <h3 className="font-bold text-gray-600 mb-1">CLIENT</h3>
            <p className="text-base font-bold break-words">{returnVoucher.customers?.name}</p>
            <p>
              Adresse: {[
                returnVoucher.customers?.street,
                returnVoucher.customers?.delegation,
                returnVoucher.customers?.governorate,
                returnVoucher.customers?.country
              ].filter(Boolean).join(', ')}
            </p>
            <p>Téléphone: {returnVoucher.customers?.phone_number}</p>
            <p>Matricule Fiscal: {returnVoucher.customers?.matricule_fiscal}</p>
          </div>
        </section>

        <section className="text-xs border p-3 rounded-md mb-6 bg-gray-50">
          <h4 className="font-bold mb-1 text-gray-600">INFORMATIONS DE TRANSPORT</h4>
          <p><span className="font-semibold">Chauffeur:</span> {returnVoucher.driver_name || "N/A"}</p>
          <p><span className="font-semibold">Véhicule:</span> {returnVoucher.vehicle_registration || "N/A"}</p>
        </section>

        <div className="mb-6">
          <h3 className="font-bold mb-2">Articles Retournés</h3>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border-2 border-gray-800 font-semibold w-[20%]">Référence</th>
                <th className="p-2 border-2 border-gray-800 font-semibold w-[40%]">Désignation</th>
                <th className="p-2 border-2 border-gray-800 font-semibold text-right">Quantité Retournée</th>
                <th className="p-2 border-2 border-gray-800 font-semibold">Raison du Retour</th>
              </tr>
            </thead>
            <tbody>
              {returnVoucher.return_voucher_lines && returnVoucher.return_voucher_lines.length > 0 ? (
                returnVoucher.return_voucher_lines.map((line: any) => (
                  <tr key={line.id}>
                    <td className="p-2 border-2 border-gray-800 align-top">{line.items?.reference || "N/A"}</td>
                    <td className="p-2 border-2 border-gray-800 align-top">{line.items?.name}</td>
                    <td className="p-2 border-2 border-gray-800 text-right align-top">{line.quantity}</td>
                    <td className="p-2 border-2 border-gray-800 align-top">{line.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 border-2 border-gray-800 text-center text-muted-foreground">
                    Aucun article sur ce bon de retour.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-16" style={{ pageBreakInside: "avoid" }}>
          <div className="grid grid-cols-2 gap-8 items-end">
            <div className="text-center">
              <p className="text-sm font-semibold">Cachet & Signature (Fournisseur)</p>
              <div className="border-t mt-16"></div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Signature (Client)</p>
              <div className="border-t mt-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}