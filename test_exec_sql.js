
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Start with anon key. If it fails, we might need service key if we can find it, 
// but usually exec_sql is protected or doesn't exist.
// run_schema_update.js checked for SUPABASE_SERVICE_ROLE_KEY or ANON_KEY.
// Let's assume we only have what's in env.local.

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSql() {
    console.log("Testing exec_sql RPC...");

    const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT version();"
    });

    if (error) {
        console.error("RPC exec_sql Failed:", error.message);
        console.error("Full Error:", error);
    } else {
        console.log("RPC exec_sql Success:", data);
    }
}

testSql();
