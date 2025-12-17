// Fichier: /supabase/functions/create-stock-issue-from-dn/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { record: deliveryNote } = await req.json()
    if (!deliveryNote) throw new Error('Données du BL manquantes.');

    // Règle métier : Si le BL est lié à une facture, on ne fait rien.
    if (deliveryNote.invoice_id) {
      return new Response(JSON.stringify({ message: 'Stock already handled by invoice.' }), { headers: corsHeaders });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: lines } = await supabaseAdmin
      .from('delivery_note_lines')
      .select('item_id, quantity')
      .eq('delivery_note_id', deliveryNote.id)
      .not('item_id', 'is', null);

    if (!lines || lines.length === 0) {
      return new Response(JSON.stringify({ message: 'No items to issue from stock.' }), { headers: corsHeaders });
    }

    const { data: voucher, error: voucherError } = await supabaseAdmin
      .from('stock_issue_vouchers')
      .insert({
        company_id: deliveryNote.company_id,
        reference: `BL ${deliveryNote.delivery_note_number}`,
        reason: 'Sortie de stock suite à Bon de Livraison',
      })
      .select('id')
      .single();

    if (voucherError) throw voucherError;

    const linesToInsert = lines.map(line => ({
      voucher_id: voucher.id,
      item_id: line.item_id,
      quantity: line.quantity,
    }));

    const { error: linesError } = await supabaseAdmin.from('stock_issue_voucher_lines').insert(linesToInsert);
    if (linesError) throw linesError;

    return new Response(JSON.stringify({ message: 'Stock issue created successfully.' }), { headers: corsHeaders });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
