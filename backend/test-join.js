const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  const conn = await mysql.createConnection(dbConfig);
  
  // 올바른 JOIN으로 테스트
  const [result] = await conn.query(
    `SELECT a.asset_id, a.in_user, u.name as user_name, u.part as user_part 
     FROM assets a 
     LEFT JOIN users u ON a.in_user = u.cj_id 
     LIMIT 3`
  );
  console.log('Query result with cj_id JOIN:');
  result.forEach((r, i) => {
    console.log(`Row ${i}:`, JSON.stringify(r));
  });
  
  conn.end();
})();
