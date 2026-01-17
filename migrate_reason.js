const mysql = require('mysql2/promise');
const dbConfig = require('./backend/config/db.config');

async function migrate() {
    const connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        port: dbConfig.port
    });

    try {
        console.log('Adding return_reason column to returned_assets table...');
        await connection.query(`
      ALTER TABLE returned_assets 
      ADD COLUMN return_reason TEXT AFTER asset_number
    `);
        console.log('Successfully added return_reason column.');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column return_reason already exists.');
        } else {
            console.error('Error during migration:', err);
        }
    } finally {
        await connection.end();
    }
}

migrate();
