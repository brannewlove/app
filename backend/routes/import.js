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

        // 1. 존재하는 사용자 cj_id 목록 가져오기 (FK 제약 조건 위반 방지)
        const [userRows] = await pool.query('SELECT cj_id FROM users');
        const validUserIds = new Set(userRows.map(u => u.cj_id));

        // 필수 필드 검증 (asset_number, day_of_start, day_of_end)
        const validData = rawData.filter(row => {
            // in_user가 존재하지 않는 사용자라면 null 처리 (제약조건 에러 방지)
            if (row.in_user && !validUserIds.has(String(row.in_user))) {
                console.warn(`[Import] 존재하지 않는 사용자 ID(${row.in_user})가 발견되어 null 처리합니다.`);
                row.in_user = null;
            }

            const hasAssetNumber = row.asset_number && String(row.asset_number).trim() !== '';
            const hasDayOfStart = row.day_of_start && String(row.day_of_start).trim() !== '';
            const hasDayOfEnd = row.day_of_end && String(row.day_of_end).trim() !== '';
            return hasAssetNumber && hasDayOfStart && hasDayOfEnd;
        });

        const skippedCount = rawData.length - validData.length;

        if (validData.length === 0) {
            return response.error(res, `필수 정보(자산번호, 시작일, 종료일)가 모두 누락되어 처리할 데이터가 없습니다. (제외된 건수: ${skippedCount}건)`, 400);
        }

        // 2. 기존 데이터 가져오기 (신규/업데이트 및 변경사항 확인용)
        const columnsToCompare = Object.keys(validData[0]);
        const assetNumbers = validData.map(row => String(row.asset_number));
        const [existingRows] = await pool.query(
            `SELECT ${columnsToCompare.map(c => `\`${c}\``).join(', ')} FROM assets WHERE asset_number IN (?)`,
            [assetNumbers]
        );

        const existingMap = new Map();
        existingRows.forEach(row => existingMap.set(String(row.asset_number), row));

        const result = await performUpsert('assets', 'asset_number', validData);

        const totalCount = rawData.length;
        const processedCount = validData.length;

        let insertedCount = 0;
        let updatedCount = 0;

        validData.forEach(row => {
            const key = String(row.asset_number);
            if (!existingMap.has(key)) {
                insertedCount++;
            } else {
                const existing = existingMap.get(key);
                const isChanged = columnsToCompare.some(col => {
                    let dbVal = existing[col];
                    let inputVal = row[col];

                    // null/empty 처리
                    if (dbVal === null || dbVal === undefined) dbVal = '';
                    if (inputVal === null || inputVal === undefined) inputVal = '';

                    // Date 객체 처리 (YYYY-MM-DD 형식이면 날짜만 비교)
                    if (dbVal instanceof Date) {
                        dbVal = dbVal.toISOString().split('T')[0];
                    }

                    return String(dbVal) !== String(inputVal).trim();
                });
                if (isChanged) updatedCount++;
            }
        });

        let message = `총 ${totalCount}건 중 ${processedCount}건 처리 완료 (신규: ${insertedCount}, 업데이트: ${updatedCount})`;
        if (skippedCount > 0) {
            message += `, 필수정보 누락으로 ${skippedCount}건 제외됨`;
        }

        response.success(res, {
            total: totalCount,
            processed: processedCount,
            inserted: insertedCount,
            updated: updatedCount,
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
        const rawData = req.body;
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return response.error(res, '처리할 데이터가 없습니다.', 400);
        }

        // 필수 필드 검증 (cj_id)
        const validData = rawData.filter(row => row.cj_id && String(row.cj_id).trim() !== '');
        const skippedCount = rawData.length - validData.length;

        if (validData.length === 0) {
            return response.error(res, `필수 정보(사용자 ID)가 누락되어 처리할 데이터가 없습니다.`, 400);
        }

        // 기존 데이터 가져오기 (신규/업데이트 및 변경사항 확인용)
        const columnsToCompare = Object.keys(validData[0]);
        const cjIds = validData.map(row => String(row.cj_id));
        const [existingRows] = await pool.query(
            `SELECT ${columnsToCompare.map(c => `\`${c}\``).join(', ')} FROM users WHERE cj_id IN (?)`,
            [cjIds]
        );

        const existingMap = new Map();
        existingRows.forEach(row => existingMap.set(String(row.cj_id), row));

        const result = await performUpsert('users', 'cj_id', validData);

        const totalCount = rawData.length;
        const processedCount = validData.length;

        let insertedCount = 0;
        let updatedCount = 0;

        validData.forEach(row => {
            const key = String(row.cj_id);
            if (!existingMap.has(key)) {
                insertedCount++;
            } else {
                const existing = existingMap.get(key);
                const isChanged = columnsToCompare.some(col => {
                    let dbVal = existing[col];
                    let inputVal = row[col];

                    if (dbVal === null || dbVal === undefined) dbVal = '';
                    if (inputVal === null || inputVal === undefined) inputVal = '';

                    if (dbVal instanceof Date) {
                        dbVal = dbVal.toISOString().split('T')[0];
                    }

                    return String(dbVal) !== String(inputVal).trim();
                });
                if (isChanged) updatedCount++;
            }
        });

        let message = `총 ${totalCount}건 중 ${processedCount}건 처리 완료 (신규: ${insertedCount}, 업데이트: ${updatedCount})`;
        if (skippedCount > 0) {
            message += `, 필수정보 누락으로 ${skippedCount}건 제외됨`;
        }

        response.success(res, {
            total: totalCount,
            processed: processedCount,
            inserted: insertedCount,
            updated: updatedCount,
            skipped: skippedCount,
            message: message
        });
    } catch (err) {
        console.error('User Import Error:', err);
        response.error(res, err.message);
    }
});

module.exports = router;
