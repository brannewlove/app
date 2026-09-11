const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: '/app/.env' });

async function main() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
        console.error('❌ .env 파일에 GOOGLE_CLIENT_ID 및 GOOGLE_CLIENT_SECRET이 필요합니다.');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });

    console.log('\n======================================================');
    console.log('🔑 Google OAuth Refresh Token 발급 도우미');
    console.log('======================================================\n');
    console.log('1. 아래 URL을 웹 브라우저 주소창에 붙여넣어 접속 후 로그인을 진행하세요:\n');
    console.log(authUrl);
    console.log('\n2. 구글 로그인 및 [허용] 클릭 후 리디렉션된 브라우저 주소창(URL)을 확인합니다.');
    console.log('   (페이지가 안 열리거나 에러가 나더라도, 주소창의 code= 뒷부분 값만 복사하면 됩니다)');
    console.log('======================================================\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('📌 복사한 code 값 (또는 주소창의 전체 URL)을 입력하세요: ', async (input) => {
        let code = input.trim();
        if (code.includes('code=')) {
            try {
                const dummyUrl = code.startsWith('http') ? code : `http://localhost?${code}`;
                const urlObj = new URL(dummyUrl);
                code = urlObj.searchParams.get('code') || code;
            } catch (e) {
                const match = code.match(/code=([^&]+)/);
                if (match) code = match[1];
            }
        }

        try {
            const { tokens } = await oauth2Client.getToken(decodeURIComponent(code));
            if (tokens.refresh_token) {
                console.log('\n======================================================');
                console.log('🎉 새로운 GOOGLE_REFRESH_TOKEN 발급 성공!');
                console.log('======================================================');
                console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
                console.log('.env 파일의 GOOGLE_REFRESH_TOKEN 항목에 위 값을 저장하세요.');
            } else {
                console.log('\n⚠️ refresh_token이 포함되지 않았습니다.');
                console.log('Access Token:', tokens.access_token);
            }
        } catch (err) {
            console.error('\n❌ 토큰 교환 오류 발생:', err.message);
        }
        rl.close();
    });
}

main();
