const mysql = require('mysql2/promise');
const dbConfig = require('./config/db.config');

(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);

    // 조인 쿼리 확인
    const [trades] = await conn.query(`
      SELECT 
        t.*,
        a.model,
        a.category,
        u.name,
        u.part
      FROM trade t
      LEFT JOIN assets a ON t.asset_id = a.asset_number
      LEFT JOIN users u ON t.cj_id = u.cj_id
      LIMIT 3
    `);

    console.log('First trade with JOIN:');
    console.log(JSON.stringify(trades[0], null, 2));

    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
