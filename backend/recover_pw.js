const pool = require('./utils/db');
const bcrypt = require('bcrypt');

async function fixPasswordColumnAndHash() {
    const connection = await pool.getConnection();
    try {
        console.log('Expanding password column length to 255...');
        await connection.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255)');
        console.log('Column expanded successfully.');

        const plainPassword = 'dlwnsgml1!';
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        console.log(`Hashing password for leejh87...`);
        const [result] = await connection.query(
            'UPDATE users SET password = ? WHERE cj_id = "leejh87"',
            [hashedPassword]
        );

        if (result.affectedRows > 0) {
            console.log('SUCCESS: Password updated with bcrypt hash.');
        } else {
            console.log('FAILED: User leejh87 not found.');
        }
    } catch (err) {
        console.error('Error during recovery:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

fixPasswordColumnAndHash();
