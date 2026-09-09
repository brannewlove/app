const pool = require('./db');

/**
 * 데이터베이스 스키마 자동 점검 및 마이그레이션
 * 서버 시작 시 필요한 컬럼 누락 방지
 */
async function initDbSchema() {
    try {
        console.log('[DB Init] 데이터베이스 스키마 검증 시작...');

        // 1. trade 테이블에 is_cancelled 컬럼 확인
        const [cancelledCol] = await pool.query("SHOW COLUMNS FROM `trade` LIKE 'is_cancelled'");
        if (cancelledCol.length === 0) {
            console.log('[DB Init] trade 테이블에 is_cancelled 컬럼 추가 중...');
            await pool.query("ALTER TABLE `trade` ADD COLUMN `is_cancelled` TINYINT(1) DEFAULT 0 COMMENT '취소 여부 (0: 정상, 1: 취소됨)'");
            console.log('[DB Init] is_cancelled 컬럼 추가 완료');
        }

        // 2. trade 테이블에 cancelled_at 컬럼 확인
        const [cancelledAtCol] = await pool.query("SHOW COLUMNS FROM `trade` LIKE 'cancelled_at'");
        if (cancelledAtCol.length === 0) {
            console.log('[DB Init] trade 테이블에 cancelled_at 컬럼 추가 중...');
            await pool.query("ALTER TABLE `trade` ADD COLUMN `cancelled_at` TIMESTAMP NULL DEFAULT NULL COMMENT '취소 처리 시간'");
            console.log('[DB Init] cancelled_at 컬럼 추가 완료');
        }

        // 3. trade 테이블에 asset_snapshot 컬럼 확인
        const [snapshotCol] = await pool.query("SHOW COLUMNS FROM `trade` LIKE 'asset_snapshot'");
        if (snapshotCol.length === 0) {
            console.log('[DB Init] trade 테이블에 asset_snapshot 컬럼 추가 중...');
            await pool.query("ALTER TABLE `trade` ADD COLUMN `asset_snapshot` JSON DEFAULT NULL COMMENT '자산 마스터 정보 전체 스냅샷 (JSON)'");
            console.log('[DB Init] asset_snapshot 컬럼 추가 완료');
        }

        // 4. settings 테이블 확인 및 생성
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`settings\` (
                \`s_key\` VARCHAR(100) NOT NULL PRIMARY KEY,
                \`s_value\` MEDIUMTEXT NULL,
                \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. trade 테이블 asset_number 인덱스 확인 및 생성 (조회/서브쿼리 성능 최적화)
        const [indexes] = await pool.query("SHOW INDEX FROM `trade` WHERE Key_name = 'idx_trade_asset_number'");
        if (indexes.length === 0) {
            console.log('[DB Init] trade 테이블에 idx_trade_asset_number 인덱스 생성 중...');
            await pool.query("CREATE INDEX `idx_trade_asset_number` ON `trade` (`asset_number`)");
            console.log('[DB Init] idx_trade_asset_number 인덱스 생성 완료');
        }

        console.log('[DB Init] 데이터베이스 스키마 검증 완료');
    } catch (err) {
        console.error('[DB Init] 스키마 검증 중 오류 발생 (무시하고 계속 진행):', err.message);
    }
}

module.exports = { initDbSchema };
