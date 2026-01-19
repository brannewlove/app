const path = require('path');
const fs = require('fs');
const pool = require('./utils/db');

async function testNewLogLogic() {
    const asset_number = '2510260431';
    try {
        const tradeQuery = `
          SELECT
            t.trade_id,
            t.asset_number,
            t.work_type,
            t.cj_id,
            u1.name as user_name,
            t.ex_user,
            u2.name as ex_user_name,
            t.timestamp
          FROM trade t
          LEFT JOIN users u1 ON t.cj_id = u1.cj_id
          LEFT JOIN users u2 ON t.ex_user = u2.cj_id
          WHERE t.asset_number = ?
          ORDER BY t.timestamp ASC
        `;

        const [trades] = await pool.query(tradeQuery, [asset_number]);

        let results = [];

        if (trades.length > 0) {
            const firstTrade = trades[0];
            if (firstTrade.ex_user && firstTrade.ex_user !== 'cjenc_inno' && firstTrade.ex_user !== 'aj_rent') {
                results.push({
                    trade_id: 0,
                    asset_number: firstTrade.asset_number,
                    work_type: '기존 보유자',
                    cj_id: firstTrade.ex_user,
                    user_name: firstTrade.ex_user_name || firstTrade.ex_user,
                    timestamp: new Date(new Date(firstTrade.timestamp).getTime() - 1000).toISOString()
                });
            } else if (firstTrade.ex_user === 'cjenc_inno') {
                results.push({
                    trade_id: 0,
                    asset_number: firstTrade.asset_number,
                    work_type: '자산 등록',
                    cj_id: 'cjenc_inno',
                    user_name: '건설경영혁신',
                    timestamp: new Date(new Date(firstTrade.timestamp).getTime() - 1000).toISOString()
                });
            }

            trades.forEach(t => {
                results.push({
                    trade_id: t.trade_id,
                    work_type: t.work_type,
                    user_name: t.user_name || (t.cj_id === 'cjenc_inno' ? '건설경영혁신' : t.cj_id),
                    timestamp: t.timestamp
                });
            });
        }

        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testNewLogLogic();
