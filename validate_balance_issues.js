const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validateBalanceIssues() {
    console.log("🔍 Validating Balance Calculation Issues\n");
    console.log("This script will compare the current database balance");
    console.log("with what the balance SHOULD BE based on the correct formula.\n");

    // Fetch all customers
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, balance, initial_balance')
        .limit(20); // Check first 20 customers

    if (custError) {
        console.error("❌ Failed to fetch customers:", custError.message);
        return;
    }

    console.log(`Analyzing ${customers.length} customers...\n`);
    console.log("=".repeat(100));
    console.log(`${"Customer".padEnd(25)} ${"DB Balance".padStart(12)} ${"Correct".padStart(12)} ${"Difference".padStart(12)} ${"Status".padStart(15)}`);
    console.log("=".repeat(100));

    let totalDiscrepancies = 0;
    let totalDifference = 0;

    for (const customer of customers) {
        // Calculate what balance SHOULD be using correct formula

        // 1. Invoices
        const { data: invoices } = await supabase
            .from('invoices')
            .select('total_ttc, status')
            .eq('customer_id', customer.id);

        const invoiceTotal = (invoices || [])
            .filter(i => i.status !== 'BROUILLON' && i.status !== 'ANNULEE')
            .reduce((sum, i) => sum + (i.total_ttc || 0), 0);

        // 2. BLs (unbilled)
        const { data: bls } = await supabase
            .from('delivery_notes')
            .select('total_ttc, status, invoice_id')
            .eq('customer_id', customer.id);

        const blTotal = (bls || [])
            .filter(b => b.status === 'LIVRE' && !b.invoice_id)
            .reduce((sum, b) => sum + (b.total_ttc || 0), 0);

        // 3. Invoice Payments
        const invoiceIds = (invoices || []).map(i => i.id);
        let invPaymentTotal = 0;
        if (invoiceIds.length > 0) {
            const { data: invPayments } = await supabase
                .from('invoice_payments')
                .select('amount')
                .in('invoice_id', invoiceIds);
            invPaymentTotal = (invPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        }

        // 4. BL Payments
        const blIds = (bls || []).map(b => b.id);
        let blPaymentTotal = 0;
        if (blIds.length > 0) {
            const { data: blPayments } = await supabase
                .from('delivery_note_payments')
                .select('amount')
                .in('delivery_note_id', blIds);
            blPaymentTotal = (blPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        }

        // 5. Customer Credits
        const { data: credits } = await supabase
            .from('customer_credits')
            .select('amount')
            .eq('customer_id', customer.id);
        const creditTotal = (credits || []).reduce((sum, c) => sum + (c.amount || 0), 0);

        // Calculate CORRECT balance
        const correctBalance = (customer.initial_balance || 0)
            + invoiceTotal
            + blTotal
            - invPaymentTotal
            - blPaymentTotal
            - creditTotal;

        const dbBalance = customer.balance || 0;
        const difference = dbBalance - correctBalance;

        let status = "✅ OK";
        if (Math.abs(difference) > 0.01) {
            totalDiscrepancies++;
            totalDifference += Math.abs(difference);
            status = Math.abs(difference) > 100 ? "🔴 MAJOR" : "⚠️  MINOR";
        }

        console.log(
            `${customer.name.substring(0, 25).padEnd(25)} ` +
            `${dbBalance.toFixed(3).padStart(12)} ` +
            `${correctBalance.toFixed(3).padStart(12)} ` +
            `${difference.toFixed(3).padStart(12)} ` +
            `${status.padStart(15)}`
        );
    }

    console.log("=".repeat(100));
    console.log(`\n📊 Summary:`);
    console.log(`   - Customers analyzed: ${customers.length}`);
    console.log(`   - Discrepancies found: ${totalDiscrepancies}`);
    console.log(`   - Total absolute difference: ${totalDifference.toFixed(3)} TND`);

    if (totalDiscrepancies > 0) {
        console.log(`\n❌ PROBLEM CONFIRMED: ${totalDiscrepancies} customers have incorrect balances!`);
        console.log(`\n💡 Solution: Follow the steps in INSTRUCTIONS_FIX_BALANCE.md to fix this.`);
    } else {
        console.log(`\n✅ All balances are correct!`);
    }
}

validateBalanceIssues().catch(error => {
    console.error("\n❌ Unexpected error:", error);
});
