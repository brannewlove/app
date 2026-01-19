const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.query('SELECT * FROM assets WHERE asset_number = ?', ['12319420']);
        console.log('--- ASSET DATA ---');
        console.log(JSON.stringify(rows, null, 2));
        console.log('------------------');

        if (rows.length === 0) {
            console.log('Asset 12319420 NOT FOUND in assets table.');
        } else {
            console.log('Asset 12319420 FOUND.');
        }

        const [tradeRows] = await connection.query('SELECT * FROM trade WHERE asset_number = ? ORDER BY trade_id DESC', ['12319420']);
        console.log('--- TRADE LOG DATA ---');
        console.log(JSON.stringify(tradeRows, null, 2));
        console.log('----------------------');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

check();
