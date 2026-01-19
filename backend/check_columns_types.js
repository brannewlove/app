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

        console.log('--- confirmed_assets columns ---');
        const [cols1] = await conn.query("SHOW COLUMNS FROM confirmed_assets");
        cols1.forEach(c => console.log(`${c.Field} ${c.Type}`));

        console.log('--- trade columns ---');
        const [cols2] = await conn.query("SHOW COLUMNS FROM trade");
        cols2.forEach(c => console.log(`${c.Field} ${c.Type}`));

        conn.end();
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
