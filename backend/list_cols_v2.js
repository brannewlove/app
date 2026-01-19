const pool = require('./utils/db');
async function run() {
    const [rows] = await pool.query('DESCRIBE trade');
    rows.forEach(r => console.log(r.Field));
    process.exit();
}
run();
