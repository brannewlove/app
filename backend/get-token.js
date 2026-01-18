const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('open'); // 만약 open 패키지가 없다면 수동으로 주소를 출력합니다.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = 3001;
const redirectUri = `http://localhost:${port}/oauth2callback`;

if (!clientId || !clientSecret) {
    console.error('에러: .env 파일에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 먼저 설정해주세요.');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // 매번 리프레시 토큰을 받기 위해 강제 동의 창 표시
    scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
    ],
});

const server = http.createServer(async (req, res) => {
    try {
        if (req.url.indexOf('/oauth2callback') > -1) {
            const qs = new url.URL(req.url, `http://localhost:${port}`).searchParams;
            const code = qs.get('code');

            res.end('인증이 완료되었습니다! 이 창을 닫고 터미널로 돌아가세요.');
            server.close();

            const { tokens } = await oauth2Client.getToken(code);
            console.log('\n--- 인증 성공! ---');
            console.log('아래 내용을 .env 파일에 추가하거나 업데이트하세요:\n');
            console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log('\n이제 이 토큰을 사용하여 백업을 진행할 수 있습니다.');
            process.exit(0);
        }
    } catch (e) {
        console.error('인증 처리 중 에러:', e.message);
        process.exit(1);
    }
}).listen(port, () => {
    console.log('\n1. 아래 URL을 브라우저에 붙여넣고 로그인하여 권한을 허용하세요:\n');
    console.log(authUrl);

    // 가능하면 자동으로 브라우저를 엽니다.
    try {
        require('child_process').exec(`start "" "${authUrl.replace(/&/g, '^&')}"`);
    } catch (e) {
        // 자동 열기 실패 시 수동 접속 안내
    }
});
