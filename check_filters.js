const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkFilters() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'assetdb',
    };

    console.log(`Connecting to database: ${dbConfig.database} at ${dbConfig.host}`);

    const pool = mysql.createPool(dbConfig);
    try {
        const [rows] = await pool.query('SELECT * FROM saved_filters');
        console.log(`Found ${rows.length} saved filters.`);
        rows.forEach(r => console.log(`- [${r.id}] ${r.name} (${r.page_context})`));
    } catch (err) {
        console.error('Error querying saved_filters:', err);
    } finally {
        await pool.end();
    }
}

checkFilters();
