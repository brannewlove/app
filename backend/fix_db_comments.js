const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "assetdb"
};

async function fixComments() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        console.log('Fixing comments for returned_assets table...');

        const queries = [
            `ALTER TABLE returned_assets COMMENT = '반납 자산 테이블'`,
            `ALTER TABLE returned_assets MODIFY COLUMN asset_number varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '자산번호'`,
            `ALTER TABLE returned_assets MODIFY COLUMN return_reason tinytext COLLATE utf8mb4_unicode_ci COMMENT '반납사유'`,
            `ALTER TABLE returned_assets MODIFY COLUMN model varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '모델명'`,
            `ALTER TABLE returned_assets MODIFY COLUMN serial_number varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '시리얼번호'`,
            `ALTER TABLE returned_assets MODIFY COLUMN return_type varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납유형'`,
            `ALTER TABLE returned_assets MODIFY COLUMN end_date date DEFAULT NULL COMMENT '자산 사용 종료일'`,
            `ALTER TABLE returned_assets MODIFY COLUMN user_id varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자 ID'`,
            `ALTER TABLE returned_assets MODIFY COLUMN user_name varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자명'`,
            `ALTER TABLE returned_assets MODIFY COLUMN department varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자 부서'`,
            `ALTER TABLE returned_assets MODIFY COLUMN handover_date date DEFAULT NULL COMMENT '인계일'`,
            `ALTER TABLE returned_assets MODIFY COLUMN release_status tinyint(1) DEFAULT '0' COMMENT '출고여부'`,
            `ALTER TABLE returned_assets MODIFY COLUMN it_room_stock tinyint(1) DEFAULT '0' COMMENT '전산실입고'`,
            `ALTER TABLE returned_assets MODIFY COLUMN low_format tinyint(1) DEFAULT '0' COMMENT '로우포맷'`,
            `ALTER TABLE returned_assets MODIFY COLUMN it_return tinyint(1) DEFAULT '0' COMMENT '전산반납'`,
            `ALTER TABLE returned_assets MODIFY COLUMN mail_return tinyint(1) DEFAULT '0' COMMENT '메일반납'`,
            `ALTER TABLE returned_assets MODIFY COLUMN actual_return tinyint(1) DEFAULT '0' COMMENT '실재반납'`,
            `ALTER TABLE returned_assets MODIFY COLUMN complete tinyint(1) DEFAULT '0' COMMENT '완료'`,
            `ALTER TABLE returned_assets MODIFY COLUMN remarks tinytext COLLATE utf8mb4_unicode_ci COMMENT '비고'`,
            `ALTER TABLE returned_assets MODIFY COLUMN created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일'`
        ];

        for (const query of queries) {
            await connection.query(query);
            console.log('Executed:', query.substring(0, 50) + '...');
        }

        console.log('All comments updated successfully.');

    } catch (err) {
        console.error('Fix comments failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

fixComments();
