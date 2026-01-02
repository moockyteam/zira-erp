const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function run() {
    console.log("Starting migration...");
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (connectionString) {
        console.log("Using 'pg' client...");
        const { Client } = require('pg');
        const client = new Client({
            connectionString: connectionString,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            const sql = fs.readFileSync('add_withholding_tax_to_companies.sql', 'utf8');
            await client.query(sql);
            console.log("Migration successful!");
            await client.end();
        } catch (err) {
            console.error("Migration failed:", err);
            process.exit(1);
        }
    } else {
        console.error("No DATABASE_URL found.");
        process.exit(1);
    }
}

run();
