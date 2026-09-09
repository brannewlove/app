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

describe('TradeService - cancelTrade', () => {
    let mockConn;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockConn = await pool.getConnection();
    });

    it('취소 처리 시 assets 복구 후 trade 테이블에 is_cancelled = 1 및 cancelled_at 업데이트를 수행해야 한다', async () => {
        // Mock 거래 정보
        const mockTrade = {
            trade_id: 10,
            asset_number: 'AST-1001',
            work_type: '출고-재고지급',
            cj_id: 'USER_A',
            ex_user: 'cjenc_inno',
            asset_state: 'useable',
            asset_in_user: 'cjenc_inno',
            asset_memo: '초기 메모',
            is_cancelled: 0
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockTrade]];
            }
            if (sql.includes('UPDATE assets SET in_user = ?, state = ?')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('UPDATE trade SET is_cancelled = 1')) {
                return [{ affectedRows: 1 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(10);

        expect(result).toBe(true);
        expect(mockConn.beginTransaction).toHaveBeenCalled();
        // 자산 복구 쿼리 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE assets SET in_user = ?, state = ?'),
            expect.arrayContaining(['cjenc_inno', 'useable', '초기 메모', 'AST-1001'])
        );
        // DELETE가 아닌 UPDATE is_cancelled = 1 검증
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE trade SET is_cancelled = 1, cancelled_at = CURRENT_TIMESTAMP WHERE trade_id = ?'),
            [10]
        );
        expect(mockConn.commit).toHaveBeenCalled();
        expect(mockConn.release).toHaveBeenCalled();
    });

    it('신규-계약, 신규-고장교체, 신규-기타 거래 취소 시 assets 테이블에서 자산을 삭제해야 한다', async () => {
        const mockNewTrade = {
            trade_id: 12,
            asset_number: 'AST-9999',
            work_type: '신규-계약',
            cj_id: null,
            ex_user: null,
            asset_state: 'wait',
            is_cancelled: 0
        };

        mockConn.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockNewTrade]];
            }
            if (sql.includes('DELETE FROM assets WHERE asset_number = ?')) {
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('UPDATE trade SET is_cancelled = 1')) {
                return [{ affectedRows: 1 }];
            }
            return [[]];
        });

        const result = await tradeService.cancelTrade(12);

        expect(result).toBe(true);
        expect(mockConn.query).toHaveBeenCalledWith(
            'DELETE FROM assets WHERE asset_number = ?',
            ['AST-9999']
        );
        expect(mockConn.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE trade SET is_cancelled = 1, cancelled_at = CURRENT_TIMESTAMP WHERE trade_id = ?'),
            [12]
        );
    });

    it('이미 취소된 거래는 다시 취소할 수 없어야 한다', async () => {
        const mockCancelledTrade = {
            trade_id: 11,
            asset_number: 'AST-1002',
            work_type: '출고-대여',
            is_cancelled: 1
        };

        mockConn.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT * FROM trade WHERE trade_id = ?')) {
                return [[mockCancelledTrade]];
            }
            return [[]];
        });

        await expect(tradeService.cancelTrade(11)).rejects.toThrow('이미 취소된 거래입니다.');
        expect(mockConn.rollback).toHaveBeenCalled();
    });
});
