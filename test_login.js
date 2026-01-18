import pool from './backend/utils/db.js';
import bcrypt from 'bcrypt';

async function testLoginData() {
    try {
        const cj_id = 'leejh87';
        const [users] = await pool.query('SELECT * FROM users WHERE cj_id = ?', [cj_id]);
        if (users.length > 0) {
            const user = users[0];
            console.log('User found in DB:', {
                cj_id: user.cj_id,
                name: `[${user.name}]`, // Check for spaces
                sec_level: user.sec_level,
                sec_level_type: typeof user.sec_level
            });

            const responseUser = {
                user_id: user.user_id,
                cj_id: user.cj_id,
                name: user.name,
                sec_level: user.sec_level
            };
            console.log('API Response User would be:', responseUser);
        } else {
            console.log('User not found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testLoginData();
