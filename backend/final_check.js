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
        const [assets] = await connection.query('SELECT * FROM assets WHERE asset_number = "12319420"');
        const [trades] = await connection.query('SELECT * FROM trade WHERE asset_number = "12319420" ORDER BY trade_id DESC LIMIT 1');

        console.log('--- ASSET ---');
        console.log(JSON.stringify(assets[0] || 'NOT FOUND', null, 2));
        console.log('--- TRADE ---');
        console.log(JSON.stringify(trades[0] || 'NOT FOUND', null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
