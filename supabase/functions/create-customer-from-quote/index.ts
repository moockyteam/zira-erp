// Fichier : /supabase/functions/create-customer-from-quote/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record: quote } = await req.json()

    if (!quote || !quote.prospect_name || quote.customer_id) {
      return new Response(JSON.stringify({ message: 'No action needed. Either not a prospect or already linked.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[START] Processing quote ID: ${quote.id} for prospect: ${quote.prospect_name}`);
    
    // On utilise les clés d'admin pour outrepasser les policies RLS si nécessaire
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Étape 1 : Créer le nouveau client
    const customerPayload = {
      company_id: quote.company_id,
      name: quote.prospect_name,
      customer_type: 'ENTREPRISE', // Valeur par défaut
      balance: 0 // On initialise le solde à 0
    };
    console.log("Attempting to create customer with payload:", customerPayload);

    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert(customerPayload)
      .select('id')
      .single();

    if (customerError) {
      console.error("[ERROR] creating customer:", customerError);
      throw new Error(`Failed to create customer: ${customerError.message}`);
    }
    
    console.log(`[SUCCESS] Customer created with ID: ${newCustomer.id}`);

    // Étape 2 : Mettre à jour le devis pour le lier au nouveau client
    const quoteUpdatePayload = {
      customer_id: newCustomer.id,
      prospect_name: null,
    };
    console.log("Attempting to update quote with payload:", quoteUpdatePayload);
    
    const { error: quoteUpdateError } = await supabaseAdmin
      .from('quotes')
      .update(quoteUpdatePayload)
      .eq('id', quote.id);

    if (quoteUpdateError) {
      console.error("[ERROR] updating quote:", quoteUpdateError);
      // Si la mise à jour du devis échoue, on devrait idéalement supprimer le client créé
      // Pour l'instant, on se contente de signaler l'erreur
      throw new Error(`Failed to update quote: ${quoteUpdateError.message}`);
    }
    
    console.log(`[SUCCESS] Quote ID ${quote.id} linked to new customer.`);

    return new Response(JSON.stringify({ message: `Customer ${quote.prospect_name} created.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error("[FATAL] Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // On retourne une erreur 500 pour mieux voir le problème
    });
  }
})
