// components/purchase-orders/po-preview.tsx

"use client"

import Image from "next/image"

export function PurchaseOrderPreview({ po }: { po: any }) {
  if (!po) return null

  return (
    <div className="bg-white p-8">
      <div className="max-w-4xl mx-auto font-sans text-black text-sm">
        <header className="grid grid-cols-2 gap-8 mb-10 border-b-2 border-black pb-4">
          <div>
            {po.companies?.logo_url && <Image src={po.companies.logo_url} alt="Logo" width={80} height={80} className="object-contain mb-2" />}
            <h2 className="text-xl font-bold">{po.companies?.name}</h2>
            <p className="text-xs">{po.companies?.address}</p>
            <p className="text-xs">MF: {po.companies?.matricule_fiscal}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-wide">BON DE COMMANDE</h1>
            <p>Numéro : {po.po_number}</p>
            <p>Date : {new Date(po.order_date).toLocaleDateString("fr-FR")}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 mb-10">
          <div className="p-4 border rounded-md bg-gray-50">
            <h3 className="font-bold text-gray-600 mb-1">FOURNISSEUR</h3>
            <p className="text-lg font-bold">{po.suppliers?.name}</p>
            <p className="text-sm">{po.suppliers?.address}</p>
            {po.suppliers?.matricule_fiscal && <p className="text-sm">MF: {po.suppliers.matricule_fiscal}</p>}
          </div>
          <div className="p-4 border rounded-md bg-gray-50">
            <h3 className="font-bold text-gray-600 mb-1">ADRESSE DE LIVRAISON</h3>
            <p className="text-sm whitespace-pre-wrap">{po.shipping_address || po.companies?.address}</p>
          </div>
        </section>

        <table className="w-full text-left border-collapse mb-10">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border font-semibold">Description</th>
              <th className="p-2 border font-semibold text-right">Qté</th>
              <th className="p-2 border font-semibold text-right">Prix Achat HT</th>
              <th className="p-2 border font-semibold text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {po.purchase_order_lines.map((line: any) => (
              <tr key={line.id}>
                <td className="p-2 border">{line.description}</td>
                <td className="p-2 border text-right">{line.quantity}</td>
                <td className="p-2 border text-right">{line.purchase_price_ht.toFixed(3)}</td>
                <td className="p-2 border text-right font-medium">{(line.quantity * line.purchase_price_ht).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="grid grid-cols-2 gap-8">
          <div className="text-xs">
            <h4 className="font-bold mb-2">Notes</h4>
            <p>{po.notes || "Aucune note."}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md border">
            <div className="space-y-1">
              <div className="flex justify-between"><span>Total HT :</span><span className="font-mono">{po.total_ht.toFixed(3)} TND</span></div>
              <div className="flex justify-between"><span>Total TVA :</span><span className="font-mono">{po.total_tva.toFixed(3)} TND</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total TTC :</span><span className="font-mono">{po.total_ttc.toFixed(3)} TND</span></div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
