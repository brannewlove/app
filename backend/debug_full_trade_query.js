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

        console.log('[TEST] Full trades query');
        try {
            await conn.query(`
        SELECT 
          t.*,
          a.model,
          a.category,
          u.name,
          u.part,
          u2.name AS ex_user_name,
          u2.part AS ex_user_part
        FROM trade t
        LEFT JOIN assets a ON t.asset_number = a.asset_number
        LEFT JOIN users u ON t.cj_id = u.cj_id
        LEFT JOIN users u2 ON t.ex_user = u2.cj_id
        LIMIT 10
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
