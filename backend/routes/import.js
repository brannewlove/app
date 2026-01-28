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
/**
 * 범용 Upsert 함수 (청크 처리 지원)
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
        const updateClause = updateColumns.map(col => `\`${col}\`=VALUES(\`${col}\`)`).join(', ');

        // 500개씩 청크로 나누어 처리
        const chunkSize = 500;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const placeholders = `(${columns.map(() => '?').join(', ')})`;

            const sql = `
                INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')})
                VALUES ${chunk.map(() => placeholders).join(', ')}
                ON DUPLICATE KEY UPDATE ${updateClause}
            `;

            const flatData = chunk.flatMap(row => columns.map(col => {
                const val = row[col];
                return val === '' || val === undefined ? null : val;
            }));

            try {
                await connection.execute(sql, flatData);
            } catch (chunkErr) {
                console.error(`[Upsert Chunk Error] Table: ${table}, Chunk: ${i / chunkSize + 1}`, chunkErr);
                throw new Error(`데이터 저장 중 오류가 발생했습니다 (${i + 1}~${Math.min(i + chunkSize, data.length)}번째 행): ${chunkErr.message}`);
            }
        }

        await connection.commit();
        return { success: true };
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

        // 2. 필수 필드 검증 (asset_number, day_of_start, day_of_end) 및 사용자 유효성 체크
        const validDataRaw = rawData.filter(row => {
            // in_user가 존재하지 않는 사용자라면 null 처리 (제약조건 에러 방지)
            if (row.in_user && !validUserIds.has(String(row.in_user).trim())) {
                row.in_user = null;
            }

            const hasAssetNumber = row.asset_number && String(row.asset_number).trim() !== '';
            const hasDayOfStart = row.day_of_start && String(row.day_of_start).trim() !== '';
            const hasDayOfEnd = row.day_of_end && String(row.day_of_end).trim() !== '';
            return hasAssetNumber && hasDayOfStart && hasDayOfEnd;
        });

        const skippedMissingCount = rawData.length - validDataRaw.length;

        if (validDataRaw.length === 0) {
            return response.error(res, `필수 정보(자산번호, 시작일, 종료일)가 누락되어 처리할 데이터가 없습니다.`, 400);
        }

        // 3. 입력 데이터 내 중복 제거 (asset_number 기준)
        const uniqueMap = new Map();
        const duplicateInInput = [];
        validDataRaw.forEach(row => {
            const key = String(row.asset_number).trim();
            if (uniqueMap.has(key)) {
                duplicateInInput.push(key);
            }
            uniqueMap.set(key, row);
        });
        const validData = Array.from(uniqueMap.values());
        const duplicateInInputCount = duplicateInInput.length;

        // 4. 기존 데이터 가져오기 (변경사항 확인용)
        const columnsToCompare = Object.keys(validData[0]);
        const assetNumbers = validData.map(row => String(row.asset_number).trim());
        const [existingRows] = await pool.query(
            `SELECT ${columnsToCompare.filter(c => c !== 'contract_month').map(c => `\`${c}\``).join(', ')} FROM assets WHERE asset_number IN (?)`,
            [assetNumbers]
        );

        const existingMap = new Map();
        existingRows.forEach(row => existingMap.set(String(row.asset_number), row));

        // 5. Upsert 실행
        await performUpsert('assets', 'asset_number', validData);

        // 6. 결과 분석
        let insertedCount = 0;
        let updatedCount = 0;
        let identicalCount = 0;

        validData.forEach(row => {
            const key = String(row.asset_number).trim();
            if (!existingMap.has(key)) {
                insertedCount++;
            } else {
                const existing = existingMap.get(key);
                const isChanged = columnsToCompare.filter(c => c !== 'contract_month').some(col => {
                    let dbVal = existing[col];
                    let inputVal = row[col];

                    if (dbVal === null || dbVal === undefined) dbVal = '';
                    if (inputVal === null || inputVal === undefined) inputVal = '';

                    if (dbVal instanceof Date) {
                        dbVal = dbVal.toISOString().split('T')[0];
                    }
                    // 입력 데이터의 날짜 형식도 YYYY-MM-DD로 정규화하여 비교
                    if (typeof inputVal === 'string' && inputVal.includes('T')) {
                        inputVal = inputVal.split('T')[0];
                    }

                    return String(dbVal).trim() !== String(inputVal).trim();
                });

                if (isChanged) updatedCount++;
                else identicalCount++;
            }
        });

        const totalCount = rawData.length;
        let message = `총 ${totalCount}건 처리 완료: 신규 ${insertedCount}건, 업데이트 ${updatedCount}건`;

        if (identicalCount > 0) message += `, 변경 없음 ${identicalCount}건`;
        if (skippedMissingCount > 0) message += `, 필수정보 누락 ${skippedMissingCount}건 제외`;
        if (duplicateInInputCount > 0) message += `, 입력 데이터 내 중복 ${duplicateInInputCount}건 제외 (마지막 값 적용)`;

        response.success(res, {
            total: totalCount,
            inserted: insertedCount,
            updated: updatedCount,
            identical: identicalCount,
            skipped: skippedMissingCount,
            duplicates: duplicateInInputCount,
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

        // 1. 필수 필드 검증 (cj_id) 및 데이터 정제
        const validDataRaw = rawData.filter(row => row.cj_id && String(row.cj_id).trim() !== '');
        const skippedMissingCount = rawData.length - validDataRaw.length;

        if (validDataRaw.length === 0) {
            return response.error(res, `필수 정보(사용자 ID)가 누락되어 처리할 데이터가 없습니다.`, 400);
        }

        // 2. 입력 데이터 내 중복 제거 (cj_id 기준)
        const uniqueMap = new Map();
        const duplicateInInput = [];
        validDataRaw.forEach(row => {
            const key = String(row.cj_id).trim();
            if (uniqueMap.has(key)) {
                duplicateInInput.push(key);
            }
            uniqueMap.set(key, row);
        });
        const validData = Array.from(uniqueMap.values());
        const duplicateInInputCount = duplicateInInput.length;

        // 3. 기존 데이터 가져오기 (변경사항 확인용)
        const columnsToCompare = Object.keys(validData[0]);
        const cjIds = validData.map(row => String(row.cj_id).trim());

        // 데이터가 많을 경우를 대비해 IN 절 파라미터 개수 제한 처리 (필요시)
        // 여기서는 일단 직접 처리
        const [existingRows] = await pool.query(
            `SELECT ${columnsToCompare.map(c => `\`${c}\``).join(', ')} FROM users WHERE cj_id IN (?)`,
            [cjIds]
        );

        const existingMap = new Map();
        existingRows.forEach(row => existingMap.set(String(row.cj_id), row));

        // 4. Upsert 실행
        await performUpsert('users', 'cj_id', validData);

        // 5. 결과 분석
        let insertedCount = 0;
        let updatedCount = 0;
        let identicalCount = 0;

        validData.forEach(row => {
            const key = String(row.cj_id).trim();
            if (!existingMap.has(key)) {
                insertedCount++;
            } else {
                const existing = existingMap.get(key);
                const isChanged = columnsToCompare.some(col => {
                    let dbVal = existing[col];
                    let inputVal = row[col];

                    if (dbVal === null || dbVal === undefined) dbVal = '';
                    if (inputVal === null || inputVal === undefined) inputVal = '';

                    return String(dbVal).trim() !== String(inputVal).trim();
                });

                if (isChanged) updatedCount++;
                else identicalCount++;
            }
        });

        const totalCount = rawData.length;
        let message = `총 ${totalCount}건 처리 완료: 신규 ${insertedCount}건, 업데이트 ${updatedCount}건`;

        if (identicalCount > 0) message += `, 변경 없음 ${identicalCount}건`;
        if (skippedMissingCount > 0) message += `, 필수정보 누락 ${skippedMissingCount}건 제외`;
        if (duplicateInInputCount > 0) message += `, 입력 데이터 내 중복 ${duplicateInInputCount}건 제외 (마지막 값 적용)`;

        response.success(res, {
            total: totalCount,
            inserted: insertedCount,
            updated: updatedCount,
            identical: identicalCount,
            skipped: skippedMissingCount,
            duplicates: duplicateInInputCount,
            message: message
        });
    } catch (err) {
        console.error('User Import Error:', err);
        response.error(res, err.message);
    }
});

module.exports = router;
