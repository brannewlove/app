const pool = require('../utils/db');

async function generateData() {
    console.log('테스트 데이터 생성 시작...');

    try {
        // 1. 기존 테스트 데이터 삭제 (선택 사항 - 여기서는 추가만 함)
        // await pool.query("DELETE FROM assets WHERE asset_number LIKE 'TEST-%'");
        // await pool.query("DELETE FROM users WHERE cj_id LIKE 'test_user_%'");

        const users = [];
        const parts = ['개발팀', '인사팀', '회계팀', '영업팀', 'IT인프라팀'];

        // 10명의 사용자 생성
        for (let i = 1; i <= 10; i++) {
            const cj_id = `test_user_${i}`;
            const name = `테스터${i}`;
            const part = parts[i % parts.length];
            users.push([name, part, cj_id, 'active', 1]);
        }

        await pool.query(
            "INSERT IGNORE INTO users (name, part, cj_id, state, sec_level) VALUES ?",
            [users]
        );
        console.log('사용자 10명 생성 완료.');

        const assets = [];
        const categories = ['노트북', '데스크탑', '모니터', '워크스테이션'];
        const states = ['사용중', '재고', '수리중', '폐기대상'];

        const now = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(now.getFullYear() + 1);

        const startStr = now.toISOString().split('T')[0];
        const endStr = nextYear.toISOString().split('T')[0];

        // 100개의 자산 생성
        for (let i = 1; i <= 100; i++) {
            const asset_number = `TEST-AS-${String(i).padStart(4, '0')}`;
            const category = categories[i % categories.length];
            const model = `${category}_Model_${i}`;
            const serial = `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const state = states[i % states.length];
            const in_user = i <= 50 ? `test_user_${(i % 10) + 1}` : null; // 앞 50개는 사용자 할당

            assets.push([
                asset_number, category, model, serial, state,
                in_user, startStr, endStr, 1000000 + (i * 10000)
            ]);
        }

        await pool.query(
            "INSERT IGNORE INTO assets (asset_number, category, model, serial_number, state, in_user, day_of_start, day_of_end, unit_price) VALUES ?",
            [assets]
        );
        console.log('자산 100개 생성 완료.');

    } catch (err) {
        console.error('데이터 생성 오류:', err);
    } finally {
        process.exit(0);
    }
}

generateData();
