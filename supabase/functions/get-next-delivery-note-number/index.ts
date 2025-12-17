// Fichier: /supabase/functions/get-next-delivery-note-number/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { companyId } = await req.json();
    if (!companyId) throw new Error("L'ID de l'entreprise est manquant.");
    
    const currentYear = new Date().getFullYear();
    const { data, error } = await supabaseAdmin
      .from('delivery_notes') // On cherche dans les BL
      .select('delivery_note_number')
      .eq('company_id', companyId)
      .like('delivery_note_number', `BL-${currentYear}-%`) // Préfixe BL-
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    let nextNumber = 1;
    if (data) {
      const lastNumber = parseInt(data.delivery_note_number.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }
    
    const newDnNumber = `BL-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
    return new Response(JSON.stringify({ delivery_note_number: newDnNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
