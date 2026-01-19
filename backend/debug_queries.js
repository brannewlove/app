const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

(async () => {
    const config = {
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'IClwx6F2VTbLZsEx',
        database: 'assetdb',
        port: 3306
    };

    try {
        const conn = await mysql.createConnection(config);
        console.log('Connected.');

        // Check if confirmed_assets is a view
        console.log('[CHECK] SHOW CREATE TABLE confirmed_assets');
        try {
            const [rows] = await conn.query('SHOW CREATE TABLE confirmed_assets');
            console.log('Type:', rows[0]['Create View'] ? 'VIEW' : 'TABLE');
        } catch (e) {
            console.log('Check Failed:', e.code);
        }

        // Test confirmedAssets query
        console.log('[TEST] confirmedAssets query');
        try {
            await conn.query(`SELECT id, asset_number, cj_id, confirmed_at FROM confirmed_assets ORDER BY confirmed_at DESC`);
            console.log('SUCCESS');
        } catch (err) {
            console.log('FAIL:', err.code);
            console.log('MSG:', err.message);
        }

        // Test trades query
        console.log('[TEST] trades query');
        try {
            await conn.query(`
        SELECT t.* FROM trade t
        LEFT JOIN assets a ON t.asset_number = a.asset_number
        LIMIT 1
      `);
            console.log('SUCCESS');
        } catch (err) {
            console.log('FAIL:', err.code);
            console.log('MSG:', err.message);
        }

        conn.end();
    } catch (e) {
        console.log('Init Error:', e.message);
    }
})();
