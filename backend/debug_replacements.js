const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkReplacements() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.query('SELECT asset_number, replacement FROM assets');
        console.log(`Total assets: ${rows.length}`);

        const withReplacements = rows.filter(r => r.replacement !== null && r.replacement !== '');
        console.log(`Assets with replacements: ${withReplacements.length}`);

        if (withReplacements.length > 0) {
            console.log('Sample replacements:', withReplacements.slice(0, 5));
        }

        const nullReplacements = rows.filter(r => r.replacement === null).length;
        const emptyReplacements = rows.filter(r => r.replacement === '').length;
        console.log(`NULL replacements: ${nullReplacements}`);
        console.log(`Empty string replacements: ${emptyReplacements}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

checkReplacements();
