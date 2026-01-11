const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    
    // cjenc_inno인 자산 확인
    const [cjencRows] = await conn.query('SELECT asset_id, asset_number, state, in_user FROM assets WHERE in_user = "cjenc_inno" LIMIT 5');
    console.log('cjenc_inno 자산 개수:', cjencRows.length);
    if (cjencRows.length > 0) {
      console.log(JSON.stringify(cjencRows, null, 2));
    }
    
    // in_user 값의 종류 확인
    const [distinctRows] = await conn.query('SELECT DISTINCT in_user FROM assets LIMIT 10');
    console.log('\n현재 in_user 값들:');
    console.log(JSON.stringify(distinctRows.map(r => r.in_user), null, 2));
    
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
