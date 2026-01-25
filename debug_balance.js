
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBalance() {
    console.log("🔍 Starting Balance Diagnostic...");

    // 1. Search for customer with balance near -199.984 or -399.968
    // Since float matching is tricky, we'll fetch all and filter in JS
    const { data: customers } = await supabase.from('customers').select('id, name, balance, initial_balance');

    if (!customers || customers.length === 0) {
        console.log("❌ No customers found.");
        return;
    }

    const target = customers.find(c => Math.abs(c.balance + 199.984) < 1.0 || Math.abs(c.balance + 399.968) < 1.0);

    if (!target) {
        console.log("❌ Could not find the specific client. Dumping first 3 as fallback.");
    }

    const customer = target || customers[0];
    const customerId = customer.id;

    console.log(`\n👤 Analyzing Customer: ${customer.name} (${customerId})`);
    console.log(`   DB Balance Column: ${customer.balance}`);
    console.log(`   Initial Balance: ${customer.initial_balance}`);

    // Fetch ALL potential debt/credit components

    // INVOICES
    const { data: invoices } = await supabase.from('invoices').select('id, total_ttc').eq('customer_id', customerId).not('status', 'in', '("BROUILLON","ANNULEE")');
    const totalInvoices = invoices?.reduce((s, i) => s + i.total_ttc, 0) || 0;
    console.log(`\n   [+] Invoices: ${totalInvoices.toFixed(3)} (${invoices?.length})`);

    // BLS (Unbilled)
    const { data: bls } = await supabase.from('delivery_notes').select('id, total_ttc').eq('customer_id', customerId).eq('status', 'LIVRE').is('invoice_id', null);
    const totalBls = bls?.reduce((s, b) => s + b.total_ttc, 0) || 0;
    console.log(`   [+] BLs (Unbilled): ${totalBls.toFixed(3)} (${bls?.length})`);

    // INVOICE PAYMENTS
    // Manual join for invoice payments
    let totalInvPayments = 0;
    if (invoices && invoices.length > 0) {
        // We need ALL invoices even if paid, but we filtered invoices above by status?
        // Wait, invoice_payments can belong to *archived* invoices?
        // Let's just fetch ALL invoices for this customer to get keys
        const { data: allInvoices } = await supabase.from('invoices').select('id').eq('customer_id', customerId);
        if (allInvoices && allInvoices.length > 0) {
            const { data: ip } = await supabase.from('invoice_payments').select('amount').in('invoice_id', allInvoices.map(i => i.id));
            totalInvPayments = ip?.reduce((s, p) => s + p.amount, 0) || 0;
        }
    }
    console.log(`   [-] Invoice Payments: ${totalInvPayments.toFixed(3)}`);

    // BL PAYMENTS
    let totalBlPayments = 0;
    if (true) {
        const { data: allBls } = await supabase.from('delivery_notes').select('id').eq('customer_id', customerId);
        if (allBls && allBls.length > 0) {
            const { data: bp } = await supabase.from('delivery_note_payments').select('amount').in('delivery_note_id', allBls.map(b => b.id));
            totalBlPayments = bp?.reduce((s, p) => s + p.amount, 0) || 0;
        }
    }
    console.log(`   [-] BL Payments: ${totalBlPayments.toFixed(3)}`);

    // GLOBAL PAYMENTS
    const { data: globalPayments } = await supabase.from('global_payment_entries').select('amount').eq('customer_id', customerId);
    const totalGlobal = globalPayments?.reduce((s, p) => s + p.amount, 0) || 0;
    console.log(`   [-] Global Payments: ${totalGlobal.toFixed(3)}`);

    // CUSTOMER CREDITS
    const { data: credits } = await supabase.from('customer_credits').select('amount').eq('customer_id', customerId);
    const totalCredits = credits?.reduce((s, c) => s + c.amount, 0) || 0;
    console.log(`   [-] Customer Credits: ${totalCredits.toFixed(3)}`);


    // SCENARIO A: Global Payments are separate from Inv/BL payments
    const balanceA = (customer.initial_balance || 0) + totalInvoices + totalBls - totalInvPayments - totalBlPayments - totalGlobal - totalCredits;
    // SCENARIO B: Global Payments INCLUDE Inv/BL payments (Double counting check)
    // If InvPay + BLPay ~ GlobalPay?

    console.log(`\n   --- SCENARIOS ---`);
    console.log(`   A (Sum All Payments): ${balanceA.toFixed(3)}`);
    // Calculation: Balance = Invoices + BLs - All Payments

    console.log(`   Target Balance (DB): ${customer.balance}`);
    console.log(`   Debug finished.`);
}

debugBalance();
