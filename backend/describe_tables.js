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

        console.log('\n--- confirmed_assets Table ---');
        const [confirmedCols] = await conn.query('DESCRIBE confirmed_assets');
        console.table(confirmedCols);

        console.log('\n--- trade Table ---');
        const [tradeCols] = await conn.query('DESCRIBE trade');
        console.table(tradeCols);

        conn.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
