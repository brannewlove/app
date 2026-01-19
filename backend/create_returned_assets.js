const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

(async () => {
    const config = {
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'IClwx6F2VTbLZsEx',
        database: 'assetdb',
        port: 3306
    };

    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`returned_assets\` (
        \`return_id\` int NOT NULL AUTO_INCREMENT,
        \`asset_number\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '자산번호',
        \`return_reason\` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '반납사유',
        \`model\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '모델명',
        \`serial_number\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '시리얼번호',
        \`return_type\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납유형',
        \`end_date\` date DEFAULT NULL COMMENT '자산 사용 종료일',
        \`user_id\` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자 ID',
        \`user_name\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자명',
        \`department\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자 부서',
        \`handover_date\` date DEFAULT NULL COMMENT '인계일',
        \`release_status\` tinyint(1) DEFAULT '0' COMMENT '출고여부',
        \`it_room_stock\` tinyint(1) DEFAULT '0' COMMENT '전산실입고',
        \`low_format\` tinyint(1) DEFAULT '0' COMMENT '로우포맷',
        \`it_return\` tinyint(1) DEFAULT '0' COMMENT '전산반납',
        \`mail_return\` tinyint(1) DEFAULT '0' COMMENT '메일반납',
        \`actual_return\` tinyint(1) DEFAULT '0' COMMENT '실재반납',
        \`complete\` tinyint(1) DEFAULT '0' COMMENT '완료',
        \`remarks\` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '비고',
        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
        PRIMARY KEY (\`return_id\`),
        UNIQUE KEY \`UQ_returned_assets_asset_number\` (\`asset_number\`),
        KEY \`idx_returned_asset_number\` (\`asset_number\`),
        KEY \`idx_returned_user_id\` (\`user_id\`)
    ) ENGINE = InnoDB AUTO_INCREMENT = 39 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '반납 자산 테이블';
  `;

    try {
        const conn = await mysql.createConnection(config);
        await conn.query(createTableQuery);
        console.log('returned_assets table created successfully.');
        conn.end();
    } catch (e) {
        console.error('Error creating table:', e.message);
    }
})();
