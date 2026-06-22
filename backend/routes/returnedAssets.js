var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');
const returnService = require('../services/ReturnService');

// 모든 요청 로깅 미들웨어
router.use((req, res, next) => {
  console.log(`[returnedAssets] ${req.method} ${req.url}`);
  next();
});

/* GET returned assets listing - 모든 반납 자산 조회 */
router.get('/', async (req, res, next) => {
  try {
    const [returnedAssets] = await pool.query(
      `SELECT 
        ra.return_id, ra.asset_number, ra.return_reason, ra.model, ra.serial_number, ra.return_type,
        DATE_FORMAT(ra.end_date, '%Y-%m-%d') as end_date,
        ra.user_id,
        COALESCE(u.name, ra.user_name) AS user_name,
        COALESCE(u.part, ra.department) AS department,
        DATE_FORMAT(ra.handover_date, '%Y-%m-%d') as handover_date,
        ra.release_status, ra.it_room_stock, ra.low_format, ra.it_return, ra.mail_return, ra.actual_return,
        ra.complete, ra.remarks, ra.created_at,
        a.asset_id, a.memo AS asset_memo
      FROM returned_assets ra
      LEFT JOIN assets a ON ra.asset_number = a.asset_number
      LEFT JOIN users u ON ra.user_id = u.cj_id
      ORDER BY ra.created_at DESC`
    );
    success(res, returnedAssets);
  } catch (err) {
    error(res, err.message);
  }
});

/* POST a new returned asset - 새로운 반납 자산 추가 */
router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const newReturnedAsset = req.body;

    const insertId = await returnService.registerReturn(connection, newReturnedAsset);

    await connection.commit();
    success(res, { id: insertId, ...newReturnedAsset }, 201);
  } catch (err) {
    await connection.rollback();
    console.error(`POST /returned-assets - Error:`, err);
    if (err.message.includes('이미 반납 처리된')) {
      return error(res, err.message, 409);
    }
    error(res, err.message);
  } finally {
    connection.release();
  }
});

/* PUT (update) a returned asset - 반납 자산 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await returnService.updateReturn(id, updateData);

    if (updated) {
      success(res, { id, ...updateData });
    } else {
      error(res, '반납 자산을 찾을 수 없거나 수정에 실패했습니다.', 404);
    }
  } catch (err) {
    console.error(`PUT /returned-assets/${req.params.id} - Error:`, err);
    error(res, err.message);
  }
});

/* POST cancel return processing - 반납 처리 취소 */
router.post('/cancel/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    await returnService.cancelReturn(connection, id);

    await connection.commit();
    success(res, { message: '반납 처리가 취소되었습니다.' });
  } catch (err) {
    await connection.rollback();
    console.error(`POST /returned-assets/cancel/${req.params.id} - Error:`, err);
    error(res, err.message);
  } finally {
    connection.release();
  }
});

/* DELETE a returned asset - 반납 자산 삭제 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await returnService.delete(id, 'return_id');

    if (deleted) {
      success(res, { message: '반납 자산이 성공적으로 삭제되었습니다.' });
    } else {
      error(res, '반납 자산을 찾을 수 없습니다.', 404);
    }
  } catch (err) {
    console.error(`DELETE /returned-assets/${req.params.id} - Error:`, err);
    error(res, err.message);
  }
});

module.exports = router;


module.exports = router;