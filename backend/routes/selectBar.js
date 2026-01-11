var express = require('express');
var router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/db.config');

/**
 * GET /api/selectBar
 * 자동완성 검색 API
 * 쿼리 파라미터:
 * - query: 검색어
 * - table: 테이블명 (users, assets, trde)
 * - column: 검색 컬럼명
 */
router.get('/', async (req, res) => {
  try {
    const { query = '', table = 'users', column = 'user_id' } = req.query;

    console.log('SelectBar Request:', { query, table, column });

    // 테이블 검증
    const allowedTables = ['users', 'assets', 'trde'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: '유효하지 않은 테이블명' });
    }

    let sqlQuery = `SELECT * FROM \`${table}\``;
    let params = [];

    // 검색어가 있으면 WHERE 절 추가
    if (query && query.trim().length > 0) {
      // Users 테이블에서 cj_id 검색 시 name도 함께 검색
      if (table === 'users' && column === 'cj_id') {
        sqlQuery += ` WHERE CAST(\`cj_id\` AS CHAR) LIKE ? OR \`name\` LIKE ?`;
        params.push(`%${query}%`, `%${query}%`);
      } 
      // Assets 테이블에서 asset_id 검색 시 model도 함께 검색
      else if (table === 'assets' && column === 'asset_id') {
        sqlQuery += ` WHERE CAST(\`asset_id\` AS CHAR) LIKE ? OR \`model\` LIKE ? OR \`category\` LIKE ?`;
        params.push(`%${query}%`, `%${query}%`, `%${query}%`);
      }
      // 기본: 지정된 컬럼으로만 검색
      else {
        sqlQuery += ` WHERE CAST(\`${column}\` AS CHAR) LIKE ?`;
        params.push(`%${query}%`);
      }
    }

    // 정렬: 컬럼값 기준으로 정렬 (숫자 컬럼은 형변환)
    sqlQuery += ` ORDER BY CAST(\`${column}\` AS CHAR) ASC`;

    // 제한: 최대 500개 결과 (클라이언트에서 validateItem 필터링 후 10개로 제한)
    sqlQuery += ` LIMIT 500`;

    console.log('SQL Query:', sqlQuery, 'Params:', params);

    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(sqlQuery, params);
    connection.end();

    console.log(`Found ${rows.length} rows`);
    return res.json(rows || []);
  } catch (error) {
    console.error('SelectBar API 오류:', error);
    return res.status(500).json({ 
      error: 'Database query failed',
      message: error.message 
    });
  }
});

module.exports = router;
