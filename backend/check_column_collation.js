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

        const query = `
      SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME, CHARACTER_SET_NAME
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'assetdb' 
      AND COLUMN_NAME IN ('asset_number', 'cj_id', 'ex_user')
      ORDER BY TABLE_NAME, COLUMN_NAME;
    `;

        const [rows] = await conn.query(query);
        console.table(rows);

        conn.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
