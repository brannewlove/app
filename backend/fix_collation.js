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

    const tables = ['assets', 'users', 'trade', 'confirmed_assets', 'assetlogs', 'returned_assets'];

    try {
        const conn = await mysql.createConnection(config);
        console.log('Connected to DB. Starting collation update...');

        for (const table of tables) {
            try {
                console.log(`Converting table ${table}...`);
                await conn.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
                console.log(`Table ${table} converted successfully.`);
            } catch (err) {
                console.error(`Failed to convert table ${table}:`, err.message);
            }
        }

        conn.end();
        console.log('All updates finished.');
    } catch (e) {
        console.error('Connection Error:', e.message);
    }
})();
