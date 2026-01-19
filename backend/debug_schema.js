const pool = require('./utils/db');
async function check() {
    try {
        const [rows] = await pool.query('DESCRIBE trade');
        console.log('Columns in trade table:');
        rows.forEach(r => console.log(`- ${r.Field}`));

        const [assetRows] = await pool.query('DESCRIBE assets');
        console.log('\nColumns in assets table:');
        assetRows.forEach(r => console.log(`- ${r.Field}`));

        const [trades] = await pool.query('SELECT * FROM trade LIMIT 1');
        if (trades.length > 0) {
            console.log('\nKeys in trade object (including joins):');
            console.log(Object.keys(trades[0]));
        }
    } catch (e) { console.error(e); }
    finally { process.exit(); }
}
check();
