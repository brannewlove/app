const request = require('supertest');
const app = require('../app');
const pool = require('../utils/db');

// Mock node-cron to prevent open handles from the scheduler in app.js
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

// Mock dbInit to prevent schema check queries from consuming mock queue
jest.mock('../utils/dbInit', () => ({
    initDbSchema: jest.fn(),
}));

// Mock the database pool
jest.mock('../utils/db', () => ({
    query: jest.fn(),
}));

describe('Assets API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/assets', () => {
        it('should return all assets', async () => {
            const mockAssets = [{ asset_id: 1, asset_number: 'A001', model: 'Laptop' }];
            pool.query.mockResolvedValue([mockAssets]);

            const res = await request(app).get('/api/assets');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockAssets);
            expect(pool.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('PUT /api/assets/:id', () => {
        it('should update an asset when data is valid', async () => {
            // Mock update result
            pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

            const updateData = { asset_number: 'A001', model: 'New Model' };

            const res = await request(app)
                .put('/api/assets/1')
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(pool.query).toHaveBeenCalledTimes(1);
        });

        it('should return 400 if asset_number is missing', async () => {
            const invalidData = { model: 'New Model' }; // Missing asset_number

            const res = await request(app)
                .put('/api/assets/1')
                .send(invalidData);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Asset Number is required');

            // Should not call DB update
            expect(pool.query).not.toHaveBeenCalled();
        });

        it('should return 404 if asset not found', async () => {
            pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

            const updateData = { asset_number: 'A999', model: 'Ghost' };

            const res = await request(app)
                .put('/api/assets/999')
                .send(updateData);

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('자산을 찾을 수 없거나 수정 실패');
        });
    });

    describe('POST /api/assets/bulk (신규-재계약 등 대량 등록)', () => {
        it('신규-재계약 시 기존 자산이 존재할 때 정상적으로 업데이트 및 트레이드 기록이 되어야 한다', async () => {
            const mockConn = {
                beginTransaction: jest.fn(),
                commit: jest.fn(),
                rollback: jest.fn(),
                query: jest.fn(),
                release: jest.fn()
            };
            pool.getConnection = jest.fn().mockResolvedValue(mockConn);

            const items = [{
                asset_number: 'AST-RENEW-01',
                category: '노트북',
                model: 'ThinkPad',
                serial_number: 'SN123',
                in_user: 'USER_RENEW',
                work_type: '신규-재계약',
                day_of_start: '2026-01-01',
                day_of_end: '2027-01-01',
                unit_price: 1500000,
                memo: '재계약 메모'
            }];

            const existingAsset = {
                asset_number: 'AST-RENEW-01',
                category: '노트북',
                model: 'ThinkPad',
                state: 'useable',
                in_user: 'USER_OLD'
            };

            mockConn.query.mockImplementation(async (sql, params) => {
                if (sql.includes('SELECT cj_id FROM users WHERE cj_id IN')) {
                    return [[{ cj_id: 'USER_RENEW' }, { cj_id: 'cjenc_inno' }]];
                }
                if (sql.includes('SELECT * FROM assets WHERE asset_number IN')) {
                    return [[existingAsset]];
                }
                if (sql.includes('UPDATE assets SET')) {
                    return [{ affectedRows: 1 }];
                }
                if (sql.includes('INSERT INTO trade')) {
                    return [{ insertId: 101 }];
                }
                return [[]];
            });

            const res = await request(app)
                .post('/api/assets/bulk')
                .send({ items, default_work_type: '신규-재계약' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.results).toContain('AST-RENEW-01');
            expect(mockConn.commit).toHaveBeenCalledTimes(1);
        });
    });
});
