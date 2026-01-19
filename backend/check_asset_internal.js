const path = require('path');
const pool = require('./utils/db');

async function checkAssetData() {
    const asset_number = '2510260431';
    try {
        console.log(`Checking data for asset: ${asset_number}`);

        const [assets] = await pool.query('SELECT asset_number, in_user, day_of_start FROM assets WHERE asset_number = ?', [asset_number]);
        console.log('\n--- assets table ---');
        console.table(assets);

        const [trades] = await pool.query('SELECT trade_id, asset_number, work_type, cj_id, timestamp FROM trade WHERE asset_number = ? ORDER BY timestamp ASC', [asset_number]);
        console.log('\n--- trade table ---');
        console.table(trades);

        const ids = [...new Set([
            ...(assets.map(a => a.in_user)),
            ...(trades.map(t => t.cj_id))
        ])].filter(id => id);

        if (ids.length > 0) {
            const [users] = await pool.query('SELECT cj_id, name FROM users WHERE cj_id IN (?)', [ids]);
            console.log('\n--- users table ---');
            console.table(users);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAssetData();
