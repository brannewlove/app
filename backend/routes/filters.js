var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

/* GET saved filters listing */
router.get('/', async (req, res, next) => {
    try {
        const { page } = req.query;
        let query = 'SELECT * FROM saved_filters';
        let params = [];

        if (page) {
            query += ' WHERE page_context = ?';
            params.push(page);
        }

        query += ' ORDER BY sort_order ASC, created_at DESC';

        const [filters] = await pool.query(query, params);
        success(res, filters);
    } catch (err) {
        error(res, err.message);
    }
});

/* POST create a new saved filter */
router.post('/', async (req, res, next) => {
    try {
        const { name, page_context, filter_data } = req.body;

        if (!name || !page_context || !filter_data) {
            return error(res, '필수 필드가 누락되었습니다.', 400);
        }

        const [result] = await pool.query(
            'INSERT INTO saved_filters (name, page_context, filter_data) VALUES (?, ?, ?)',
            [name, page_context, JSON.stringify(filter_data)]
        );

        success(res, { id: result.insertId, name, page_context, filter_data });
    } catch (err) {
        error(res, err.message);
    }
});

/* PATCH update a saved filter (name or sort_order) */
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, sort_order, filter_data } = req.body;

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (sort_order !== undefined) {
            updates.push('sort_order = ?');
            params.push(sort_order);
        }
        if (filter_data !== undefined) {
            updates.push('filter_data = ?');
            params.push(typeof filter_data === 'string' ? filter_data : JSON.stringify(filter_data));
        }

        if (updates.length === 0) {
            return error(res, '수정할 데이터가 없습니다.', 400);
        }

        params.push(id);
        const [result] = await pool.query(
            `UPDATE saved_filters SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        if (result.affectedRows > 0) {
            success(res, { message: '필터가 수정되었습니다.' });
        } else {
            error(res, '필터를 찾을 수 없습니다.', 404);
        }
    } catch (err) {
        error(res, err.message);
    }
});

/* PUT reorder multiple filters */
router.put('/reorder', async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { orders } = req.body; // Array of { id, sort_order }

        if (!Array.isArray(orders)) {
            return error(res, '잘못된 형식의 데이터입니다.', 400);
        }

        await connection.beginTransaction();

        for (const item of orders) {
            await connection.query(
                'UPDATE saved_filters SET sort_order = ? WHERE id = ?',
                [item.sort_order, item.id]
            );
        }

        await connection.commit();
        success(res, { message: '순서가 저장되었습니다.' });
    } catch (err) {
        await connection.rollback();
        error(res, err.message);
    } finally {
        connection.release();
    }
});

/* DELETE a saved filter */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM saved_filters WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            success(res, { message: '필터가 삭제되었습니다.' });
        } else {
            error(res, '필터를 찾을 수 없거나 삭제에 실패했습니다.', 404);
        }
    } catch (err) {
        error(res, err.message);
    }
});

module.exports = router;
