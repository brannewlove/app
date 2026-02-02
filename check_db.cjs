const pool = require('./backend/utils/db');

async function checkTables() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        console.log('Tables:', tables);

        for (const table of tables) {
            const tableName = Object.values(table)[0];
            const [count] = await pool.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
            console.log(`Table ${tableName}: ${count[0].cnt} rows`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkTables();
