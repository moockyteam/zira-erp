const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function run() {
    console.log("Checking for SQL execution capability...");
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (connectionString) {
        console.log("Found connection string, using 'pg' to execute SQL...");
        const { Client } = require('pg');
        const client = new Client({
            connectionString: connectionString,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            // Point to the correct SQL file in the current directory
            const sqlPath = path.join(__dirname, 'update_categories_types.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await client.query(sql);
            console.log("Successfully executed SQL script.");
            await client.end();
        } catch (err) {
            console.error("Error executing SQL via pg:", err);
            process.exit(1);
        }
    } else {
        console.warn("No DATABASE_URL found. Checking for existing `exec_sql` RPC function...");
        const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const sqlPath = path.join(__dirname, 'update_categories_types.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Note: exec_sql must exist in the DB for this to work
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error("Failed to execute SQL via RPC (exec_sql might not exist).");
            console.error("Error:", error);
            process.exit(1);
        } else {
            console.log("Successfully executed SQL script via RPC.");
        }
    }
}

run();
