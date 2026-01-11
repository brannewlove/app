import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Kimsuji@888',
  database: 'assetdb',
  port: 3306
};

async function checkTables() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // 모든 테이블 조회
    const [tables] = await connection.query("SHOW TABLES");
    console.log('All tables in assetdb:');
    console.log(tables);
    
    // trades 테이블 구조 확인
    console.log('\n=== Checking trades table ===');
    try {
      const [structure] = await connection.query("DESCRIBE trades");
      console.log('trades table structure:');
      console.log(structure);
    } catch (err) {
      console.log('trades table not found:', err.message);
    }
    
    connection.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkTables();
