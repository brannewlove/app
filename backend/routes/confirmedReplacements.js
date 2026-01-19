const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

// 확인된 교체 자산 조회
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT 
        id,
        asset_number,
        confirmed_at
      FROM confirmed_replacements
      ORDER BY confirmed_at DESC
    `);

        success(res, rows);
    } catch (err) {
        console.error('확인된 교체 자산 조회 에러:', err);
        error(res, err.message);
    }
});

// 교체 확인 저장
router.post('/', async (req, res) => {
    const { asset_number } = req.body;

    if (!asset_number) {
        return error(res, 'asset_number가 필요합니다.', 400);
    }

    try {
        await pool.query(`
      INSERT INTO confirmed_replacements (asset_number)
      VALUES (?)
      ON DUPLICATE KEY UPDATE confirmed_at = CURRENT_TIMESTAMP
    `, [asset_number]);

        success(res, { message: '교체 자산이 확인되었습니다.' });
    } catch (err) {
        console.error('교체 확인 저장 에러:', err);
        error(res, err.message);
    }
});

// 교체 확인 취소
router.delete('/:assetId', async (req, res) => {
    const { assetId } = req.params;

    try {
        const [result] = await pool.query(`
      DELETE FROM confirmed_replacements
      WHERE asset_number = ?
    `, [assetId]);

        success(res, {
            message: '교체 확인이 취소되었습니다.',
            deleted: result.affectedRows
        });
    } catch (err) {
        console.error('교체 확인 취소 에러:', err);
        error(res, err.message);
    }
});

module.exports = router;
