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

        console.log('\n--- assets Table Definition ---');
        const [rows] = await conn.query('SHOW CREATE TABLE assets');
        console.log(rows[0]['Create Table']);

        console.log('\n--- trade Table Definition ---');
        const [rows2] = await conn.query('SHOW CREATE TABLE trade');
        console.log(rows2[0]['Create Table']);

        conn.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
