
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to read .env.local
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');

    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseKey = keyMatch[1].trim();

} catch (e) {
    console.log("Could not read .env.local");
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching invoice_payments:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Invoice Payment Columns:", Object.keys(data[0]));
    } else {
        console.log("No invoice payments found, cannot inspect columns easily via select.");
    }
}

inspect();
// End of script
