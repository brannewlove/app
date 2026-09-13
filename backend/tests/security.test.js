const request = require('supertest');
const RateLimiter = require('../utils/RateLimiter');
const userService = require('../services/UserService');
const pool = require('../utils/db');

// Mock node-cron to prevent open handles from the scheduler in app.js
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

// Mock dbInit to prevent schema check queries from consuming mock queue
jest.mock('../utils/dbInit', () => ({
    initDbSchema: jest.fn(),
}));

// Mock googleSheets to prevent background backup scheduler
jest.mock('../utils/googleSheets', () => ({
    runBackup: jest.fn(),
    checkAndRunMissingBackup: jest.fn(),
    getTokensFromCode: jest.fn(),
}));

// Mock the database pool
jest.mock('../utils/db', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn(),
}));

const app = require('../app');

describe('Security Patches Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('RateLimiter Class', () => {
        let limiter;

        afterEach(() => {
            if (limiter) limiter.destroy();
        });

        it('should allow requests within limit and block when exceeded', () => {
            limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });

            const r1 = limiter.check('127.0.0.1');
            expect(r1.limited).toBe(false);
            expect(r1.remaining).toBe(2);

            const r2 = limiter.check('127.0.0.1');
            expect(r2.limited).toBe(false);
            expect(r2.remaining).toBe(1);

            const r3 = limiter.check('127.0.0.1');
            expect(r3.limited).toBe(false);
            expect(r3.remaining).toBe(0);

            const r4 = limiter.check('127.0.0.1');
            expect(r4.limited).toBe(true);
            expect(r4.remaining).toBe(0);
        });

        it('should reset counter when reset() is called', () => {
            limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
            limiter.check('user1');
            limiter.check('user1');
            expect(limiter.check('user1').limited).toBe(true);

            limiter.reset('user1');
            expect(limiter.check('user1').limited).toBe(false);
        });
    });

    describe('UserService - Sensitive Data Protection', () => {
        it('findAll should query users without password column', async () => {
            const mockUsers = [
                { user_id: 1, name: 'Hong', part: 'Dev', cj_id: 'CJ001', sec_level: 1 }
            ];
            pool.query.mockResolvedValueOnce([mockUsers]);

            const users = await userService.findAll();
            expect(users).toEqual(mockUsers);

            const calledQuery = pool.query.mock.calls[0][0];
            expect(calledQuery).not.toContain('password');
            expect(calledQuery).not.toContain('SELECT *');
        });

        it('getUserByIdWithAssets should delete password field from user object', async () => {
            const mockUser = {
                user_id: 1,
                name: 'Hong',
                cj_id: 'CJ001',
                password: '$2b$10$hashedpasswordhere'
            };
            pool.query
                .mockResolvedValueOnce([[mockUser]]) // findById
                .mockResolvedValueOnce([[]]); // asset counts

            const result = await userService.getUserByIdWithAssets(1);
            expect(result.password).toBeUndefined();
            expect(result.name).toBe('Hong');
        });

        it('getUserByCjIdWithAssets should delete password field from user object', async () => {
            const mockUser = {
                user_id: 2,
                name: 'Kim',
                cj_id: 'CJ002',
                password: '$2b$10$anotherhashedpassword'
            };
            pool.query
                .mockResolvedValueOnce([[mockUser]]) // findById
                .mockResolvedValueOnce([[]]); // asset counts

            const result = await userService.getUserByCjIdWithAssets('CJ002');
            expect(result.password).toBeUndefined();
            expect(result.name).toBe('Kim');
        });
    });

    describe('SelectBar API - SQL Injection & Column Validation', () => {
        it('should return 400 when invalid table is requested', async () => {
            const res = await request(app).get('/api/selectBar?table=secret_table&column=id');
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('유효하지 않은 테이블명');
        });

        it('should return 400 when unauthorized/malicious column is requested', async () => {
            const res = await request(app).get('/api/selectBar?table=users&column=password');
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('유효하지 않은 검색 컬럼명');
        });

        it('should return 400 when SQL injection attempt is in column parameter', async () => {
            const res = await request(app).get('/api/selectBar?table=users&column=user_id`--');
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('유효하지 않은 검색 컬럼명');
        });

        it('should exclude password when table=users with valid column', async () => {
            pool.execute.mockResolvedValueOnce([[{ user_id: 1, name: 'Hong', cj_id: 'CJ001' }]]);

            const res = await request(app).get('/api/selectBar?table=users&column=name&query=Hong');
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            const calledQuery = pool.execute.mock.calls[0][0];
            expect(calledQuery).not.toContain('password');
            expect(calledQuery).toContain('`user_id`, `name`, `part`, `cj_id`');
        });
    });

    describe('Users API - Mass Assignment Protection on PUT /:id', () => {
        it('should not allow modifying password or sec_level through general PUT', async () => {
            pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

            const res = await request(app)
                .put('/api/users/1')
                .send({
                    name: 'Updated Name',
                    password: 'hackedpassword',
                    sec_level: 99
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // update query in BaseService uses pool.query('UPDATE users SET ? WHERE user_id = ?', [data, id])
            const updateDataParam = pool.query.mock.calls[0][1][0];
            expect(updateDataParam.password).toBeUndefined();
            expect(updateDataParam.sec_level).toBeUndefined();
            expect(updateDataParam.name).toBe('Updated Name');
        });
    });
});
