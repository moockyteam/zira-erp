// Fichier : /supabase/functions/get-next-invoice-number/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Edge Function 'get-next-invoice-number' started.");

Deno.serve(async (req) => {
  // Gère la requête preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // --- CORRECTION: Logique de parsing du body plus robuste ---
    // On vérifie que la requête contient bien un corps
    if (!req.body) {
      throw new Error("Request body is missing.");
    }
    const body = await req.json(); // On parse le JSON
    const companyId = body.companyId; // On extrait la propriété 'companyId'
    
    console.log("Request for companyId:", companyId);

    if (!companyId) {
      throw new Error("L'ID de l'entreprise est manquant dans le corps de la requête.");
    }
    
    const currentYear = new Date().getFullYear();

    // La requête à la base de données reste la même
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number')
      .eq('company_id', companyId)
      .like('invoice_number', `FAC-${currentYear}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // PGRST116 signifie "zero rows returned", ce qui est normal pour la première facture
    if (error && error.code !== 'PGRST116') {
      console.error("Supabase query error:", error);
      throw error;
    }

    let nextNumber = 1;
    if (data && data.invoice_number) {
      const lastNumberStr = data.invoice_number.split('-').pop();
      if (lastNumberStr) {
        const lastNumber = parseInt(lastNumberStr, 10);
        // On vérifie que la conversion a réussi avant d'incrémenter
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }
    
    const newInvoiceNumber = `FAC-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
    console.log("Generated new invoice number:", newInvoiceNumber);

    // La réponse en cas de succès reste la même
    return new Response(
      JSON.stringify({ invoice_number: newInvoiceNumber }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    // La réponse en cas d'erreur reste la même
    console.error("[FUNCTION ERROR]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
