var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  const { asset_number } = req.query;

  if (!asset_number) {
    return error(res, '자산번호가 필요합니다.', 400);
  }

  try {
    // 1. 먼저 해당 자산의 모든 거래 기록을 조회 (timestamp 기준)
    const tradeQuery = `
      SELECT
        t.trade_id,
        t.asset_number,
        t.work_type,
        t.cj_id,
        u1.name as user_name,
        t.ex_user,
        u2.name as ex_user_name,
        t.timestamp
      FROM trde t
      LEFT JOIN users u1 ON t.cj_id = u1.cj_id
      LEFT JOIN users u2 ON t.ex_user = u2.cj_id
      WHERE t.asset_number = ?
      ORDER BY t.timestamp ASC
    `;

    const [trades] = await pool.query(tradeQuery, [asset_number]);

    let results = [];

    if (trades.length > 0) {
      // 거래 기록이 있는 경우

      // 첫 번째 거래의 이전 사용자(ex_user)를 최초 보유자로 추가 (있을 경우만)
      const firstTrade = trades[0];
      if (firstTrade.ex_user && firstTrade.ex_user !== 'cjenc_inno' && firstTrade.ex_user !== 'aj_rent') {
        results.push({
          trade_id: 0,
          asset_number: firstTrade.asset_number,
          work_type: '기존 보유자',
          cj_id: firstTrade.ex_user,
          user_name: firstTrade.ex_user_name || firstTrade.ex_user,
          timestamp: new Date(new Date(firstTrade.timestamp).getTime() - 1000).toISOString()
        });
      } else if (firstTrade.work_type.includes('신규')) {
        // 신규라면 '자산 등록' 등으로 표시? 일단 첫 거래부터 보여줌
      } else if (firstTrade.ex_user === 'cjenc_inno') {
        // 회사 입고 상태에서 시작된 경우
        results.push({
          trade_id: 0,
          asset_number: firstTrade.asset_number,
          work_type: '자산 등록',
          cj_id: 'cjenc_inno',
          user_name: '건설경영혁신',
          timestamp: new Date(new Date(firstTrade.timestamp).getTime() - 1000).toISOString()
        });
      }

      // 모든 거래 내역 추가
      trades.forEach(t => {
        results.push({
          trade_id: t.trade_id,
          asset_number: t.asset_number,
          work_type: t.work_type,
          cj_id: t.cj_id,
          user_name: t.user_name || (t.cj_id === 'cjenc_inno' ? '건설경영혁신' : (t.cj_id === 'aj_rent' ? 'AJ랜탈' : t.cj_id)),
          timestamp: t.timestamp
        });
      });
    } else {
      // 거래 기록이 아예 없는 경우에만 assets 테이블 정보를 기초 데이터로 사용
      const assetQuery = `
        SELECT 
          0 as trade_id,
          a.asset_number,
          '자산 등록' as work_type,
          a.in_user as cj_id,
          u.name as user_name,
          COALESCE(a.day_of_start, '2000-01-01') as timestamp
        FROM assets a
        LEFT JOIN users u ON a.in_user = u.cj_id
        WHERE a.asset_number = ?
      `;
      const [assetRows] = await pool.query(assetQuery, [asset_number]);
      results = assetRows;
    }

    success(res, results);
  } catch (err) {
    console.error('자산 로그 조회 오류:', err);
    error(res, '자산 로그 조회 중 오류 발생: ' + err.message);
  }
});

// 모든 자산의 현재 사용자 조회 (가장 최근 거래 기준)
router.get('/currentUsers', async (req, res) => {
  try {
    const query = `
      SELECT 
        t.asset_number,
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
          asset_number,
          cj_id,
          timestamp,
          work_type,
          ROW_NUMBER() OVER (PARTITION BY asset_number ORDER BY timestamp DESC) as rn
        FROM trde
        WHERE work_type LIKE '%입고%' OR work_type LIKE '%출고%'
      ) t
      LEFT JOIN users u ON t.cj_id = u.cj_id
      WHERE t.rn = 1
      ORDER BY t.timestamp ASC
    `;

    const [rows] = await pool.query(query);
    success(res, rows);
  } catch (err) {
    console.error('현재 사용자 조회 오류:', err);
    error(res, '현재 사용자 조회 중 오류 발생: ' + err.message);
  }
});

module.exports = router;
