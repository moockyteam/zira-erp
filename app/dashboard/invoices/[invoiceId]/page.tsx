// Fichier : app/dashboard/invoices/[invoiceId]/page.tsx

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import Link from "next/link";

export default async function InvoiceEditorPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ invoiceId: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { invoiceId } = await params;
  const resolvedSearchParams = await searchParams;
  const fromQuoteId = resolvedSearchParams.fromQuote as string | undefined; 
  
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, is_subject_to_fodec')
    .eq('user_id', user.id);

  if (!companies || companies.length === 0) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Aucune entreprise trouvée</h1>
        <p className="mb-6">Vous devez d'abord créer une entreprise avant de pouvoir créer une facture.</p>
        <Link href="/dashboard/companies" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
          Créer ma première entreprise
        </Link>
      </div>
    );
  }

  let companyIdForData = companies[0].id; 
  let quoteInitialData = null; 
  
  if (fromQuoteId) {
    const { data: quoteData } = await supabase
      .from('quotes')
      .select('*, quote_lines(*)') 
      .eq('id', fromQuoteId)
      .single();
    quoteInitialData = quoteData;
    if (quoteData) {
      companyIdForData = quoteData.company_id;
    }
  }

  const isNew = invoiceId === 'new';
  let invoiceData = null;

  if (!isNew) {
    const { data } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('id', invoiceId)
      .single();
    
    if (!data) {
      return redirect('/dashboard/invoices');
    }
    invoiceData = data;
    companyIdForData = data.company_id;
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, balance')
    .eq('company_id', companyIdForData);

  const { data: items } = await supabase
    .from('items')
    .select('id, name, sale_price, reference, quantity_on_hand')
    .eq('company_id', companyIdForData);
    
  const { data: confirmedQuotes } = await supabase
    .from('quotes')
    .select('id, quote_number')
    .eq('company_id', companyIdForData)
    .eq('status', 'CONFIRME');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          {isNew ? "Créer une nouvelle Facture" : `Modifier la Facture`}
        </h1>
        
        <InvoiceForm 
          initialData={invoiceData}
          quoteInitialData={quoteInitialData} 
          companies={companies}
          customers={customers || []}
          items={items || []}
          confirmedQuotes={confirmedQuotes || []}
        />
      </div>
    </div>
  );
}