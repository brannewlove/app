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
        const [cols] = await conn.query("SHOW COLUMNS FROM confirmed_assets");
        console.log('Columns in confirmed_assets:');
        cols.forEach(c => console.log(c.Field));
        conn.end();
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
