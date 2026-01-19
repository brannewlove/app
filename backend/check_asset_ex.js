const path = require('path');
const fs = require('fs');
const pool = require('./utils/db');

async function checkAssetData() {
    const asset_number = '2510260431';
    try {
        const [trades] = await pool.query('SELECT trade_id, asset_number, work_type, cj_id, ex_user, timestamp FROM trade WHERE asset_number = ? ORDER BY timestamp ASC', [asset_number]);
        const ids = [...new Set([
            ...(trades.map(t => t.cj_id)),
            ...(trades.map(t => t.ex_user))
        ])].filter(id => id);

        let users = [];
        if (ids.length > 0) {
            [users] = await pool.query('SELECT cj_id, name FROM users WHERE cj_id IN (?)', [ids]);
        }

        const output = JSON.stringify({ trades, users }, null, 2);
        fs.writeFileSync('check_output_ex.json', output, 'utf8');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAssetData();
