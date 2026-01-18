const pool = require('./utils/db');

async function cleanupAndCheck() {
    try {
        console.log('Trimming user names...');
        await pool.query('UPDATE users SET name = TRIM(name)');

        console.log('Checking leejh87 data again...');
        const [rows] = await pool.query('SELECT cj_id, name, sec_level FROM users WHERE cj_id = "leejh87"');
        const user = rows[0];
        console.log('User Data:', {
            cj_id: user.cj_id,
            name: `[${user.name}]`,
            sec_level: user.sec_level,
            sec_level_type: typeof user.sec_level
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanupAndCheck();
