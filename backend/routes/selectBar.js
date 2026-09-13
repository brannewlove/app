var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

/**
 * GET /api/selectBar
 * 자동완성 검색 API
 * 쿼리 파라미터:
 * - query: 검색어
 * - table: 테이블명 (users, assets, trade)
 * - column: 검색 컬럼명
 */
router.get('/', async (req, res) => {
  try {
    const { query = '', table = 'users', column = 'user_id', state, exclude_state, in_user, not_in_user } = req.query;

    // 테이블 및 컬럼 화이트리스트 검증 (SQL Injection 방어)
    const allowedTables = ['users', 'assets', 'trade'];
    if (!allowedTables.includes(table)) {
      return error(res, '유효하지 않은 테이블명', 400);
    }

    const allowedColumns = {
      users: ['user_id', 'name', 'part', 'cj_id', 'state', 'sec_level'],
      assets: ['asset_id', 'category', 'model', 'serial_number', 'asset_number', 'day_of_start', 'day_of_end', 'unit_price', 'in_user', 'state', 'replacement', 'memo'],
      trade: ['trade_id', 'asset_number', 'work_type', 'cj_id', 'asset_state', 'asset_in_user', 'memo', 'timestamp', 'ex_user', 'is_cancelled']
    };

    if (!allowedColumns[table] || !allowedColumns[table].includes(column)) {
      return error(res, '유효하지 않은 검색 컬럼명입니다.', 400);
    }

    // users 테이블 조회 시 비밀번호(password) 제외하여 정보 유출 방지
    const selectFields = table === 'users'
      ? '`user_id`, `name`, `part`, `cj_id`, `state`, `sec_level`, `is_temporary`'
      : '*';

    let sqlQuery = `SELECT ${selectFields} FROM \`${table}\` WHERE 1=1`;
    let params = [];

    // 필터 조건 추가
    if (state) {
      sqlQuery += ` AND \`state\` = ?`;
      params.push(state);
    }
    if (exclude_state) {
      sqlQuery += ` AND \`state\` != ?`;
      params.push(exclude_state);
    }
    if (in_user) {
      sqlQuery += ` AND \`in_user\` = ?`;
      params.push(in_user);
    }
    if (not_in_user) {
      sqlQuery += ` AND \`in_user\` != ?`;
      params.push(not_in_user);
    }

    // 검색어가 있으면 검색 조건 추가
    if (query && query.trim().length > 0) {
      sqlQuery += ` AND (`;
      // Users 테이블에서 cj_id 검색 시 name도 함께 검색
      if (table === 'users' && column === 'cj_id') {
        sqlQuery += `CAST(\`cj_id\` AS CHAR) LIKE ? OR \`name\` LIKE ?`;
        params.push(`%${query}%`, `%${query}%`);
      }
      // Assets 테이블에서 asset_number 검색 시 model도 함께 검색
      else if (table === 'assets' && column === 'asset_number') {
        sqlQuery += `CAST(\`asset_id\` AS CHAR) LIKE ? OR \`model\` LIKE ? OR \`category\` LIKE ? OR \`asset_number\` LIKE ?`;
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }
      // 기본: 지정된 컬럼으로만 검색
      else {
        sqlQuery += `CAST(\`${column}\` AS CHAR) LIKE ?`;
        params.push(`%${query}%`);
      }
      sqlQuery += `)`;
    }

    // 정렬: 컬럼값 기준으로 정렬 (숫자 컬럼은 형변환)
    sqlQuery += ` ORDER BY CAST(\`${column}\` AS CHAR) ASC`;
    sqlQuery += ` LIMIT 500`;

    const [rows] = await pool.execute(sqlQuery, params);
    success(res, rows || []);
  } catch (err) {
    console.error('SelectBar API 오류:', err);
    error(res, 'Database query failed: ' + err.message);
  }
});

module.exports = router;
