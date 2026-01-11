var express = require('express');
var router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/db.config');

// MySQL 연결 풀
const pool = mysql.createPool({
  connectionLimit: 10,
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  enableKeepAlive: true
});

router.get('/', async (req, res) => {
  const { asset_id } = req.query;

  if (!asset_id) {
    return res.status(400).json({ 
      success: false, 
      message: '자산ID가 필요합니다.' 
    });
  }

  try {
    const conn = await pool.getConnection();
    
    // trde 테이블에서 asset_id로 검색 (asset_id는 assets.asset_number 값)
    const query = `
      SELECT 
        t.trade_id,
        t.asset_id,
        t.work_type,
        t.cj_id,
        u.name as user_name,
        t.timestamp
      FROM trde t
      LEFT JOIN users u ON t.cj_id = u.cj_id
      WHERE t.asset_id = ?
      ORDER BY t.timestamp ASC
    `;

    console.log('쿼리 실행:', query);
    console.log('asset_id 파라미터:', asset_id);
    
    const [rows] = await conn.query(query, [asset_id]);
    
    console.log('조회 결과:', rows);
    
    conn.release();

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('자산 로그 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '자산 로그 조회 중 오류 발생',
      error: error.message
    });
  }
});

// 모든 자산의 현재 사용자 조회 (가장 최근 거래 기준)
router.get('/currentUsers', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    
    // 각 자산별로 가장 최근 사용자변경 작업을 조회
    // (이동, 입고만 포함 - 사용자 변경 작업)
    // (1단계: 사용자변경 작업에서 마지막 찾기)
    const query = `
      SELECT 
        t.asset_id,
        t.cj_id,
        COALESCE(u.name, 
          CASE 
            WHEN t.cj_id = 'cjenc_inno' THEN '건설경영혁신'
            WHEN t.cj_id = 'aj_rent' THEN 'AJ랜탈'
            ELSE t.cj_id 
          END
        ) as user_name,
        t.timestamp,
        t.work_type
      FROM (
        SELECT 
          asset_id,
          cj_id,
          timestamp,
          work_type,
          ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY timestamp DESC) as rn
        FROM trde
        WHERE work_type IN ('이동', '입고')
      ) t
      LEFT JOIN users u ON t.cj_id = u.cj_id
      WHERE t.rn = 1
      ORDER BY t.timestamp ASC
    `;

    console.log('현재 사용자 조회 쿼리 실행');
    
    const [rows] = await conn.query(query);
    
    console.log('현재 사용자 조회 결과:', rows.length, '개');
    console.log('반환 데이터:', JSON.stringify(rows.slice(0, 2), null, 2));
    
    conn.release();

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('현재 사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '현재 사용자 조회 중 오류 발생',
      error: error.message
    });
  }
});

module.exports = router;
