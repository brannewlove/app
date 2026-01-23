var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
    try {
        console.log('GET /api/dashboard called');
        const results = {};

        // 1. 전체 자산 수
        const [totalAssets] = await pool.query('SELECT COUNT(*) as count FROM assets');
        results.total_assets = totalAssets[0].count;

        // 2. 상태별 자산 수
        const [stateStats] = await pool.query(`
            SELECT state, COUNT(*) as count 
            FROM assets 
            GROUP BY state
        `);
        results.state_stats = stateStats;

        // 3. 카테고리별 자산 수
        const [categoryStats] = await pool.query(`
            SELECT category, COUNT(*) as count 
            FROM assets 
            GROUP BY category
        `);
        results.category_stats = categoryStats;

        // 4. 최근 거래 이력 (5건)
        const [recentTrades] = await pool.query(`
            SELECT 
                t.*,
                a.model,
                a.category
            FROM trade t
            LEFT JOIN assets a ON t.asset_number = a.asset_number
            ORDER BY t.trade_id DESC
            LIMIT 5
        `);
        results.recent_trades = recentTrades;

        // 5. 전체 사용자 수
        const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
        results.total_users = totalUsers[0].count;

        success(res, results);
    } catch (err) {
        console.error('Dashboard Error:', err);
        error(res, err.message);
    }
});

module.exports = router;
