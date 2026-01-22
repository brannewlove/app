const request = require('supertest');
const app = require('../app');
const pool = require('../utils/db');

// Mock node-cron to prevent open handles from the scheduler in app.js
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
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
            // Mock checking for existing asset
            pool.query.mockResolvedValueOnce([[{ asset_id: 1, asset_number: 'A001' }]]);
            // Mock update result
            pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

            const updateData = { asset_number: 'A001', model: 'New Model' };

            const res = await request(app)
                .put('/api/assets/1')
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(pool.query).toHaveBeenCalledTimes(2); // check exist + update
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
            pool.query.mockResolvedValueOnce([[]]); // Empty result for select

            const updateData = { asset_number: 'A999', model: 'Ghost' };

            const res = await request(app)
                .put('/api/assets/999')
                .send(updateData);

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('자산을 찾을 수 없습니다.');
        });
    });
});
