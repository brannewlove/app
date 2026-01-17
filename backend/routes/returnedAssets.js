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

// 모든 요청 로깅 미들웨어
router.use((req, res, next) => {
  console.log(`[returnedAssets] ${req.method} ${req.url}`);
  next();
});

/* GET returned assets listing - 모든 반납 자산 조회 */
router.get('/', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    const [returnedAssets] = await connection.query(
      `SELECT * FROM returned_assets ORDER BY handover_date DESC`
    );
    connection.release();

    res.json({
      success: true,
      data: returnedAssets,
      count: returnedAssets.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* POST a new returned asset - 새로운 반납 자산 추가 */
router.post('/', async (req, res, next) => {
  let connection;
  try {
    const newReturnedAsset = req.body;
    connection = await pool.getConnection();

    // 1. Check if the asset's state in 'assets' table is already 'termination'
    const [assetCheck] = await connection.query(
      `SELECT state FROM assets WHERE asset_number = ?`,
      [newReturnedAsset.asset_number]
    );

    if (assetCheck.length > 0 && assetCheck[0].state === 'termination') {
      connection.release();
      return res.status(409).json({
        success: false,
        error: '이미 반납 처리된 자산입니다.'
      });
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

      if (updateAssetResult.affectedRows > 0) {
        res.status(201).json({
          success: true,
          message: '반납 자산이 성공적으로 추가되었으며, 원본 자산 상태가 업데이트되었습니다.',
          data: { id: insertResult.insertId, ...newReturnedAsset }
        });
      } else {
        // If asset state update fails but returned_assets insert succeeded,
        // this is an inconsistent state, but still report success for the primary action.
        console.warn(`반납 자산은 추가되었으나, 원본 자산(asset_number: ${newReturnedAsset.asset_number}) 상태 업데이트에 실패했습니다.`);
        res.status(201).json({
          success: true,
          message: '반납 자산이 성공적으로 추가되었으나, 원본 자산 상태 업데이트에 실패했습니다.',
          data: { id: insertResult.insertId, ...newReturnedAsset }
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: '반납 자산 추가에 실패했습니다.'
      });
    }
  } catch (err) {
    console.error(`POST /returned-assets - Error:`, err);
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.status(409).json({
        success: false,
        error: '이미 반납 처리된 동일한 자산 번호가 존재합니다.'
      });
    }
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
/* PUT (update) a returned asset - 반납 자산 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const connection = await pool.getConnection();

    // Check if the asset exists
    const [existingAsset] = await connection.query(
      'SELECT * FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: '반납 자산을 찾을 수 없습니다.'
      });
    }

    const fields = [];
    const values = [];

    for (const key in updateData) {
      // Exclude non-database fields from update
      if (['return_id', 'created_at', 'processing'].includes(key)) continue;

      fields.push(`${key} = ?`);
      // Handle boolean checkboxes
      if (typeof updateData[key] === 'boolean') {
        values.push(updateData[key] ? 1 : 0);
      } else {
        values.push(updateData[key]);
      }
    }
    values.push(id); // for WHERE clause

    const [result] = await connection.query(
      `UPDATE returned_assets SET ${fields.join(', ')} WHERE return_id = ?`,
      values
    );
    connection.release();

    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: '반납 자산 정보가 성공적으로 수정되었습니다.',
        data: { id, ...updateData }
      });
    } else {
      res.status(400).json({
        success: false,
        error: '반납 자산 정보 수정에 실패했습니다.'
      });
    }
  } catch (err) {
    console.error(`PUT /returned-assets/${req.params.id} - Error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* POST cancel return processing - 반납 처리 취소 */
router.post('/cancel/:id', async (req, res, next) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Get the asset number from the return record
    const [existingAsset] = await connection.query(
      'SELECT asset_number FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: '반납 자산을 찾을 수 없습니다.'
      });
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
    connection.release();

    res.json({
      success: true,
      message: '반납 처리가 취소되었습니다.'
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(`POST /returned-assets/cancel/${req.params.id} - Error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/* DELETE a returned asset - 반납 자산 삭제 */
router.delete('/:id', async (req, res, next) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if the asset exists
    const [existingAsset] = await connection.query(
      'SELECT * FROM returned_assets WHERE return_id = ?',
      [id]
    );

    if (existingAsset.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: '반납 자산을 찾을 수 없습니다.'
      });
    }

    // Delete the asset
    const [result] = await connection.query(
      'DELETE FROM returned_assets WHERE return_id = ?',
      [id]
    );
    connection.release();

    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: '반납 자산이 성공적으로 삭제되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        error: '반납 자산 삭제에 실패했습니다.'
      });
    }
  } catch (err) {
    console.error(`DELETE /returned-assets/${req.params.id} - Error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;