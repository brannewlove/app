const pool = require('./utils/db');
async function run() {
    const [rows] = await pool.query('DESCRIBE trade');
    console.log(rows.map(r => r.Field).join(','));
    process.exit();
}
run();
