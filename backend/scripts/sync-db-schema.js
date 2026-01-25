const fs = require('fs');
const path = require('path');
const pool = require('../utils/db');

/**
 * DB_SCHEMA.sql 파일을 읽어 현재 데이터베이스에 누락된 컬럼을 자동으로 추가하는 스크립트입니다.
 * 주의: 컬럼 추가(ADD COLUMN)만 지원하며, 기존 컬럼 수정이나 삭제는 데이터 안전을 위해 수행하지 않습니다.
 */
async function syncSchema() {
    try {
        const sqlPath = path.join(__dirname, '../../DB_SCHEMA.sql');
        if (!fs.existsSync(sqlPath)) {
            console.error('❌ DB_SCHEMA.sql 파일을 찾을 수 없습니다.');
            return;
        }

        console.log('🔍 DB_SCHEMA.sql 분석 중...');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // 테이블 생성 구문 추출 (CREATE TABLE `name` (...))
        const tableMatches = sqlContent.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]+?)\) ENGINE/g);

        for (const match of tableMatches) {
            const tableName = match[1];
            const body = match[2];

            console.log(`\n-----------------------------------------`);
            console.log(`📋 테이블 확인: [${tableName}]`);

            // 현재 DB의 컬럼 정보 조회
            let dbColNames = [];
            try {
                const [dbColumns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
                dbColNames = dbColumns.map(c => c.Field);
            } catch (err) {
                console.log(`⚠️ 테이블이 존재하지 않거나 접근할 수 없습니다: ${tableName}`);
                continue;
            }

            // 스키마 파일에서 컬럼 정의들 추출
            // 콤마로 분리하되, 함수 괄호 내의 콤마는 무시해야 함
            const definitions = splitSqlDefinitions(body);

            for (const def of definitions) {
                const trimmedDef = def.trim();
                if (!trimmedDef || trimmedDef.startsWith('PRIMARY KEY') || trimmedDef.startsWith('KEY') ||
                    trimmedDef.startsWith('CONSTRAINT') || trimmedDef.startsWith('UNIQUE KEY') || trimmedDef.startsWith('INDEX')) {
                    continue;
                }

                // 컬럼명 추출 (`column_name` ...)
                const colNameMatch = trimmedDef.match(/^`(\w+)`/);
                if (!colNameMatch) continue;

                const colName = colNameMatch[1];

                if (!dbColNames.includes(colName)) {
                    console.log(`✨ 새 컬럼 발견: [${colName}]`);

                    try {
                        const alterQuery = `ALTER TABLE \`${tableName}\` ADD COLUMN ${trimmedDef}`;
                        await pool.query(alterQuery);
                        console.log(`   ✅ 성공: ${tableName} 테이블에 ${colName} 컬럼이 추가되었습니다.`);
                    } catch (err) {
                        console.error(`   ❌ 실패: ${colName} 추가 중 오류 발생:`, err.message);
                    }
                }
            }
        }

        console.log('\n✅ 스키마 동기화 작업이 완료되었습니다.');
    } catch (err) {
        console.error('❌ 작업 중 중대한 오류 발생:', err);
    } finally {
        process.exit();
    }
}

/**
 * SQL 정의문을 콤마 기준으로 분리하되, 여는 괄호와 닫는 괄호의 짝을 맞춥니다.
 * (VIRTUAL COLUMN 등의 복잡한 정의문 처리용)
 */
function splitSqlDefinitions(text) {
    const results = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '(') depth++;
        if (char === ')') depth--;

        if (char === ',' && depth === 0) {
            results.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        results.push(current.trim());
    }
    return results;
}

syncSchema();
