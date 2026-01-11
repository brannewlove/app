const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    
    // selectBar API와 동일한 쿼리 실행
    const sqlQuery = 'SELECT * FROM `assets` ORDER BY CAST(`asset_number` AS CHAR) ASC LIMIT 50';
    const [rows] = await conn.query(sqlQuery);
    
    console.log(`First 50 assets (by asset_number):`);
    console.log(`Total: ${rows.length}`);
    
    const cjencCount = rows.filter(r => r.in_user === 'cjenc_inno' && r.state === 'useable').length;
    console.log(`Rentable assets in first 50: ${cjencCount}`);
    
    console.log('\nFirst 10 assets:');
    rows.slice(0, 10).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.asset_number} - in_user: ${r.in_user}, state: ${r.state}`);
    });
    
    console.log('\nLooking for first rentable asset...');
    const firstRentable = rows.find(r => r.in_user === 'cjenc_inno' && r.state === 'useable');
    if (firstRentable) {
      console.log(`Found: Asset ${firstRentable.asset_number} at position ${rows.indexOf(firstRentable) + 1}`);
    } else {
      console.log('No rentable asset found in first 50!');
      
      // 전체에서 찾아보기
      const [allRows] = await conn.query('SELECT asset_number, in_user, state FROM assets ORDER BY CAST(asset_number AS CHAR) ASC');
      const firstPos = allRows.findIndex(r => r.in_user === 'cjenc_inno' && r.state === 'useable');
      console.log(`Rentable asset first appears at position: ${firstPos + 1} out of ${allRows.length}`);
    }
    
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
