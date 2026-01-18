const express = require('express');
const router = express.Router();
const dbConfig = require('../config/db.config');
const mysql = require('mysql2/promise');

// 확인된 자산 조회
router.get('/', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT 
        id,
        asset_number,
        cj_id,
        confirmed_at
      FROM confirmed_assets
      ORDER BY confirmed_at DESC
    `);
    connection.end();

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('확인된 자산 조회 에러:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 특정 자산의 확인 상태 조회
router.get('/:assetId', async (req, res) => {
  const { assetId } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT 
        id,
        asset_number,
        cj_id,
        confirmed_at
      FROM confirmed_assets
      WHERE asset_number = ?
      ORDER BY confirmed_at DESC
      LIMIT 1
    `, [assetId]);
    connection.end();

    res.json({
      success: true,
      data: rows[0] || null
    });
  } catch (err) {
    console.error('자산 확인 상태 조회 에러:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 자산 확인 저장
router.post('/', async (req, res) => {
  const { asset_number, cj_id } = req.body;

  if (!asset_number || !cj_id) {
    return res.status(400).json({
      success: false,
      error: 'asset_number와 cj_id가 필요합니다.'
    });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // UNIQUE 제약 때문에 먼저 삭제 후 INSERT (또는 INSERT IGNORE)
    await connection.query(`
      INSERT INTO confirmed_assets (asset_number, cj_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE confirmed_at = CURRENT_TIMESTAMP
    `, [asset_number, cj_id]);

    connection.end();

    res.json({
      success: true,
      message: '자산이 확인되었습니다.'
    });
  } catch (err) {
    console.error('자산 확인 저장 에러:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 자산 확인 취소 (특정 자산ID와 cj_id)
router.delete('/:assetId/:cj_id', async (req, res) => {
  const { assetId, cj_id } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const result = await connection.query(`
      DELETE FROM confirmed_assets
      WHERE asset_number = ? AND cj_id = ?
    `, [assetId, cj_id]);
    connection.end();

    res.json({
      success: true,
      message: '자산 확인이 취소되었습니다.',
      deleted: result[0].affectedRows
    });
  } catch (err) {
    console.error('자산 확인 취소 에러:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 자산 확인 삭제 (asset_id만으로 모든 확인 삭제)
router.delete('/:assetId', async (req, res) => {
  const { assetId } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const result = await connection.query(`
      DELETE FROM confirmed_assets
      WHERE asset_number = ?
    `, [assetId]);
    connection.end();

    res.json({
      success: true,
      message: '자산 모든 확인이 삭제되었습니다.',
      deleted: result[0].affectedRows
    });
  } catch (err) {
    console.error('자산 확인 삭제 에러:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
