const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    
    // in_user가 cjenc_inno 이고 state가 useable인 자산 하나 조회
    const [cjencRows] = await conn.query('SELECT * FROM assets WHERE in_user = "cjenc_inno" AND state = "useable" LIMIT 1');
    
    if (cjencRows.length > 0) {
      console.log('Example asset for 대여:');
      const asset = cjencRows[0];
      console.log('Asset keys:', Object.keys(asset));
      console.log('in_user type:', typeof asset.in_user, 'value:', asset.in_user);
      console.log('state type:', typeof asset.state, 'value:', asset.state);
      console.log('Full asset:', JSON.stringify(asset, null, 2));
    } else {
      console.log('No suitable assets found');
    }
    
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
