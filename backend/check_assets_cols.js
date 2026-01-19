const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAssetsSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.query('DESCRIBE assets');
        console.log('Columns in assets table:');
        rows.forEach(row => console.log(`- ${row.Field} (${row.Type})`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

checkAssetsSchema();
