var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
    try {
        console.log('GET /api/dashboard called');
        const results = {};

        // 1. 전체 자산 수 (폐기/반납완료 제외)
        const [totalAssets] = await pool.query("SELECT COUNT(*) as count FROM assets WHERE state != 'termination'");
        results.total_assets = totalAssets[0].count;

        // 2. 상태별 자산 수
        const [stateStats] = await pool.query(`
            SELECT 
                CASE 
                    WHEN state = 'useable' AND in_user = 'cjenc_inno' THEN 'it-room-stock'
                    WHEN state = 'useable' AND in_user != 'cjenc_inno' THEN 'in-use'
                    WHEN state = 'hold' THEN 'wait'
                    ELSE state 
                END as state,
                COUNT(*) as count 
            FROM assets 
            WHERE state != 'termination'
            GROUP BY 
                CASE 
                    WHEN state = 'useable' AND in_user = 'cjenc_inno' THEN 'it-room-stock'
                    WHEN state = 'useable' AND in_user != 'cjenc_inno' THEN 'in-use'
                    WHEN state = 'hold' THEN 'wait'
                    ELSE state 
                END
        `);
        results.state_stats = stateStats;

        // 3. 카테고리별 자산 수
        const [categoryStats] = await pool.query(`
            SELECT category, COUNT(*) as count 
            FROM assets 
            WHERE state != 'termination'
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

        // 6. 활동 현황 (상세 내역 포함 - 년도별/월별)
        const [activityRaw] = await pool.query(`
            SELECT 
                YEAR(timestamp) as year, 
                MONTH(timestamp) as month,
                work_type,
                COUNT(*) as count
            FROM trade
            GROUP BY year, month, work_type
            ORDER BY year DESC, month DESC
        `);

        const getCategoryKey = (wt) => {
            if (!wt) return 'other';
            if (wt.includes('신규')) return 'new';
            if (wt.startsWith('입고')) return 'in';
            if (wt.startsWith('출고')) return 'out';
            if (wt.startsWith('반납')) return 'ret';
            return 'other';
        };

        const activityStats = [];
        const yearMap = {};

        activityRaw.forEach(row => {
            const { year, month, work_type, count } = row;
            const category = getCategoryKey(work_type);

            if (!yearMap[year]) {
                yearMap[year] = {
                    year: year,
                    new_count: 0, in_count: 0, out_count: 0, return_count: 0,
                    details: { new: {}, in: {}, out: {}, ret: {}, other: {} },
                    months: {}
                };
                activityStats.push(yearMap[year]);
            }

            const yData = yearMap[year];
            // Update year totals
            if (category === 'new') yData.new_count += count;
            else if (category === 'in') yData.in_count += count;
            else if (category === 'out') yData.out_count += count;
            else if (category === 'ret') yData.return_count += count;

            // Update year details
            yData.details[category][work_type] = (yData.details[category][work_type] || 0) + count;

            // Update month data
            if (!yData.months[month]) {
                yData.months[month] = {
                    month: month,
                    new_count: 0, in_count: 0, out_count: 0, return_count: 0,
                    details: { new: {}, in: {}, out: {}, ret: {}, other: {} }
                };
            }
            const mData = yData.months[month];
            if (category === 'new') mData.new_count += count;
            else if (category === 'in') mData.in_count += count;
            else if (category === 'out') mData.out_count += count;
            else if (category === 'ret') mData.return_count += count;

            mData.details[category][work_type] = (mData.details[category][work_type] || 0) + count;
        });

        // Object.values for months and sort
        activityStats.forEach(y => {
            y.months = Object.values(y.months).sort((a, b) => b.month - a.month);
        });

        results.activity_stats = activityStats;

        // 7. 장비 노후도 현황 (day_of_start 기준)
        const [ageStats] = await pool.query(`
            SELECT 
                CASE 
                    WHEN day_of_start IS NULL THEN '미지정'
                    WHEN day_of_start > DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN '1년 미만'
                    WHEN day_of_start > DATE_SUB(CURDATE(), INTERVAL 3 YEAR) THEN '1~3년'
                    WHEN day_of_start > DATE_SUB(CURDATE(), INTERVAL 4 YEAR) THEN '4년'
                    ELSE '4년 초과'
                END as age_group,
                COUNT(*) as count
            FROM assets 
            WHERE state != 'termination'
            GROUP BY age_group
            ORDER BY 
                CASE age_group
                    WHEN '1년 미만' THEN 1
                    WHEN '1~3년' THEN 2
                    WHEN '4년' THEN 3
                    WHEN '4년 초과' THEN 4
                    ELSE 5
                END
        `);
        results.age_stats = ageStats;

        success(res, results);
    } catch (err) {
        console.error('Dashboard Error:', err);
        error(res, err.message);
    }
});

module.exports = router;
