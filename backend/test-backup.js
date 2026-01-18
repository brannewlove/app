require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { runBackup } = require('./utils/googleSheets');

async function test() {
    console.log('--- 백업 테스트 시작 ---');
    console.log('Environment Folder ID:', process.env.GOOGLE_BACKUP_FOLDER_ID);
    console.log('Key path exists:', require('fs').existsSync(require('path').join(__dirname, 'config/google-key.json')));
    try {
        const result = await runBackup();
        console.log('백업 성공:', result);
    } catch (err) {
        console.error('백업 실패 상세 에러:');
        console.error(err.message);
        console.error(err.stack);
    }
}

test();
