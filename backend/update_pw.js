const pool = require('./utils/db');
const bcrypt = require('bcrypt');

async function hashPassword() {
    try {
        const plainPassword = 'dlwnsgml1!';
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        console.log(`Hashing password: ${plainPassword}`);
        console.log(`Hashed: ${hashedPassword}`);

        const [result] = await pool.query(
            'UPDATE users SET password = ? WHERE cj_id = "leejh87"',
            [hashedPassword]
        );

        if (result.affectedRows > 0) {
            console.log('SUCCESS: Password updated with bcrypt hash.');
        } else {
            console.log('FAILED: User not found or update failed.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

hashPassword();
