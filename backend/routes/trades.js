var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');
const tradeService = require('../services/TradeService');

/* GET trades listing - 모든 거래 조회 (자산, 사용자 정보 포함) */
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10000;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const sort = req.query.sort || 'trade_id';
        const direction = req.query.direction === 'asc' ? 'ASC' : 'DESC';

        // 정렬 허용 컬럼 및 매핑 (SQL Injection 방지)
        const allowedColumns = {
            'trade_id': 't.trade_id',
            'timestamp': 't.timestamp',
            'work_type': 't.work_type',
            'asset_number': 't.asset_number',
            'model': 'a.model',
            'name': 'u.name',
            'part': 'u.part',
            'ex_user_name': 'u2.name',
            'ex_user_info': 'u2.name', // 가상 컬럼 대응
            'new_user_info': 'u.name'   // 가상 컬럼 대응
        };
        const orderColumn = allowedColumns[sort] || 't.trade_id';

        let whereClause = '';
        let params = [];
        let countParams = [];

        if (search) {
            whereClause = `
                WHERE t.asset_number LIKE ? 
                OR a.model LIKE ? 
                OR u.name LIKE ? 
                OR u.cj_id LIKE ?
                OR u.part LIKE ?
                OR t.work_type LIKE ?
                OR t.memo LIKE ?
                OR u2.name LIKE ?
                OR t.ex_user LIKE ?
                OR u2.part LIKE ?
            `;
            const searchPattern = `%${search}%`;
            params = [
                searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
                searchPattern, searchPattern, searchPattern, searchPattern, searchPattern
            ];
            countParams = [...params];
        }

        // 1. 전체 개수 조회 (검색 조건이 있을 때만 조인 포함)
        let countQuery = '';
        if (search) {
            countQuery = `
                SELECT COUNT(*) as total 
                FROM trade t
                LEFT JOIN assets a ON t.asset_number = a.asset_number
                LEFT JOIN users u ON t.cj_id = u.cj_id
                LEFT JOIN users u2 ON t.ex_user = u2.cj_id
                ${whereClause}
            `;
        } else {
            countQuery = `SELECT COUNT(*) as total FROM trade t`;
        }

        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        // 2. 페이징된 데이터 조회 (인덱스 활용을 위해 조인 조건 단순화)
        const dataQuery = `
      SELECT 
        t.*,
        a.model,
        a.category,
        a.state,
        a.memo AS asset_memo,
        u.name,
        u.part,
        u2.name AS ex_user_name,
        u2.part AS ex_user_part
      FROM trade t
      LEFT JOIN assets a ON t.asset_number = a.asset_number
      LEFT JOIN users u ON t.cj_id = u.cj_id
      LEFT JOIN users u2 ON t.ex_user = u2.cj_id
      ${whereClause}
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `;
        params.push(limit, offset);

        const [trades] = await pool.query(dataQuery, params);

        success(res, { total, data: trades });
    } catch (err) {
        error(res, err.message);
    }
});

/* GET trade by id - ID로 특정 거래 조회 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const trade = await tradeService.findById(id, 'trade_id');

        if (!trade) {
            return error(res, '거래를 찾을 수 없습니다.', 404);
        }
        success(res, trade);
    } catch (err) {
        error(res, err.message);
    }
});

/* PUT trade by id - 거래 정보 수정 */
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const tradeData = req.body;

        const { trade_id, asset_state, asset_in_user, ...updateData } = tradeData;

        if (Object.keys(updateData).length === 0) {
            return error(res, '수정할 데이터가 없습니다.', 400);
        }

        const updated = await tradeService.update(id, updateData, 'trade_id');

        if (!updated) {
            return error(res, '거래를 찾을 수 없습니다.', 404);
        }

        success(res, { trade_id: id, ...updateData });
    } catch (err) {
        error(res, err.message);
    }
});

/* POST new trades - 거래 목록 등록 */
router.post('/', async (req, res, next) => {
    try {
        const trades = req.body;
        if (!Array.isArray(trades) || trades.length === 0) {
            return error(res, '등록할 거래 데이터가 없습니다.', 400);
        }

        const result = await tradeService.registerTrades(trades);
        success(res, result);
    } catch (err) {
        console.error('거래 등록 오류:', err);
        error(res, err.message);
    }
});

/* DELETE trade by id - 거래 취소 및 자산 상태 복구 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await tradeService.cancelTrade(id);
        success(res, { message: '거래가 취소되었으며 자산 상태가 복구되었습니다.' });
    } catch (err) {
        console.error('거래 취소 오류:', err);
        error(res, '거래 취소 중 오류 발생: ' + err.message);
    }
});

module.exports = router;
