var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

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
        ra.user_id, ra.user_name, ra.department,
        DATE_FORMAT(ra.handover_date, '%Y-%m-%d') as handover_date,
        ra.release_status, ra.it_room_stock, ra.low_format, ra.it_return, ra.mail_return, ra.actual_return,
        ra.complete, ra.remarks, ra.created_at,
        a.asset_id
      FROM returned_assets ra
      LEFT JOIN assets a ON ra.asset_number = a.asset_number
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
    const newReturnedAsset = req.body;

    // 1. Check if the asset's state in 'assets' table is already 'termination'
    const [assetCheck] = await connection.query(
      `SELECT state FROM assets WHERE asset_number = ?`,
      [newReturnedAsset.asset_number]
    );

    if (assetCheck.length > 0 && assetCheck[0].state === 'termination') {
      return error(res, '이미 반납 처리된 자산입니다.', 409);
    }

    // Insert into returned_assets
    const [insertResult] = await connection.query(
      `INSERT INTO returned_assets
      (asset_number, return_reason, model, serial_number, return_type, end_date, user_id, user_name, department, handover_date, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newReturnedAsset.asset_number,
        newReturnedAsset.return_reason || null,
        newReturnedAsset.model,
        newReturnedAsset.serial_number,
        newReturnedAsset.return_type || null,
        newReturnedAsset.end_date || null,
        newReturnedAsset.user_id || null,
        newReturnedAsset.user_name || null,
        newReturnedAsset.department || null,
        newReturnedAsset.handover_date || null,
        newReturnedAsset.remarks || null
      ]
    );

    if (insertResult.affectedRows > 0) {
      // 3. Update asset state in 'assets' table to 'termination'
      const [updateAssetResult] = await connection.query(
        `UPDATE assets SET state = 'process-ter' WHERE asset_number = ?`,
        [newReturnedAsset.asset_number]
      );

      success(res, { id: insertResult.insertId, ...newReturnedAsset }, 201);
    } else {
      error(res, '반납 자산 추가에 실패했습니다.', 400);
    }
  } catch (err) {
    console.error(`POST /returned-assets - Error:`, err);
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return error(res, '이미 반납 처리된 동일한 자산 번호가 존재합니다.', 409);
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

    // Check if the asset exists
    const [existingAsset] = await pool.query(
      'SELECT * FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      return error(res, '반납 자산을 찾을 수 없습니다.', 404);
    }

    const fields = [];
    const values = [];

    for (const key in updateData) {
      // Exclude non-database fields from update
      if (['return_id', 'created_at', 'processing', 'asset_id'].includes(key)) continue;

      fields.push(`${key} = ?`);
      // Handle boolean checkboxes
      if (typeof updateData[key] === 'boolean') {
        values.push(updateData[key] ? 1 : 0);
      }
      // Handle date fields - ensure they're stored as strings to avoid timezone conversion
      else if ((key === 'handover_date' || key === 'end_date') && updateData[key]) {
        // If it's already a string in YYYY-MM-DD format, use it as-is
        const dateStr = typeof updateData[key] === 'string' ? updateData[key] : updateData[key].split('T')[0];
        values.push(dateStr);
      }
      else {
        values.push(updateData[key]);
      }
    }
    values.push(id); // for WHERE clause

    const sqlQuery = `UPDATE returned_assets SET ${fields.join(', ')} WHERE return_id = ?`;

    const [result] = await pool.query(sqlQuery, values);

    if (result.affectedRows > 0) {
      success(res, { id, ...updateData });
    } else {
      error(res, '반납 자산 정보 수정에 실패했습니다.', 400);
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

    // 1. Get the asset number from the return record
    const [existingAsset] = await connection.query(
      'SELECT asset_number FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      await connection.rollback();
      return error(res, '반납 자산을 찾을 수 없습니다.', 404);
    }

    const { asset_number } = existingAsset[0];

    // 2. Revert asset state to 'useable' in assets table
    await connection.query(
      "UPDATE assets SET state = 'useable' WHERE asset_number = ?",
      [asset_number]
    );

    // 3. Delete from returned_assets table
    await connection.query(
      'DELETE FROM returned_assets WHERE return_id = ?',
      [id]
    );

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

    // Check if the asset exists
    const [existingAsset] = await pool.query(
      'SELECT * FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      return error(res, '반납 자산을 찾을 수 없습니다.', 404);
    }

    // Delete the asset
    const [result] = await pool.query(
      'DELETE FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (result.affectedRows > 0) {
      success(res, { message: '반납 자산이 성공적으로 삭제되었습니다.' });
    } else {
      error(res, '반납 자산 삭제에 실패했습니다.', 400);
    }
  } catch (err) {
    console.error(`DELETE /returned-assets/${req.params.id} - Error:`, err);
    error(res, err.message);
  }
});

module.exports = router;