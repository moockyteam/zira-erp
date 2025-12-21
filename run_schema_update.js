
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need service key to run RLS bypass or administrative tasks if using JS client for data, but for DDL we strictly need SQL access.
// Since I cannot find a dedicated `pg` connection string easily, I will try to use the standard Supabase client to see if I can invoke an RPC if it exists, 
// OR simpler: I will assume I can't run DDL from here and instruct the user, BUT I will try to use a specialized approach if I can find the connection string.
// Let's check env vars for POSTGRES_URL or similar.

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
            const sqlPath = path.join(__dirname, 'scripts', '009_create_customer_items.sql');
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
        // Fallback: try RPC 'exec_sql'
        const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const sqlPath = path.join(__dirname, 'scripts', '009_create_customer_items.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error("Failed to execute SQL via RPC (exec_sql might not exist).");
            console.error("Error:", error);
            console.log("Please execute the script at 'scripts/009_create_customer_items.sql' manually in your Supabase SQL Editor.");
            process.exit(1);
        } else {
            console.log("Successfully executed SQL script via RPC.");
        }
    }
}

run();
