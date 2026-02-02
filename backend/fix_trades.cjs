const mysql = require('mysql2/promise');
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'IClwx6F2VTbLZsEx',
    database: 'AssetDB',
    port: 3306
};

async function fixData() {
    try {
        const conn = await mysql.createConnection(dbConfig);

        // 1. 입고/반납 거래인데 사용자가 cjenc_inno가 아닌 것들 조회 (최근 데이터)
        const [rows] = await conn.query(`
            SELECT trade_id, asset_number, cj_id, ex_user, work_type 
            FROM trade 
            WHERE (work_type LIKE '입고%' OR work_type LIKE '반납%') 
              AND cj_id NOT IN ('cjenc_inno', 'aj_rent')
              AND timestamp > '2026-02-01'
        `);

        console.log(`Found ${rows.length} records to fix.`);

        for (const row of rows) {
            // cj_id(현재 잘못 들어간 사용자)를 ex_user로 보내고, cj_id를 cjenc_inno로 변경
            // 반납(termination) 계열은 aj_rent로 처리
            let targetCjId = 'cjenc_inno';
            if (row.work_type.startsWith('반납') || row.work_type.includes('폐기')) {
                targetCjId = 'aj_rent';
            }

            await conn.query(`
                UPDATE trade 
                SET ex_user = ?, cj_id = ? 
                WHERE trade_id = ?
            `, [row.cj_id, targetCjId, row.trade_id]);

            console.log(`Fixed trade_id ${row.trade_id}: ${row.cj_id} -> ${targetCjId}`);
        }

        await conn.end();
        console.log('Finished fixing data.');
    } catch (err) {
        console.error('Error fixing data:', err);
    }
}

fixData();
