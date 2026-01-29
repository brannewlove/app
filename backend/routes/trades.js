var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

/* GET trades listing - 모든 거래 조회 (자산, 사용자 정보 포함) */
router.get('/', async (req, res, next) => {
  try {
    const [trades] = await pool.query(`
      SELECT 
        t.*,
        a.model,
        a.category,
        a.state,
        a.memo AS asset_memo,
        u.name,
        u.part,
        u2.name AS ex_user_name,
        u2.part AS ex_user_part
      FROM trade t
      LEFT JOIN assets a ON t.asset_number = a.asset_number
      LEFT JOIN users u ON t.cj_id = u.cj_id
      LEFT JOIN users u2 ON t.ex_user = u2.cj_id
    `);
    success(res, trades);
  } catch (err) {
    error(res, err.message);
  }
});

/* GET trade by id - ID로 특정 거래 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [trade] = await pool.query('SELECT * FROM trade WHERE trade_id = ?', [id]);

    if (trade.length === 0) {
      return error(res, '거래를 찾을 수 없습니다.', 404);
    }
    success(res, trade[0]);
  } catch (err) {
    error(res, err.message);
  }
});

/* PUT trade by id - 거래 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tradeData = req.body;

    // trade_id, asset_state, asset_in_user는 수정 불가능하므로 제외
    const { trade_id, asset_state, asset_in_user, ...updateData } = tradeData;

    if (Object.keys(updateData).length === 0) {
      return error(res, '수정할 데이터가 없습니다.', 400);
    }

    // 동적으로 UPDATE 쿼리 생성
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const query = `UPDATE trade SET ${setClause} WHERE trade_id = ?`;
    values.push(id);

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return error(res, '거래를 찾을 수 없습니다.', 404);
    }

    success(res, { trade_id: id, ...updateData });
  } catch (err) {
    error(res, err.message);
  }
});

/* POST new trades - 거래 목록 등록 */
router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const trades = req.body;
    if (!Array.isArray(trades) || trades.length === 0) {
      return error(res, '등록할 거래 데이터가 없습니다.', 400);
    }

    const results = [];
    for (const trade of trades) {
      // trade_id는 자동 생성되므로 제외, 나머지는 모두 저장 시도
      const { trade_id, ...insertData } = trade;
      if (Object.keys(insertData).length === 0) continue;

      const { work_type, asset_number, cj_id } = insertData;
      if (work_type && asset_number) {
        try {
          switch (work_type) {
            case '출고-신규지급':
            case '출고-신규교체':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                [cj_id, 'useable', asset_number, 'wait']
              );
              break;
            case '신규-재계약':
              await connection.query(
                `UPDATE assets SET 
                  in_user = ?, 
                  state = ?, 
                  day_of_start = ?, 
                  day_of_end = ?, 
                  unit_price = ? 
                WHERE asset_number = ?`,
                [
                  'cjenc_inno', // Always re-enters as stock
                  'useable', // Sets to useable state for stock
                  insertData.new_day_of_start,
                  insertData.new_day_of_end,
                  insertData.new_unit_price,
                  asset_number
                ]
              );
              break;
            case '출고-사용자변경':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                [cj_id, 'useable', asset_number, 'useable']
              );
              break;
            case '출고-재고교체':
            case '출고-재고지급':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                [cj_id, 'useable', asset_number, 'useable']
              );
              break;
            case '출고-대여':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                [cj_id, 'rent', asset_number, 'useable']
              );
              break;
            case '입고-수리필요':
              await connection.query(
                'UPDATE assets SET state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                ['repair', asset_number, 'useable']
              );
              break;
            case '입고-노후교체':
            case '입고-불량교체':
            case '입고-모델교체':
            case '입고-퇴사반납':
            case '입고-임의반납':
            case '입고-대여반납':
            case '입고-재사용':
              // Many of these are same: set to cjenc_inno/useable
              let targetInUser = 'cjenc_inno';
              let targetState = 'useable';
              if (work_type === '입고-대여반납') {
                await connection.query(
                  'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                  [targetInUser, targetState, asset_number, 'rent']
                );
              } else {
                await connection.query(
                  'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                  [targetInUser, targetState, asset_number]
                );
              }
              break;
            case '입고-휴직반납':
            case '입고-재입사예정':
              await connection.query(
                'UPDATE assets SET state = ? WHERE asset_number = ?',
                ['wait', asset_number]
              );
              break;
            case '출고-수리완료':
              await connection.query(
                'UPDATE assets SET state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                ['useable', asset_number, 'repair']
              );
              break;
            case '반납':
            case '입고-반납':
            case '반납-노후반납':
            case '반납-고장교체':
            case '반납-조기반납':
            case '반납-폐기':
            case '반납-기타':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                ['aj_rent', 'termination', asset_number]
              );
              break;
            case '이동':
              await connection.query(
                'UPDATE assets SET in_user = ?, state = ?, day_of_start = ? WHERE asset_number = ?',
                [cj_id, 'useable', insertData.work_date, asset_number]
              );
              break;
          }
        } catch (assetErr) {
          console.error(`Asset update failed (${asset_number}):`, assetErr.message);
        }
      }

      // trade 테이블에 없는 필드(재계약용 임시 데이터) 제거 후 저장
      const { new_day_of_start, new_day_of_end, new_unit_price, ...tradeInsertData } = insertData;

      const columns = Object.keys(tradeInsertData);
      const values = Object.values(tradeInsertData);
      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO trade (${columns.join(', ')}) VALUES (${placeholders})`;

      const [result] = await connection.query(query, values);
      results.push({ trade_id: result.insertId, ...tradeInsertData });
    }

    success(res, results);
  } catch (err) {
    error(res, err.message);
  } finally {
    connection.release();
  }
});

/* DELETE trade by id - 거래 취소 및 자산 상태 복구 */
router.delete('/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    // 1. 삭제할 거래 정보 조회
    const [tradeRows] = await connection.query('SELECT * FROM trade WHERE trade_id = ?', [id]);
    if (tradeRows.length === 0) {
      await connection.rollback();
      return error(res, '거래를 찾을 수 없습니다.', 404);
    }
    const trade = tradeRows[0];
    const { asset_number, work_type, ex_user, asset_state, asset_in_user, asset_memo } = trade;

    // 2. 자산 상태 복구 로직
    // - 거래 등록 시 저장된 필드들이 있으면 최우선 사용

    let revertUser = asset_in_user || ex_user || null;
    let revertState = asset_state || null;

    if (!revertState) {
      // 과거 데이터 대응: 작업 유형보고 추측
      if (work_type.startsWith('출고-신규')) revertState = 'wait';
      else if (work_type === '출고-대여' || work_type === '입고-대여반납') revertState = 'useable';
      else if (work_type === '입고-수리필요') revertState = 'useable';
      else if (work_type === '출고-수리완료') revertState = 'repair';
      else revertState = 'useable';
    }

    // 자산 테이블 업데이트 (메모 포함)
    let updateAssetQuery = 'UPDATE assets SET in_user = ?, state = ?';
    let params = [revertUser, revertState];

    // asset_memo가 명시적으로 기록된 경우에만 복구 (기존 데이터 호환성 보장)
    if (asset_memo !== undefined && asset_memo !== null) {
      updateAssetQuery += ', memo = ?';
      params.push(asset_memo);
    }

    updateAssetQuery += ' WHERE asset_number = ?';
    params.push(asset_number);

    await connection.query(updateAssetQuery, params);

    // 3. 거래 내역 삭제
    await connection.query('DELETE FROM trade WHERE trade_id = ?', [id]);

    await connection.commit();
    success(res, { message: '거래가 취소되었으며 자산 상태가 복구되었습니다.' });
  } catch (err) {
    await connection.rollback();
    console.error('거래 취소 오류:', err);
    error(res, '거래 취소 중 오류 발생: ' + err.message);
  } finally {
    connection.release();
  }
});

module.exports = router;
