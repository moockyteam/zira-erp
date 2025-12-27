// Fichier : /supabase/functions/get-next-quote-number/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (!req.body) {
            throw new Error("Request body is missing.");
        }
        const { companyId } = await req.json();

        if (!companyId) {
            throw new Error("L'ID de l'entreprise est manquant.");
        }

        const currentYear = new Date().getFullYear();

        // Récupérer le numéro de départ configuré
        const { data: companyData } = await supabaseAdmin
            .from('companies')
            .select('quote_start_number')
            .eq('id', companyId)
            .single();

        const startNumber = companyData?.quote_start_number || 1;

        // Récupérer le dernier devis
        const { data, error } = await supabaseAdmin
            .from('quotes')
            .select('quote_number')
            .eq('company_id', companyId)
            .like('quote_number', `DEVIS-${currentYear}-%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        let nextNumber = startNumber;
        if (data && data.quote_number) {
            const parts = data.quote_number.split('-');
            // Format: DEVIS-2025-001
            const lastNumberStr = parts[parts.length - 1];
            if (lastNumberStr) {
                const lastNumber = parseInt(lastNumberStr, 10);
                if (!isNaN(lastNumber)) {
                    // Ensure strictly greater than last number
                    // And at least startNumber
                    nextNumber = Math.max(lastNumber + 1, startNumber);
                }
            }
        }

        const newQuoteNumber = `DEVIS-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

        return new Response(
            JSON.stringify({ quote_number: newQuoteNumber }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
