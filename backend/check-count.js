const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    
    // 각 조건별 자산 개수 확인
    const [totalRows] = await conn.query('SELECT COUNT(*) as cnt FROM assets');
    console.log('Total assets:', totalRows[0].cnt);
    
    const [useableRows] = await conn.query('SELECT COUNT(*) as cnt FROM assets WHERE state = "useable"');
    console.log('Useable assets:', useableRows[0].cnt);
    
    const [cjencRows] = await conn.query('SELECT COUNT(*) as cnt FROM assets WHERE in_user = "cjenc_inno"');
    console.log('cjenc_inno owner assets:', cjencRows[0].cnt);
    
    const [bothRows] = await conn.query('SELECT COUNT(*) as cnt FROM assets WHERE in_user = "cjenc_inno" AND state = "useable"');
    console.log('Rentable (cjenc_inno + useable):', bothRows[0].cnt);
    
    // 샘플 표시
    const [samples] = await conn.query('SELECT asset_number, state, in_user FROM assets WHERE in_user = "cjenc_inno" AND state = "useable" LIMIT 3');
    console.log('\nSample rentable assets:');
    samples.forEach(s => {
      console.log(` - Asset ${s.asset_number}: state=${s.state}, in_user=${s.in_user}`);
    });
    
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
