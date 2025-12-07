// components/quotes/quote-preview.tsx

'use client'

import writtenNumber from 'written-number';
import Image from 'next/image';

type QuoteLinePreview = {
  id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  remise_percentage: number;
  tva_rate: number;
  items: { reference: string | null } | null;
};

type CompanyPreview = {
  id: string;
  name: string;
  address: string | null;
  matricule_fiscal: string | null;
  logo_url: string | null;
  is_subject_to_fodec: boolean | null;
};

type CustomerPreview = {
  id: string;
  name: string;
  address: string | null;
  matricule_fiscal: string | null;
};

interface QuotePreviewData {
  id: string;
  quote_number: string;
  quote_date: string;
  prospect_name: string | null;
  terms_and_conditions: string | null;
  has_stamp: boolean;

  total_ht: number;
  total_remise: number;
  escompte_percentage: number;
  total_escompte: number;
  total_fodec: number;
  total_tva: number;
  total_ttc: number;

  companies: CompanyPreview | null;
  customers: CustomerPreview | null;
  quote_lines: QuoteLinePreview[];
}

export function QuotePreview({ quote }: { quote: QuotePreviewData }) {
  if (!quote) return null;

  const totalInWords = (total: number) => {
    if (total <= 0) return '';
    const [integerPart, decimalPart] = total.toFixed(3).split('.');
    const integerWords = writtenNumber(parseInt(integerPart), { lang: 'fr' });
    const decimalWords = writtenNumber(parseInt(decimalPart), { lang: 'fr' });
    return `Arrêté le présent devis à la somme de : ${integerWords} dinars et ${decimalWords} millimes.`;
  };

  return (
    <div className="bg-white p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto font-sans text-black text-sm">
        
        <header className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 border-b-2 border-black pb-4 items-start">
          <div className="flex items-center gap-4">
            {quote.companies?.logo_url && (
              <div className="relative w-20 h-20 flex-shrink-0">
                <Image src={quote.companies.logo_url} alt="Logo" fill className="object-contain" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{quote.companies?.name}</h2>
              <p className="text-xs">Adresse: {quote.companies?.address}</p>
              <p className="text-xs">Matricule Fiscal: {quote.companies?.matricule_fiscal}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <h1 className="text-2xl font-bold tracking-wide">DEVIS</h1>
            <p>Numéro : {quote.quote_number}</p>
            <p>Date : {new Date(quote.quote_date).toLocaleDateString('fr-FR')}</p>
          </div>
        </header>

        <section className="mb-10">
           <div className="w-full md:w-2/3 lg:w-1/2 p-4 border rounded-md bg-gray-50">
             <h3 className="font-bold text-gray-600 mb-1">CLIENT</h3>
                     {/* --- LA CORRECTION EST ICI --- */}
             <p className="text-lg font-bold break-words">
             {quote.customers?.name || quote.prospect_name}
             </p>
           <p className="text-sm">{quote.customers?.address}</p>
    {quote.customers?.matricule_fiscal && <p className="text-sm">MF: {quote.customers.matricule_fiscal}</p>}
  </div>
</section>

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border-b font-semibold">Réf.</th>
                <th className="p-2 border-b font-semibold w-[30%]">Désignation</th>
                <th className="p-2 border-b font-semibold text-right">Qté</th>
                <th className="p-2 border-b font-semibold text-right">Prix U. HT</th>
                <th className="p-2 border-b font-semibold text-right">Remise %</th>
                <th className="p-2 border-b font-semibold text-right">TVA %</th>
                <th className="p-2 border-b font-semibold text-right">Total HT</th>
                <th className="p-2 border-b font-semibold text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_lines.map((line: QuoteLinePreview, index: number) => {
                const lineTotalHTAfterRemise = line.quantity * line.unit_price_ht * (1 - (line.remise_percentage / 100));
                const lineTotalTTC = lineTotalHTAfterRemise * (1 + (line.tva_rate / 100));
                return (
                  <tr key={line.id || index} className="hover:bg-gray-50">
                    <td className="p-2 border-t">{line.items?.reference || 'N/A'}</td>
                    <td className="p-2 border-t">{line.description}</td>
                    <td className="p-2 border-t text-right whitespace-nowrap">{line.quantity}</td>
                    <td className="p-2 border-t text-right whitespace-nowrap">{line.unit_price_ht.toFixed(3)}</td>
                    <td className="p-2 border-t text-right whitespace-nowrap">{line.remise_percentage.toFixed(2)}%</td>
                    <td className="p-2 border-t text-right whitespace-nowrap">{line.tva_rate.toFixed(2)}%</td>
                    <td className="p-2 border-t text-right whitespace-nowrap font-medium">{lineTotalHTAfterRemise.toFixed(3)}</td>
                    <td className="p-2 border-t text-right whitespace-nowrap font-semibold">{lineTotalTTC.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 items-start">
          <div className="lg:col-span-1">
            <h4 className="font-bold mb-2">Notes et Conditions</h4>
            <p className="text-xs whitespace-pre-wrap">{quote.terms_and_conditions || "Aucune condition spécifiée."}</p>
          </div>
          <div className="lg:col-span-1 bg-gray-50 p-4 rounded-md border">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT Brut :</span><span className="font-mono">{(quote.total_ht + quote.total_remise).toFixed(3)} TND</span></div>
              {quote.total_remise > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Remises sur lignes :</span><span className="font-mono">- {quote.total_remise.toFixed(3)} TND</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT Net :</span><span className="font-mono">{quote.total_ht.toFixed(3)} TND</span></div>
              {quote.escompte_percentage > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Escompte ({quote.escompte_percentage.toFixed(2)}%) :</span>
                  <span className="font-mono">- {quote.total_escompte.toFixed(3)} TND</span>
                </div>
              )}
              {quote.total_fodec > 0 && <div className="flex justify-between text-blue-600"><span className="font-medium">FODEC (1%) :</span><span className="font-mono">+ {quote.total_fodec.toFixed(3)} TND</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Total TVA :</span><span className="font-mono">+ {quote.total_tva.toFixed(3)} TND</span></div>
              {quote.has_stamp && <div className="flex justify-between"><span className="text-muted-foreground">Timbre Fiscal :</span><span className="font-mono">1.000 TND</span></div>}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span className="font-bold">Total TTC :</span><span className="font-mono">{quote.total_ttc.toFixed(3)} TND</span></div>
            </div>
          </div>
        </footer>

        <div className="mt-8 pt-4 border-t text-xs italic text-gray-600">
          {totalInWords(quote.total_ttc)}
        </div>
      </div>
    </div>
  );
}