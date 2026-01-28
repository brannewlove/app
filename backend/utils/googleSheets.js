const { google } = require('googleapis');
const pool = require('./db');
const path = require('path');

/**
 * 구글 인증 객체 생성 (OAuth 2.0 방식)
 */
async function getGoogleAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        const error = new Error('Google OAuth 설정 정보가 .env에 누락되었습니다.');
        error.code = 'AUTH_CONFIG_MISSING';
        throw error;
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // 토큰 유효성 검사
    try {
        await oauth2Client.getAccessToken();
    } catch (err) {
        const error = new Error('구글 인증 토큰이 만료되었습니다. 관리자에게 토큰 갱신을 요청하세요.');
        error.code = 'AUTH_EXPIRED';
        throw error;
    }

    return oauth2Client;
}

/**
 * OAuth 토큰 상태 확인
 */
async function checkAuthStatus() {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            return { valid: false, error: 'AUTH_CONFIG_MISSING', message: 'OAuth 설정이 누락되었습니다.' };
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        await oauth2Client.getAccessToken();
        return { valid: true, message: '인증 상태 정상' };
    } catch (err) {
        return { valid: false, error: 'AUTH_EXPIRED', message: '토큰이 만료되었습니다. 갱신이 필요합니다.' };
    }
}

/**
 * 데이터를 Google Sheets 형식으로 변환 (날짜 처리 포함)
 */
function formatGenericForSheet(data, headers) {
    if (!data || data.length === 0) return [headers];

    const rows = data.map(item => headers.map(header => {
        let val = item[header];
        if (val === null || val === undefined) return '';

        // 날짜 객체 또는 날짜 문자열 감지
        if (val instanceof Date) {
            const date = val;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            // 시간 정보가 있으면 날짜+시간, 없으면 날짜만
            if (hours === '00' && minutes === '00' && seconds === '00') {
                return `${year}-${month}-${day}`;
            }
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }

        return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }));

    return [headers, ...rows];
}

/**
 * 모든 데이터베이스 테이블 백업 실행
 */
async function runBackup() {
    try {
        console.log('구글 시트 전체 테이블 백업 시작...');
        const folderId = process.env.GOOGLE_BACKUP_FOLDER_ID;

        if (!folderId) {
            throw new Error('GOOGLE_BACKUP_FOLDER_ID가 .env에 설정되지 않았습니다.');
        }

        const auth = await getGoogleAuth();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        // 1. 모든 테이블 목록 가져오기
        const [tableRows] = await pool.query('SHOW TABLES');
        const tableNames = tableRows.map(row => Object.values(row)[0]);

        // 2. 구글 시트 파일 생성 준비
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        const fileName = `ASDB_FULL_${timestamp}`;

        const fileMetadata = {
            name: fileName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [folderId]
        };

        const spreadsheet = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
            supportsAllDrives: true
        });

        const spreadsheetId = spreadsheet.data.id;
        console.log(`새 시트 생성됨: ${spreadsheetId} (${fileName})`);

        // 2-1. 소유권 이전 (설정된 경우)
        const personalEmail = process.env.GOOGLE_PERSONAL_EMAIL;
        if (personalEmail && personalEmail !== 'your-email@gmail.com') {
            try {
                await drive.permissions.create({
                    fileId: spreadsheetId,
                    transferOwnership: true,
                    requestBody: {
                        role: 'owner',
                        type: 'user',
                        emailAddress: personalEmail
                    }
                });
            } catch (permErr) {
                console.error('소유권 이전 실패:', permErr.message);
            }
        }

        // 3. 테이블별 데이터 가져오기 및 시트 생성
        const backupData = [];
        const sheetRequests = [];

        for (let i = 0; i < tableNames.length; i++) {
            const tableName = tableNames[i];
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
            const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
            const headers = columns.map(c => c.Field);

            const formattedData = formatGenericForSheet(rows, headers);

            backupData.push({
                range: `'${tableName}'!A1`,
                values: formattedData
            });

            if (i === 0) {
                sheetRequests.push({
                    updateSheetProperties: {
                        properties: { sheetId: 0, title: tableName },
                        fields: 'title'
                    }
                });
            } else {
                sheetRequests.push({
                    addSheet: {
                        properties: { title: tableName }
                    }
                });
            }
        }

        // 시트들 생성 및 제목 변경
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: sheetRequests }
        });

        // 데이터 채우기 (범위 사용을 위해 시트 생성 이후 실행)
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                data: backupData,
                valueInputOption: 'RAW'
            }
        });

        console.log(`총 ${tableNames.length}개 테이블 백업 완료.`);

        // 5. 로테이션 (기존 로직 유지)
        await rotateBackups(drive, folderId);

        return { success: true, fileName, spreadsheetId, tableCount: tableNames.length };
    } catch (err) {
        console.error('백업 실패:', err);
        throw err;
    }
}

/**
 * 오래된 백업 파일 삭제 (200개 유지)
 */
async function rotateBackups(drive, folderId) {
    try {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and name contains 'ASDB_' and trashed = false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        });

        const files = response.data.files;
        if (files.length > 200) {
            console.log(`파일 개수 초과 (${files.length}/200). 오래된 파일을 삭제합니다...`);
            for (let i = 200; i < files.length; i++) {
                await drive.files.delete({ fileId: files[i].id });
                console.log(`삭제된 파일: ${files[i].name} (${files[i].id})`);
            }
        }
    } catch (err) {
        console.error('파일 로테이션 실패:', err);
    }
}

module.exports = { runBackup, checkAuthStatus };
