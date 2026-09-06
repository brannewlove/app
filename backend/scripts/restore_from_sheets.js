const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

// backend 폴더 또는 프로젝트 루트의 .env 로드
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = require('../utils/db');

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
            console.log('예시: node backend/scripts/restore_from_sheets.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
            process.exit(1);
        }

        console.log(`\n🔄 [1/5] Google Sheets 인증 및 정보 조회 시작 (Sheet ID: ${spreadsheetId})...`);

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        let sheets;

        if (clientId && clientSecret && refreshToken) {
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            await oauth2Client.getAccessToken();
            sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        } else {
            console.log('⚠️ .env에 Google OAuth 설정이 없습니다. API Key 또는 공용 접근으로 시도합니다.');
            const apiKey = process.env.GOOGLE_API_KEY;
            sheets = google.sheets({ version: 'v4', auth: apiKey });
        }

        // 1. 스프레드시트 메타데이터 조회 (모든 시트 탭 이름 가져오기)
        const metaRes = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        const sheetNames = metaRes.data.sheets.map(s => s.properties.title);
        console.log(`✅ 확인된 시트 탭 목록: ${sheetNames.join(', ')}`);

        connection = await pool.getConnection();

        // 2. 외래키 제약조건 일시 해제
        console.log('\n🔒 [2/5] 외래키 체크 일시 비활성화...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 복원 우선순위 순서 (참조 관계 고려)
        const priorityOrder = ['users', 'assets', 'confirmed_assets', 'trade', 'assetlogs', 'settings'];
        const sortedSheetNames = [...sheetNames].sort((a, b) => {
            const idxA = priorityOrder.indexOf(a);
            const idxB = priorityOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });

        console.log('\n📥 [3/5] 데이터 읽기 및 DB 복원 시작...');

        for (const tableName of sortedSheetNames) {
            // DB에 해당 테이블이 존재하는지 확인
            const [tableCheck] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
            if (tableCheck.length === 0) {
                console.log(`⚠️ 테이블 '${tableName}'이 DB에 존재하지 않아 건너뜁니다.`);
                continue;
            }

            console.log(`\n--- 📄 [시트: ${tableName}] 데이터 처리 중 ---`);

            // 시트 데이터 가져오기
            const sheetData = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${tableName}'!A1:ZZ`,
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING'
            });

            const rows = sheetData.data.values;
            if (!rows || rows.length <= 1) {
                console.log(`ℹ️ '${tableName}' 시트에 데이터가 없거나 헤더만 있습니다.`);
                continue;
            }

            const headers = rows[0].map(h => String(h).trim());
            const dataRows = rows.slice(1);

            // DB 컬럼 정보 조회
            const [columnsInfo] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
            const validDbColumns = new Set(columnsInfo.map(c => c.Field));
            const generatedColumns = new Set(
                columnsInfo.filter(c => c.Extra && c.Extra.includes('VIRTUAL') || c.Extra.includes('STORED')).map(c => c.Field)
            );

            // 시트 헤더 중 실제 DB에 존재하고 가상(Generated) 컬럼이 아닌 것만 필터링
            const validHeaderIndices = [];
            const targetColumns = [];

            headers.forEach((header, index) => {
                if (validDbColumns.has(header) && !generatedColumns.has(header)) {
                    validHeaderIndices.push(index);
                    targetColumns.push(header);
                }
            });

            if (targetColumns.length === 0) {
                console.log(`⚠️ '${tableName}' 시트의 컬럼이 DB 테이블과 일치하지 않습니다.`);
                continue;
            }

            // 기존 데이터 삭제 (Clean Restore)
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
            console.log(`🧹 '${tableName}' 테이블 초기화 완료`);

            // 일괄 삽입 (배치 처리)
            const BATCH_SIZE = 500;
            let totalInserted = 0;

            for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
                const batch = dataRows.slice(i, i + BATCH_SIZE);
                const values = [];

                for (const row of batch) {
                    const rowValues = validHeaderIndices.map(colIdx => {
                        let val = row[colIdx];
                        if (val === undefined || val === null || val === '') {
                            return null;
                        }
                        return val;
                    });
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

        // 4. 외래키 체크 다시 활성화
        console.log('\n🔓 [4/5] 외래키 체크 재활성화...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('\n🎉 [5/5] 구글 시트 백업 데이터가 DB로 성공적으로 복원되었습니다!\n');
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

// CLI 실행 처리
const args = process.argv.slice(2);
const targetId = args[0];
restoreFromGoogleSheets(targetId);
