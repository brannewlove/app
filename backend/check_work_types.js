const pool = require('./utils/db');

async function checkWorkTypes() {
    try {
        const [rows] = await pool.query('SELECT DISTINCT work_type FROM trade');
        console.log('Work Types:', rows.map(r => r.work_type));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkWorkTypes();
