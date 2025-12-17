// dans app/dashboard/stock-issues/print/[id]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";

export default async function PrintStockIssuePage({ 
  params,
  searchParams 
}: { 
  params: { id: string },
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // LA VRAIE CORRECTION EST ICI. AVEC 'await'.
  const supabase = await createClient();
  
  const { data: voucher, error } = await supabase
    .from('stock_issue_vouchers')
    .select(`
      *,
      companies ( name, matricule_fiscal, logo_url, address, phone_number ),
      stock_issue_voucher_lines(*, items(name, reference))
    `)
    .eq('id', params.id)
    .single();

  if (error || !voucher) {
    console.error("Erreur de chargement du bon de sortie:", error);
    return notFound();
  }

  const shouldPrint = searchParams.print === 'true';

  return (
    <div className="p-8 font-sans bg-white text-black">
      <header className="flex justify-between items-start mb-12 border-b-2 border-black pb-4">
        <div className="flex items-center gap-4">
          {voucher.companies?.logo_url && (
            <Image src={voucher.companies.logo_url} alt="Logo" width={80} height={80} className="object-contain" />
          )}
          <div>
            <h2 className="text-2xl font-bold">{voucher.companies?.name}</h2>
            <p className="text-sm">Adresse: {voucher.companies?.address}</p>
            <p className="text-sm">Matricule Fiscal: {voucher.companies?.matricule_fiscal}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-bold">Bon de Sortie</h1>
          <p>Référence : {voucher.reference}</p>
          <p>Date : {new Date(voucher.voucher_date).toLocaleDateString('fr-FR')}</p>
        </div>
      </header>

      <div className="mb-8">
        <p><strong>Motif de la sortie :</strong> {voucher.reason}</p>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Réf. Article</th>
            <th className="p-2 border">Désignation</th>
            <th className="p-2 border text-right">Quantité</th>
          </tr>
        </thead>
        <tbody>
          {voucher.stock_issue_voucher_lines.map(line => (
            // J'ai corrigé une potentielle erreur ici aussi en utilisant l'id de la ligne comme clé
            <tr key={line.id} className="border-b">
              <td className="p-2 border">{line.items?.reference}</td>
              <td className="p-2 border">{line.items?.name}</td>
              <td className="p-2 border text-right">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {shouldPrint && (
        <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
      )}
    </div>
  );
}
