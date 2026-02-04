const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateAllBalances() {
    console.log("🔄 Recalculating all customer balances...\n");

    // Fetch all customers
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, balance');

    if (custError) {
        console.error("❌ Failed to fetch customers:", custError.message);
        return;
    }

    console.log(`Found ${customers.length} customers to update...\n`);

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const customer of customers) {
        // Calculate new balance using the corrected function
        const { data: newBalance, error: calcError } = await supabase.rpc('calculate_customer_balance', {
            p_customer_id: customer.id
        });

        if (calcError) {
            console.error(`❌ ${customer.name}: Failed to calculate -`, calcError.message);
            errorCount++;
            continue;
        }

        const oldBalance = customer.balance || 0;
        const difference = newBalance - oldBalance;

        // Update customer balance
        const { error: updateError } = await supabase
            .from('customers')
            .update({ balance: newBalance })
            .eq('id', customer.id);

        if (updateError) {
            console.error(`❌ ${customer.name}: Failed to update -`, updateError.message);
            errorCount++;
        } else {
            successCount++;

            // Store result for summary
            if (Math.abs(difference) > 0.01) {
                results.push({
                    name: customer.name,
                    oldBalance: oldBalance.toFixed(3),
                    newBalance: newBalance.toFixed(3),
                    difference: difference.toFixed(3)
                });
            }

            if (successCount % 10 === 0) {
                console.log(`   ✅ Updated ${successCount}/${customers.length} customers...`);
            }
        }
    }

    console.log(`\n✅ Balance recalculation complete!`);
    console.log(`   - Successfully updated: ${successCount}`);
    console.log(`   - Errors: ${errorCount}\n`);

    // Show significant changes
    if (results.length > 0) {
        console.log(`📊 Customers with balance changes (> 0.01 TND):\n`);
        console.log("─".repeat(80));
        console.log(`${"Customer".padEnd(30)} ${"Old Balance".padStart(15)} ${"New Balance".padStart(15)} ${"Difference".padStart(15)}`);
        console.log("─".repeat(80));

        results.forEach(r => {
            console.log(`${r.name.padEnd(30)} ${r.oldBalance.padStart(15)} ${r.newBalance.padStart(15)} ${r.difference.padStart(15)}`);
        });
        console.log("─".repeat(80));
        console.log(`Total affected: ${results.length} customers\n`);
    } else {
        console.log("✅ No significant balance changes detected (all differences < 0.01 TND)\n");
    }
}

recalculateAllBalances().then(() => {
    console.log("🎉 Done! Balances have been recalculated.\n");
    console.log("Next steps:");
    console.log("1. Check the customer list in /dashboard/customers");
    console.log("2. Verify a few customer details pages");
    console.log("3. Compare with global collections view");
}).catch(error => {
    console.error("\n❌ Unexpected error:", error);
});
