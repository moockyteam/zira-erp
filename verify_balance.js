
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role if available for better access, but anon might suffer from RLS if not logged in.
// Actually, I should check if I can use service role key.
// inspect_schema.js used env.local matching.

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("Fetching customers...");
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, balance, initial_balance');

    if (custError) {
        console.error("Error fetching customers:", custError);
        return;
    }

    console.log(`Found ${customers.length} customers. Checking first 5...`);

    for (const customer of customers.slice(0, 5)) {
        console.log(`\nChecking Customer: ${customer.name} (${customer.id})`);
        console.log(`DB Balance: ${customer.balance}`);
        console.log(`Initial Balance: ${customer.initial_balance}`);

        // Fetch Invoices
        const { data: invoices } = await supabase
            .from('invoices')
            .select('id, total_ttc, status')
            .eq('customer_id', customer.id);

        const validInvoices = invoices.filter(i => i.status !== 'BROUILLON' && i.status !== 'ANNULEE');
        const invoiceTotal = validInvoices.reduce((sum, i) => sum + i.total_ttc, 0);
        console.log(`Invoices Total (Valid): ${invoiceTotal}`);

        // Fetch Invoice Payments
        const { data: invPayments } = await supabase
            .from('invoice_payments')
            .select('amount, invoice_id')
            .in('invoice_id', invoices.map(i => i.id)); // Fetch all payments for these invoices
        // Note: This might miss payments if invoice IDs are empty, but here it's fine.
        // Better: use direct foreign key if possible? No, payments are linked to invoices, not customers directly usually.
        // But let's check schema for invoice_payments via inspect if needed.
        // Usually invoice_payments -> invoice -> customer.

        const invPaymentTotal = (invPayments || []).reduce((sum, p) => sum + p.amount, 0);
        console.log(`Invoice Payments Total: ${invPaymentTotal}`);

        // Fetch BLs
        const { data: bls } = await supabase
            .from('delivery_notes')
            .select('id, total_ttc, status')
            .eq('customer_id', customer.id);

        const validBls = bls.filter(b => b.status === 'LIVRE');
        const blTotal = validBls.reduce((sum, b) => sum + b.total_ttc, 0);
        console.log(`BL Total (LIVRE): ${blTotal}`);

        // Fetch BL Payments
        let blPaymentTotal = 0;
        if (bls.length > 0) {
            const { data: blPayments } = await supabase
                .from('delivery_note_payments')
                .select('amount')
                .in('delivery_note_id', bls.map(b => b.id));

            blPaymentTotal = (blPayments || []).reduce((sum, p) => sum + p.amount, 0);
        }
        console.log(`BL Payments Total: ${blPaymentTotal}`);


        // Calculation 1: Like Tooltip (Invoices - Payments + Initial)
        const calc1 = (customer.initial_balance || 0) + invoiceTotal - invPaymentTotal;
        console.log(`Calculation 1 (Tooltip-ish): ${calc1.toFixed(3)}`);

        // Calculation 2: With BLs
        const calc2 = (customer.initial_balance || 0) + invoiceTotal + blTotal - invPaymentTotal - blPaymentTotal;
        console.log(`Calculation 2 (With BLs): ${calc2.toFixed(3)}`);

        const diff1 = Math.abs(calc1 - (customer.balance || 0));
        const diff2 = Math.abs(calc2 - (customer.balance || 0));

        if (diff1 < 0.01) console.log("MATCHES Calculation 1");
        else if (diff2 < 0.01) console.log("MATCHES Calculation 2");
        else console.log("NO MATCH found.");

    }
}

verify();
