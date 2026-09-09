const request = require('supertest');
const app = require('../app');
const pool = require('../utils/db');

jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

jest.mock('../utils/dbInit', () => ({
    initDbSchema: jest.fn(),
}));

jest.mock('../utils/db', () => ({
    query: jest.fn(),
}));

describe('Settings API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/settings/:key', () => {
        it('should return setting value when key exists', async () => {
            const mockConfig = [{ key: 'category', visible: true }];
            pool.query.mockResolvedValueOnce([[{ s_value: JSON.stringify(mockConfig) }]]);

            const res = await request(app).get('/api/settings/table_headers_assets');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockConfig);
        });

        it('should return null when key does not exist', async () => {
            pool.query.mockResolvedValueOnce([[]]);

            const res = await request(app).get('/api/settings/non_existing_key');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeNull();
        });
    });

    describe('POST /api/settings/:key', () => {
        it('should save setting value', async () => {
            pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

            const value = [{ key: 'trade_id', visible: true }];
            const res = await request(app)
                .post('/api/settings/table_headers_trades')
                .send({ value });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(pool.query).toHaveBeenCalledTimes(1);
        });
    });
});
