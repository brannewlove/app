const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

(async () => {
    const config = {
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'IClwx6F2VTbLZsEx', // Fallback or env
        database: 'assetdb',
        port: 3306
    };

    try {
        const conn = await mysql.createConnection(config);
        const [rows] = await conn.query('SHOW TABLES');
        console.log('Tables in assetdb:');
        rows.forEach(row => console.log(`- ${Object.values(row)[0]}`));
        conn.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
