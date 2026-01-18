import pool from './backend/utils/db.js';

async function checkSchema() {
    try {
        const [rows] = await pool.query('DESCRIBE users');
        console.log('Users Schema:', rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
