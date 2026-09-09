const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

/**
 * GET /api/settings
 * 모든 설정 조회
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT s_key, s_value, updated_at FROM settings');
        const settings = {};
        for (const row of rows) {
            try {
                settings[row.s_key] = JSON.parse(row.s_value);
            } catch (e) {
                settings[row.s_key] = row.s_value;
            }
        }
        success(res, settings);
    } catch (err) {
        console.error('Get all settings error:', err);
        error(res, '설정 목록 조회 중 오류가 발생했습니다.');
    }
});

/**
 * GET /api/settings/:key
 * 특정 설정 키 조회
 */
router.get('/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const [rows] = await pool.query('SELECT s_value FROM settings WHERE s_key = ?', [key]);
        if (rows.length === 0) {
            return success(res, null);
        }
        let value = rows[0].s_value;
        try {
            value = JSON.parse(value);
        } catch (e) {
            // 그대로 문자열 유지
        }
        success(res, value);
    } catch (err) {
        console.error(`Get setting (${key}) error:`, err);
        error(res, '설정 조회 중 오류가 발생했습니다.');
    }
});

/**
 * POST /api/settings/:key
 * 특정 설정 키 저장 (Upsert)
 */
router.post('/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    try {
        const stringVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
        await pool.query(
            'INSERT INTO settings (s_key, s_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE s_value = ?',
            [key, stringVal, stringVal]
        );
        success(res, { message: '설정이 저장되었습니다.', key, value });
    } catch (err) {
        console.error(`Save setting (${key}) error:`, err);
        error(res, '설정 저장 중 오류가 발생했습니다.');
    }
});

module.exports = router;
