const express = require('express');
const router = express.Router();
const { runBackup, checkAuthStatus } = require('../utils/googleSheets');
const { success, error } = require('../utils/response');

/**
 * GET /api/backup/status
 * OAuth 토큰 상태 확인
 */
router.get('/status', async (req, res) => {
    try {
        const status = await checkAuthStatus();
        success(res, status);
    } catch (err) {
        console.error('Auth status check error:', err);
        error(res, err.message || '상태 확인 중 오류가 발생했습니다.');
    }
});

const pool = require('../utils/db');

/**
 * GET /api/backup/config
 * 백업 설정 조회
 */
router.get('/config', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT s_value FROM settings WHERE s_key = 'auto_backup_enabled'");
        const enabled = rows.length > 0 ? rows[0].s_value === 'true' : true;
        success(res, { auto_backup_enabled: enabled });
    } catch (err) {
        console.error('Get backup config error:', err);
        error(res, '설정 로드 중 오류가 발생했습니다.');
    }
});

/**
 * POST /api/backup/config
 * 백업 설정 저장
 */
router.post('/config', async (req, res) => {
    const { enabled } = req.body;
    try {
        await pool.query(
            "INSERT INTO settings (s_key, s_value) VALUES ('auto_backup_enabled', ?) ON DUPLICATE KEY UPDATE s_value = ?",
            [String(enabled), String(enabled)]
        );
        success(res, { message: '설정이 저장되었습니다.' });
    } catch (err) {
        console.error('Save backup config error:', err);
        error(res, '설정 저장 중 오류가 발생했습니다.');
    }
});

/**
 * POST /api/backup/manual
 * 수동 백업 실행
 */
router.post('/manual', async (req, res) => {
    try {
        const result = await runBackup();
        success(res, result);
    } catch (err) {
        console.error('Manual backup error:', err);
        // 인증 만료 오류인 경우 특별 처리
        if (err.code === 'AUTH_EXPIRED' || err.code === 'AUTH_CONFIG_MISSING') {
            return res.status(401).json({
                success: false,
                error: err.message,
                code: err.code
            });
        }
        error(res, err.message || '백업 중 오류가 발생했습니다.');
    }
});

module.exports = router;
