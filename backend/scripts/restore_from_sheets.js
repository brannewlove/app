const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = require('../utils/db');

/**
 * CSV 파싱 유틸리티 (구글 시트 CSV 파싱)
 */
function parseCSV(text) {
    const lines = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (c === '"') {
            if (inQuotes && next === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push(cur);
            cur = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++;
            row.push(cur);
            if (row.length > 0 && row.some(v => v !== '')) {
                lines.push(row);
            }
            row = [];
            cur = '';
        } else {
            cur += c;
        }
    }
    if (cur || row.length > 0) {
        row.push(cur);
        if (row.some(v => v !== '')) {
            lines.push(row);
        }
    }
    return lines;
}

/**
 * Google Sheets에서 데이터를 가져와 DB로 복원하는 스크립트
 */
async function restoreFromGoogleSheets(spreadsheetIdInput) {
    let connection;
    try {
        const spreadsheetId = spreadsheetIdInput || process.env.GOOGLE_SHEET_ID;
        if (!spreadsheetId) {
            console.error('❌ Google Spreadsheet ID가 필요합니다.');
            console.log('사용법: node backend/scripts/restore_from_sheets.js <SPREADSHEET_ID>');
            process.exit(1);
        }

        console.log(`\n🔄 [1/5] Google Sheets 연결 확인 중 (Sheet ID: ${spreadsheetId})...`);

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        let useOAuth = false;
        let sheets;

        if (clientId && clientSecret && refreshToken) {
            try {
                const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
                oauth2Client.setCredentials({ refresh_token: refreshToken });
                await oauth2Client.getAccessToken();
                sheets = google.sheets({ version: 'v4', auth: oauth2Client });
                useOAuth = true;
                console.log('✅ Google OAuth 인증 성공');
            } catch (authErr) {
                console.log('⚠️ OAuth 인증 실패. 공개 CSV 다운로드 방식으로 전환합니다.');
            }
        } else {
            console.log('ℹ️ OAuth 미설정: 공개 시트 CSV 다운로드 방식으로 진행합니다.');
        }

        connection = await pool.getConnection();

        // 1. 복원 대상 테이블 목록 동적 조회
        console.log('\n📋 [2/5] 복원 대상 테이블 목록 동적 조회 중...');

        let sheetTitles = [];
        if (useOAuth) {
            try {
                const spreadsheetMeta = await sheets.spreadsheets.get({
                    spreadsheetId,
                    fields: 'sheets.properties.title'
                });
                if (spreadsheetMeta.data && spreadsheetMeta.data.sheets) {
                    sheetTitles = spreadsheetMeta.data.sheets.map(s => s.properties.title);
                    console.log(`✅ 구글 시트 탭(${sheetTitles.length}개) 감지 완료: ${sheetTitles.join(', ')}`);
                }
            } catch (e) {
                console.log(`⚠️ 구글 시트 탭 목록 조회 실패 (DB 및 기본 테이블 목록으로 진행): ${e.message}`);
            }
        }

        // 현재 DB에 존재하는 모든 테이블 목록 조회
        const [dbTableRows] = await connection.query('SHOW TABLES');
        const dbTables = dbTableRows.map(r => Object.values(r)[0]);

        const defaultTables = [
            'users',
            'assets',
            'confirmed_assets',
            'confirmed_replacements',
            'returned_assets',
            'trade',
            'assetlogs',
            'saved_filters',
            'settings'
        ];

        // 시트 탭, DB 테이블, 기본 테이블 목록을 통합하여 중복 없는 복원 대상 생성
        const targetTables = Array.from(new Set([...sheetTitles, ...dbTables, ...defaultTables]));

        console.log(`💡 동적 복원 대상 테이블 목록 (${targetTables.length}개): ${targetTables.join(', ')}`);

        // 2. 외래키 제약조건 일시 해제
        console.log('\n🔒 [3/5] 외래키 체크 일시 비활성화...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        console.log('\n📥 [4/5] 시트 데이터 다운로드 및 DB 복원 시작...');

        for (const tableName of targetTables) {
            const [tableCheck] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
            if (tableCheck.length === 0) {
                console.log(`⚠️ 테이블 '${tableName}'이 DB에 존재하지 않아 건너뜁니다.`);
                continue;
            }

            console.log(`\n--- 📄 [시트/테이블: ${tableName}] 처리 중 ---`);

            let rows = [];

            if (useOAuth) {
                try {
                    const sheetData = await sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range: `'${tableName}'!A1:ZZ`,
                        valueRenderOption: 'UNFORMATTED_VALUE',
                        dateTimeRenderOption: 'FORMATTED_STRING'
                    });
                    rows = sheetData.data.values || [];
                } catch (e) {
                    console.log(`⚠️ OAuth로 '${tableName}' 시트를 읽지 못했습니다 (${e.message}).`);
                }
            }

            // OAuth 실패 또는 미사용 시 공개 CSV 다운로드
            if (rows.length === 0) {
                try {
                    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tableName)}`;
                    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    }
                    const csvText = await res.text();
                    rows = parseCSV(csvText);
                } catch (csvErr) {
                    console.log(`⚠️ '${tableName}' 시트 데이터를 가져올 수 없습니다: ${csvErr.message}`);
                    continue;
                }
            }

            if (!rows || rows.length <= 1) {
                console.log(`ℹ️ '${tableName}' 시트에 데이터가 없거나 헤더만 있습니다.`);
                continue;
            }

            const headers = rows[0].map(h => String(h).trim().replace(/^"|"$/g, ''));
            const dataRows = rows.slice(1);

            // DB 컬럼 정보 조회
            const [columnsInfo] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
            const validDbColumns = new Set(columnsInfo.map(c => c.Field));
            const columnTypeMap = new Map(columnsInfo.map(c => [c.Field, (c.Type || '').toLowerCase()]));
            const generatedColumns = new Set(
                columnsInfo.filter(c => c.Extra && (c.Extra.includes('VIRTUAL') || c.Extra.includes('STORED'))).map(c => c.Field)
            );

            const validHeaderIndices = [];
            const targetColumns = [];

            headers.forEach((header, index) => {
                if (validDbColumns.has(header) && !generatedColumns.has(header)) {
                    validHeaderIndices.push(index);
                    targetColumns.push(header);
                }
            });

            if (targetColumns.length === 0) {
                console.log(`⚠️ '${tableName}' 시트의 컬럼과 DB 컬럼이 일치하지 않습니다.`);
                continue;
            }

            // 테이블 데이터 초기화
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);

            // 일괄 삽입
            const BATCH_SIZE = 500;
            let totalInserted = 0;

            for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
                const batch = dataRows.slice(i, i + BATCH_SIZE);
                const values = [];

                for (const row of batch) {
                    const rowValues = validHeaderIndices.map((colIdx, colPos) => {
                        let val = row[colIdx];
                        const colName = targetColumns[colPos];
                        const colType = columnTypeMap.get(colName) || '';

                        if (val === undefined || val === null || val === '') {
                            return null;
                        }

                        // 문자열 양 끝의 불필요한 이스케이프/따옴표 제거 (단, JSON 문자열 제외)
                        if (typeof val === 'string' && !colType.includes('json')) {
                            let s = val.trim();
                            if (s.startsWith('\\"') && s.endsWith('\\"') && s.length >= 4) {
                                s = s.slice(2, -2).trim();
                            }
                            val = s;
                        }

                        // JSON 타입 컬럼 안전 변환
                        if (colType.includes('json')) {
                            if (typeof val === 'object') {
                                return JSON.stringify(val);
                            }
                            if (typeof val === 'string') {
                                let trimmed = val.trim();
                                if (trimmed === '[object Object]' || trimmed === '') {
                                    return '{}';
                                }
                                if (trimmed.startsWith('\\"') && trimmed.endsWith('\\"') && trimmed.length >= 4) {
                                    trimmed = trimmed.slice(2, -2).trim();
                                }
                                try {
                                    JSON.parse(trimmed);
                                    return trimmed;
                                } catch (e) {
                                    return '{}';
                                }
                            }
                            return '{}';
                        }

                        // Boolean / tinyint(1) 처리
                        if (colType.includes('tinyint(1)')) {
                            if (typeof val === 'string') {
                                if (val.toUpperCase() === 'TRUE') return 1;
                                if (val.toUpperCase() === 'FALSE') return 0;
                            }
                        }

                        return val;
                    });

                    // saved_filters의 filter_data가 유실된 경우 name을 기반으로 복원
                    if (tableName === 'saved_filters') {
                        const fdIdx = targetColumns.indexOf('filter_data');
                        const nameIdx = targetColumns.indexOf('name');
                        if (fdIdx !== -1 && nameIdx !== -1) {
                            const curFd = rowValues[fdIdx];
                            const curName = rowValues[nameIdx];
                            if (!curFd || curFd === '{}' || curFd === 'null') {
                                rowValues[fdIdx] = JSON.stringify({ searchQuery: curName || '' });
                            }
                        }
                    }

                    values.push(rowValues);
                }

                if (values.length > 0) {
                    const sql = `INSERT INTO \`${tableName}\` (\`${targetColumns.join('`, `')}\`) VALUES ?`;
                    await connection.query(sql, [values]);
                    totalInserted += values.length;
                }
            }

            console.log(`✅ '${tableName}' 테이블: 총 ${totalInserted}건 복원 완료!`);
        }

        // 3. 외래키 체크 다시 활성화
        console.log('\n🔓 [5/5] 외래키 체크 재활성화...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('\n🎉 구글 시트 백업 데이터가 DB로 성공적으로 복원되었습니다!\n');
    } catch (error) {
        console.error('\n❌ 복원 중 오류 발생:', error);
        if (connection) {
            try {
                await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
            } catch (e) {}
        }
        process.exit(1);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

const args = process.argv.slice(2);
const targetId = args[0];
restoreFromGoogleSheets(targetId);
