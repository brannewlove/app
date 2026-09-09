const tradeService = require('../services/TradeService');
const pool = require('../utils/db');

jest.mock('../utils/db', () => {
    const mConn = {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        query: jest.fn(),
        release: jest.fn()
    };
    return {
        getConnection: jest.fn().mockResolvedValue(mConn),
        query: jest.fn()
    };
});

describe('TradeService - cancelTrade (신규 로그 생성 및 취소의 취소)', () => {
    let mockConn;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockConn = await pool.getConnection();
    });

    it('일반 출고 거래 취소 시 자산 복구 후 신규 취소 로그가 INSERT되고 사유가 저장되어야 한다', async () => {
        // Mock 거래 정보
        const mockTrade = {
            trade_id: 10,
            asset_number: 'AST-1001',
            work_type: '출고-재고지급',
            cj_id: 'USER_A',
            ex_user: 'cjenc_inno',
            asset_state: 'useable',
            asset_in_user: 'cjenc_inno',
            asset_memo: '초기 메모'
        };

        const mockAsset = {
            asset_number: 'AST-1001',
            state: 'useable',
            in_user: 'USER_A',
            memo: '초기 메모'
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockTrade]];
            }
            if (sql.includes('SELECT * FROM assets WHERE asset_number = ?')) {
                return [[mockAsset]];
            }
            if (sql.includes('UPDATE assets SET in_user = ?, state = ?')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO trade')) {
                return [{ insertId: 999 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(10, '사원 요청으로 취소');

        expect(result).toHaveProperty('trade_id', 999);
        expect(result.work_type).toBe('취소-출고-재고지급');
        expect(result.cj_id).toBe('cjenc_inno');
        expect(result.memo).toContain('사원 요청으로 취소');

        expect(mockConn.beginTransaction).toHaveBeenCalled();
        // 자산 복구 쿼리 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE assets SET in_user = ?, state = ?'),
            expect.arrayContaining(['cjenc_inno', 'useable', '초기 메모', 'AST-1001'])
        );
        // 신규 로그 INSERT 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO trade'),
            expect.arrayContaining(['AST-1001', '취소-출고-재고지급', 'cjenc_inno'])
        );
        expect(mockConn.commit).toHaveBeenCalled();
        expect(mockConn.release).toHaveBeenCalled();
    });

    it('신규 등록 자산 거래 취소 시 assets 테이블에서 자산을 삭제하고 취소 로그가 생성되어야 한다', async () => {
        const mockNewTrade = {
            trade_id: 12,
            asset_number: 'AST-9999',
            work_type: '신규-계약',
            cj_id: null,
            ex_user: null,
            asset_state: 'wait'
        };

        const mockAsset = {
            asset_number: 'AST-9999',
            state: 'wait',
            in_user: null
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockNewTrade]];
            }
            if (sql.includes('SELECT * FROM assets WHERE asset_number = ?')) {
                return [[mockAsset]];
            }
            if (sql.includes('DELETE FROM assets WHERE asset_number = ?')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO trade')) {
                return [{ insertId: 1000 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(12, '계약 취소');

        expect(result).toHaveProperty('trade_id', 1000);
        expect(result.work_type).toBe('취소-신규-계약');
        expect(mockConn.query).toHaveBeenCalledWith(
            'DELETE FROM assets WHERE asset_number = ?',
            ['AST-9999']
        );
    });

    it('취소 로그(취소-...)에 대해 다시 취소를 실행하면 취소 철회(재실행) 로그가 생성되고 자산이 원복되어야 한다 (취소의 취소)', async () => {
        const mockCancelTrade = {
            trade_id: 100,
            asset_number: 'AST-1001',
            work_type: '취소-출고-재고지급',
            cj_id: 'cjenc_inno',
            ex_user: 'USER_A',
            asset_state: 'useable',
            asset_in_user: 'USER_A',
            asset_memo: '사용자 메모'
        };

        const mockAsset = {
            asset_number: 'AST-1001',
            state: 'useable',
            in_user: 'cjenc_inno',
            memo: '초기 메모'
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockCancelTrade]];
            }
            if (sql.includes('SELECT * FROM assets WHERE asset_number = ?')) {
                return [[mockAsset]];
            }
            if (sql.includes('UPDATE assets SET in_user = ?, state = ?, memo = ?')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO trade')) {
                return [{ insertId: 1001 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(100, '재지급 필요에 따른 취소 철회');

        expect(result).toHaveProperty('trade_id', 1001);
        expect(result.work_type).toBe('재실행-출고-재고지급');
        expect(result.cj_id).toBe('USER_A');

        // 자산이 다시 USER_A로 복구되었는지 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            'UPDATE assets SET in_user = ?, state = ?, memo = ? WHERE asset_number = ?',
            ['USER_A', 'useable', '사용자 메모', 'AST-1001']
        );
    });
});
