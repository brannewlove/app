const pool = require('./utils/db');

async function createSettingsTable() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('DB 연결 성공');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS settings (
                s_key VARCHAR(50) PRIMARY KEY,
                s_value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `;

        await connection.query(createTableQuery);
        console.log('settings 테이블 생성 완료');

        // 기본값 삽입 (이미 있으면 무시)
        await connection.query(
            "INSERT IGNORE INTO settings (s_key, s_value) VALUES ('auto_backup_enabled', 'true')"
        );
        console.log('기본 설정 데이터 삽입 완료');

    } catch (err) {
        console.error('오류 발생:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

createSettingsTable();
