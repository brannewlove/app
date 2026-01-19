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

        const [cols] = await conn.query("SHOW COLUMNS FROM trade LIKE 'ex_user'");
        if (cols.length === 0) {
            console.log('ex_user column is MISSING in trade table.');
        } else {
            console.log('ex_user column EXISTS in trade table.');
        }

        conn.end();
    } catch (e) {
        console.log('Error:', e.message);
    }
})();
