const mysql = require('mysql2/promise');

(async () => {
  const config = {
    host: 'localhost',
    user: 'root',
    password: 'IClwx6F2VTbLZsEx',
    database: 'assetdb',
    port: 3306
  };

  try {
    const conn = await mysql.createConnection(config);
    const [columns] = await conn.query('DESCRIBE trade');
    console.log('trade 테이블 컬럼:');
    columns.forEach(c => console.log(`  - ${c.Field}`));
    conn.end();
  } catch (e) {
    console.log('에러:', e.message);
  }
})();
