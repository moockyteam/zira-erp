
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testGlobalPayments() {
    console.log("Testing get_customer_global_payments...");

    // 1. Get a customer with payments
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name')
        .limit(5);

    if (custError) {
        console.error("Error fetching customers:", custError);
        return;
    }

    if (customers.length === 0) {
        console.log("No customers found.");
        return;
    }

    console.log(`Found ${customers.length} customers. Checking for global payments...`);

    for (const customer of customers) {
        console.log(`Checking customer: ${customer.name} (${customer.id})`);

        const { data: globalPayments, error: gpError } = await supabase.rpc('get_customer_global_payments', {
            p_customer_id: customer.id
        });

        if (gpError) {
            console.error(`Error fetching global payments for ${customer.name}:`, gpError);
            continue;
        }

        if (globalPayments && globalPayments.length > 0) {
            console.log(`Found ${globalPayments.length} global payments for ${customer.name}:`);
            console.log(JSON.stringify(globalPayments[0], null, 2)); // Print first one structure

            // Check structure
            const gp = globalPayments[0];
            if (gp.allocations && (gp.allocations.invoices || gp.allocations.bls)) {
                console.log("Structure looks correct.");
            } else {
                console.log("WARNING: Allocations structure might be missing or different.");
            }
            break; // Found one, enough for testing
        } else {
            console.log("No global payments found.");
        }
    }
}

testGlobalPayments();
