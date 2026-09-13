const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

// 확인된 자산 조회
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        asset_number,
        cj_id,
        confirmed_at
      FROM confirmed_assets
      ORDER BY confirmed_at DESC
    `);

    success(res, rows);
  } catch (err) {
    console.error('확인된 자산 조회 에러:', err);
    error(res, err.message);
  }
});

// 특정 자산의 확인 상태 조회
router.get('/:assetId', async (req, res) => {
  const { assetId } = req.params;

  try {
    const [rows] = await pool.query(`
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

    success(res, rows[0] || null);
  } catch (err) {
    console.error('자산 확인 상태 조회 에러:', err);
    error(res, err.message);
  }
});

// 자산 확인 저장
router.post('/', async (req, res) => {
  const { asset_number, cj_id } = req.body;

  if (!asset_number || !cj_id) {
    return error(res, 'asset_number와 cj_id가 필요합니다.', 400);
  }

  try {
    await pool.query(`
      INSERT INTO confirmed_assets (asset_number, cj_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE confirmed_at = CURRENT_TIMESTAMP
    `, [asset_number, cj_id]);

    success(res, { message: '자산이 확인되었습니다.' });
  } catch (err) {
    console.error('자산 확인 저장 에러:', err);
    error(res, err.message);
  }
});

// 자산 확인 취소 (특정 자산ID와 cj_id)
router.delete('/:assetId/:cj_id', async (req, res) => {
  const { assetId, cj_id } = req.params;

  try {
    const [result] = await pool.query(`
      DELETE FROM confirmed_assets
      WHERE asset_number = ? AND cj_id = ?
    `, [assetId, cj_id]);

    success(res, {
      message: '자산 확인이 취소되었습니다.',
      deleted: result.affectedRows
    });
  } catch (err) {
    console.error('자산 확인 취소 에러:', err);
    error(res, err.message);
  }
});

// 자산 확인 삭제 (asset_id만으로 모든 확인 삭제)
router.delete('/:assetId', async (req, res) => {
  const { assetId } = req.params;

  try {
    const [result] = await pool.query(`
      DELETE FROM confirmed_assets
      WHERE asset_number = ?
    `, [assetId]);

    success(res, {
      message: '자산 모든 확인이 삭제되었습니다.',
      deleted: result.affectedRows
    });
  } catch (err) {
    console.error('자산 확인 삭제 에러:', err);
    error(res, err.message);
  }
});

module.exports = router;
