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
        'http://localhost:3001/oauth2callback'
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
 * 데이터를 [자산관리] 시트 형식으로 변환 (한글 헤더, 특정 순서)
 */
function formatAssetsForSheet(data) {
    if (!data || data.length === 0) return [];

    const headerMap = {
        'asset_number': '자산번호',
        'model': '모델',
        'category': '분류',
        'serial_number': '시리얼번호',
        'state': '상태',
        'in_user': '사용자ID',
        'user_name': '사용자명',
        'user_part': '부서',
        'day_of_start': '시작일',
        'day_of_end': '종료일',
        'contract_month': '계약월'
    };

    const headers = Object.values(headerMap);
    const keys = Object.keys(headerMap);

    const rows = data.map(item => keys.map(key => {
        let val = item[key];
        if (val === null || val === undefined) return '';
        if (key === 'day_of_start' || key === 'day_of_end') {
            const date = new Date(val);
            return isNaN(date.getTime()) ? val : date.toISOString().split('T')[0];
        }
        return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }));

    return [headers, ...rows];
}

/**
 * 데이터를 [거래관리] 시트 형식으로 변환 (영문 헤더, 특정 순서)
 */
function formatTradesForSheet(data) {
    if (!data || data.length === 0) return [];

    const headers = [
        'trade_id', 'timestamp', 'work_type', 'asset_number', 'model',
        'ex_user', 'ex_user_name', 'ex_user_part',
        'cj_id', 'name', 'part', 'memo'
    ];

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const rows = data.map(item => headers.map(header => {
        let val = item[header];
        if (val === null || val === undefined) return '';
        if (header === 'timestamp') {
            return formatDateTime(val);
        }
        return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }));

    return [headers, ...rows];
}

/**
 * 자산 및 거래 데이터 백업 실행
 */
async function runBackup() {
    try {
        console.log('구글 시트 백업 시작 (OAuth 방식 + 컬럼 동기화)...');
        const folderId = process.env.GOOGLE_BACKUP_FOLDER_ID;

        if (!folderId) {
            throw new Error('GOOGLE_BACKUP_FOLDER_ID가 .env에 설정되지 않았습니다.');
        }

        const auth = await getGoogleAuth();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        // 1. 데이터 가져오기
        const [assets] = await pool.query(`
            SELECT 
                a.*,
                u.name as user_name,
                u.part as user_part
            FROM assets a
            LEFT JOIN users u ON a.in_user = u.cj_id
            ORDER BY a.asset_id DESC
        `);
        const [trades] = await pool.query(`
            SELECT t.*, u.name as name, u.part as part,
                   e.name as ex_user_name, e.part as ex_user_part,
                   a.model as model
            FROM trade t 
            LEFT JOIN users u ON t.cj_id = u.cj_id
            LEFT JOIN users e ON t.ex_user = e.cj_id
            LEFT JOIN assets a ON t.asset_number = a.asset_number
            ORDER BY t.trade_id DESC
        `);

        // 2. 구글 시트 파일 생성
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        const fileName = `ASDB_${timestamp}`;

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

        // 2-1. 소유권 이전 (개인 이메일로)
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
                console.log(`소유권이 ${personalEmail}로 이전되었습니다.`);
            } catch (permErr) {
                console.error('소유권 이전 실패:', permErr.message);
                // 소유권 이전 실패는 백업 자체의 실패로 간주하지 않음
            }
        }

        // 3. 시트 초기화
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: { sheetId: 0, title: '자산관리' },
                            fields: 'title'
                        }
                    },
                    {
                        addSheet: {
                            properties: { title: '거래관리' }
                        }
                    }
                ]
            }
        });

        // 4. 데이터 저장
        const assetData = formatAssetsForSheet(assets);
        const tradeData = formatTradesForSheet(trades);

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                data: [
                    { range: '자산관리!A1', values: assetData },
                    { range: '거래관리!A1', values: tradeData }
                ],
                valueInputOption: 'RAW'
            }
        });

        console.log('데이터 업로드 완료.');

        // 5. 50개 파일 유지 로직 (오래된 파일 삭제)
        await rotateBackups(drive, folderId);

        return { success: true, fileName, spreadsheetId };
    } catch (err) {
        console.error('백업 실패:', err);
        throw err;
    }
}

/**
 * 오래된 백업 파일 삭제 (50개 유지)
 */
async function rotateBackups(drive, folderId) {
    try {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and name contains 'ASDB_' and trashed = false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        });

        const files = response.data.files;
        if (files.length > 50) {
            console.log(`파일 개수 초과 (${files.length}/50). 오래된 파일을 삭제합니다...`);
            for (let i = 50; i < files.length; i++) {
                await drive.files.delete({ fileId: files[i].id });
                console.log(`삭제된 파일: ${files[i].name} (${files[i].id})`);
            }
        }
    } catch (err) {
        console.error('파일 로테이션 실패:', err);
    }
}

module.exports = { runBackup, checkAuthStatus };
