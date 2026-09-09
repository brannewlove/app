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

        expect(mockConn.query).toHaveBeenCalledWith(
            'UPDATE assets SET in_user = ?, state = ?, memo = ? WHERE asset_number = ?',
            ['USER_A', 'useable', '사용자 메모', 'AST-1001']
        );
    });

    it('신규 등록 취소 로그(취소-신규-계약)에 대해 다시 취소를 실행하면 스냅샷 데이터를 기반으로 assets 테이블에 자산이 INSERT 복원되어야 한다', async () => {
        const mockSnapshot = {
            asset_number: 'AST-9999',
            category: '노트북',
            model: 'ThinkPad T14',
            serial_number: 'SN-12345',
            state: 'wait',
            in_user: 'cjenc_inno',
            day_of_start: '2026-01-01',
            day_of_end: '2028-12-31',
            unit_price: 1500000,
            memo: '신규 구매 장비'
        };

        const mockCancelTrade = {
            trade_id: 200,
            asset_number: 'AST-9999',
            work_type: '취소-신규-계약',
            cj_id: null,
            ex_user: 'cjenc_inno',
            asset_state: 'wait',
            asset_in_user: 'cjenc_inno',
            asset_snapshot: JSON.stringify(mockSnapshot)
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockCancelTrade]];
            }
            if (sql.includes('SELECT * FROM assets WHERE asset_number = ?')) {
                // 이미 삭제되어 없던 상태
                return [[]];
            }
            if (sql.includes('INSERT INTO assets')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO trade')) {
                return [{ insertId: 1002 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(200, '다시 신규 계약 유효화');

        expect(result).toHaveProperty('trade_id', 1002);
        expect(result.work_type).toBe('재실행-신규-계약');

        // assets 테이블에 스냅샷 데이터(모델명, 시리얼, 단가 등)로 INSERT 복원되었는지 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO assets'),
            [
                'AST-9999',
                '노트북',
                'ThinkPad T14',
                'SN-12345',
                'wait',
                'cjenc_inno',
                '2026-01-01',
                '2028-12-31',
                1500000,
                '신규 구매 장비'
            ]
        );
    });
});
