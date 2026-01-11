const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    
    // selectBar API가 반환할 데이터 확인 (asset_number로 검색)
    const [rows] = await conn.query('SELECT * FROM assets ORDER BY CAST(asset_number AS CHAR) ASC LIMIT 10');
    
    console.log('=== API Response Format ===');
    rows.forEach((asset, idx) => {
      console.log(`Asset ${idx + 1}:`, {
        asset_number: asset.asset_number,
        state: asset.state,
        in_user: asset.in_user
      });
    });
    
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
