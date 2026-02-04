const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBalanceCalculation() {
    console.log("🔧 Starting Balance Calculation Fix...\n");

    // Step 1: Check current function definition
    console.log("Step 1: Checking current calculate_customer_balance function...");

    const { data: funcData, error: funcError } = await supabase.rpc('calculate_customer_balance', {
        p_customer_id: '00000000-0000-0000-0000-000000000000' // Test with dummy ID
    });

    if (funcError) {
        console.log("⚠️  Function exists but failed with dummy ID (expected)");
    } else {
        console.log("✅ Function exists and is callable");
    }

    // Step 2: Create the corrected function
    console.log("\nStep 2: Creating corrected calculate_customer_balance function...");

    const correctedFunction = `
CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC := 0;
    v_initial_balance NUMERIC := 0;
    v_invoices NUMERIC := 0;
    v_bls NUMERIC := 0;
    v_invoice_payments NUMERIC := 0;
    v_bl_payments NUMERIC := 0;
    v_credits NUMERIC := 0;
BEGIN
    -- Initial Balance
    SELECT COALESCE(initial_balance, 0) INTO v_initial_balance
    FROM customers WHERE id = p_customer_id;
    
    -- Invoices (excluding BROUILLON and ANNULEE)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_invoices
    FROM invoices 
    WHERE customer_id = p_customer_id 
    AND status NOT IN ('BROUILLON', 'ANNULEE');
    
    -- BLs (Unbilled only - LIVRE status and not yet invoiced)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_bls
    FROM delivery_notes 
    WHERE customer_id = p_customer_id 
    AND status = 'LIVRE' 
    AND invoice_id IS NULL;
    
    -- Invoice Payments (via invoice relationship)
    SELECT COALESCE(SUM(ip.amount), 0) INTO v_invoice_payments
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE i.customer_id = p_customer_id;
    
    -- BL Payments (via delivery_note relationship)
    SELECT COALESCE(SUM(dnp.amount), 0) INTO v_bl_payments
    FROM delivery_note_payments dnp
    JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
    WHERE dn.customer_id = p_customer_id;
    
    -- Customer Credits (direct payments/avances)
    SELECT COALESCE(SUM(amount), 0) INTO v_credits
    FROM customer_credits 
    WHERE customer_id = p_customer_id;
    
    -- Calculate final balance
    -- NOTE: We DO NOT include global_payment_entries to avoid double-counting
    -- as those payments are already recorded in invoice_payments and delivery_note_payments
    v_balance := v_initial_balance + v_invoices + v_bls 
                - v_invoice_payments - v_bl_payments - v_credits;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
`;

    // Try to execute via RPC if exec_sql exists
    const { data: execData, error: execError } = await supabase.rpc('exec_sql', {
        sql_query: correctedFunction
    });

    if (execError) {
        console.log("❌ Failed to execute via RPC exec_sql:", execError.message);
        console.log("\n📋 Please execute this SQL manually in Supabase SQL Editor:");
        console.log("=".repeat(80));
        console.log(correctedFunction);
        console.log("=".repeat(80));
        return false;
    }

    console.log("✅ Function updated successfully!");

    // Step 3: Recalculate all customer balances
    console.log("\nStep 3: Recalculating all customer balances...");

    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name');

    if (custError) {
        console.error("❌ Failed to fetch customers:", custError.message);
        return false;
    }

    console.log(`Found ${customers.length} customers to update...`);

    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
        // Calculate new balance
        const { data: newBalance, error: calcError } = await supabase.rpc('calculate_customer_balance', {
            p_customer_id: customer.id
        });

        if (calcError) {
            console.error(`❌ Failed to calculate balance for ${customer.name}: `, calcError.message);
            errorCount++;
            continue;
        }

        // Update customer balance
        const { error: updateError } = await supabase
            .from('customers')
            .update({ balance: newBalance })
            .eq('id', customer.id);

        if (updateError) {
            console.error(`❌ Failed to update balance for ${customer.name}: `, updateError.message);
            errorCount++;
        } else {
            successCount++;
            if (successCount % 10 === 0) {
                console.log(`   Updated ${successCount}/${customers.length} customers...`);
            }
        }
    }

    console.log(`\n✅ Balance recalculation complete!`);
    console.log(`   - Successfully updated: ${successCount}`);
    console.log(`   - Errors: ${errorCount}`);

    return true;
}

fixBalanceCalculation().then(success => {
    if (success) {
        console.log("\n🎉 Balance calculation fix completed successfully!");
        console.log("\nNext steps:");
        console.log("1. Verify balances in customer management pages");
        console.log("2. Check that all views show consistent balances");
        console.log("3. Test with a new payment to ensure it updates correctly");
    } else {
        console.log("\n⚠️  Manual intervention required. See instructions above.");
    }
}).catch(error => {
    console.error("\n❌ Unexpected error:", error);
});
