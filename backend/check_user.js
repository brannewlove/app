const pool = require('./utils/db');

async function checkUser() {
    try {
        const [rows] = await pool.query("SELECT * FROM users WHERE cj_id='cjenc_inno'");
        console.log('User cjenc_inno:', rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkUser();
