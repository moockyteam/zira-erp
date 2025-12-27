
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

async function test() {
    const { data, error } = await supabase
        .from('delivery_notes')
        .select('non_existent_column_xyz')
        .limit(1);

    if (error) {
        console.log("Confirmed: Selection of missing column returns error:", error.message);
    } else {
        console.log("Unexpected: Selection of missing column did NOT return error.");
    }
}

test();
