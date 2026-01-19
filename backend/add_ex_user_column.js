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
        console.log('Connected. Adding ex_user column...');

        try {
            await conn.query("ALTER TABLE trade ADD COLUMN ex_user varchar(20) DEFAULT NULL");
            console.log('ex_user column added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('ex_user column already exists.');
            } else {
                console.log('Error adding column:', err.message);
            }
        }

        conn.end();
    } catch (e) {
        console.log('Init Error:', e.message);
    }
})();
