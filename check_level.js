import pool from './backend/utils/db.js';

async function checkUser() {
    try {
        const [rows] = await pool.query('SELECT cj_id, name, sec_level FROM users WHERE cj_id = "leejh87"');
        console.log('User Data:', rows[0]);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUser();
