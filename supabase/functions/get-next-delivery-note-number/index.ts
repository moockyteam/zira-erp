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

    // Récupérer le numéro de départ configuré
    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('delivery_note_start_number')
      .eq('id', companyId)
      .single();

    const startNumber = companyData?.delivery_note_start_number || 1;

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

    let nextNumber = startNumber;
    if (data && data.delivery_note_number) {
      const lastNumberStr = data.delivery_note_number.split('-').pop();
      if (lastNumberStr) {
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = Math.max(lastNumber + 1, startNumber);
        }
      }
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
