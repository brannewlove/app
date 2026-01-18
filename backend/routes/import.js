const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const response = require('../utils/response');

/**
 * 범용 Upsert 함수
 * @param {string} table 테이블명
 * @param {string} pkColumn 기본키 컬럼명 (Update에서 제외됨)
 * @param {Array} data JSON 데이터 배열
 */
async function performUpsert(table, pkColumn, data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('처리할 데이터가 없습니다.');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const columns = Object.keys(data[0]);
        if (!columns.includes(pkColumn)) {
            throw new Error(`필수 컬럼(${pkColumn})이 누락되었습니다.`);
        }

        const updateColumns = columns.filter(col => col !== pkColumn);
        const placeholders = `(${columns.map(() => '?').join(', ')})`;
        const updateClause = updateColumns.map(col => `\`${col}\`=VALUES(\`${col}\`)`).join(', ');

        const sql = `
            INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')})
            VALUES ${data.map(() => placeholders).join(', ')}
            ON DUPLICATE KEY UPDATE ${updateClause}
        `;

        const flatData = data.flatMap(row => columns.map(col => {
            const val = row[col];
            return val === '' || val === undefined ? null : val;
        }));

        const [result] = await connection.execute(sql, flatData);
        await connection.commit();
        return result;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

// 자산 데이터 임포트
router.post('/assets', async (req, res) => {
    try {
        const rawData = req.body;
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return response.error(res, '처리할 데이터가 없습니다.', 400);
        }

        // 필수 필드 검증 (asset_number, day_of_start, day_of_end)
        const validData = rawData.filter(row => {
            const hasAssetNumber = row.asset_number && String(row.asset_number).trim() !== '';
            const hasDayOfStart = row.day_of_start && String(row.day_of_start).trim() !== '';
            const hasDayOfEnd = row.day_of_end && String(row.day_of_end).trim() !== '';
            return hasAssetNumber && hasDayOfStart && hasDayOfEnd;
        });

        const skippedCount = rawData.length - validData.length;

        if (validData.length === 0) {
            return response.error(res, `필수 정보(자산번호, 시작일, 종료일)가 모두 누락되어 처리할 데이터가 없습니다. (제외된 건수: ${skippedCount}건)`, 400);
        }

        const result = await performUpsert('assets', 'asset_number', validData);

        // MySQL INSERT ... ON DUPLICATE KEY UPDATE 결과 분석
        const totalCount = rawData.length;
        const processedCount = validData.length;
        const insertedCount = Math.floor(result.affectedRows / 2);
        const updatedCount = result.affectedRows - (insertedCount * 2);

        let message = `총 ${totalCount}건 중 ${processedCount}건 처리 완료 (신규 ${updatedCount}건, 업데이트 ${insertedCount}건)`;
        if (skippedCount > 0) {
            message += `, 필수정보 누락으로 ${skippedCount}건 제외됨`;
        }

        response.success(res, {
            total: totalCount,
            processed: processedCount,
            inserted: updatedCount,
            updated: insertedCount,
            skipped: skippedCount,
            message: message
        });
    } catch (err) {
        console.error('Asset Import Error:', err);
        response.error(res, err.message);
    }
});

// 사용자 데이터 임포트
router.post('/users', async (req, res) => {
    try {
        const result = await performUpsert('users', 'cj_id', req.body);

        // MySQL INSERT ... ON DUPLICATE KEY UPDATE 결과 분석
        // affectedRows: 신규 삽입 시 1, 업데이트 시 2, 변경사항 없을 시 0
        const totalCount = req.body.length;
        const insertedCount = Math.floor(result.affectedRows / 2); // 업데이트된 건수 (affectedRows가 2인 경우)
        const updatedCount = result.affectedRows - (insertedCount * 2); // 신규 삽입된 건수

        response.success(res, {
            total: totalCount,
            inserted: updatedCount,
            updated: insertedCount,
            message: `총 ${totalCount}건 중 신규 등록 ${updatedCount}건, 업데이트 ${insertedCount}건`
        });
    } catch (err) {
        console.error('User Import Error:', err);
        response.error(res, err.message);
    }
});

module.exports = router;
