require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function testDrive() {
    console.log('--- 구글 드라이브 연결 테스트 ---');
    const folderId = process.env.GOOGLE_BACKUP_FOLDER_ID;
    console.log('Folder ID:', folderId);

    const keyPath = path.join(__dirname, 'config/google-key.json');
    console.log('Key Path:', keyPath);

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log('폴더 정보 가져오는 중...');
        const res = await drive.files.get({
            fileId: folderId,
            fields: 'id, name, permissions'
        });
        console.log('연결 성공! 폴더명:', res.data.name);
        console.log('권한 리스트:', res.data.permissions.map(p => p.emailAddress).join(', '));
    } catch (err) {
        console.error('연결 실패:', err.message);
        if (err.response) {
            console.error('에러 데이터:', err.response.data);
        }
    }
}

testDrive();
