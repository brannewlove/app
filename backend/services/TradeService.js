const BaseService = require('./BaseService');

class TradeService extends BaseService {
    constructor() {
        super('trade');
    }

    /**
     * 특정 거래 작업 유형에 따른 자산 상태 변경 로직 처리
     * @param {Object} connection DB Connection (Transaction 지원을 위해 필수)
     * @param {Object} tradeData 거래 데이터
     */
    async processAssetTransition(connection, tradeData) {
        let { work_type, asset_number, cj_id, new_day_of_start, new_day_of_end, new_unit_price, work_date } = tradeData;

        if (!asset_number) return;
        asset_number = asset_number.trim();

        switch (work_type) {
            case '출고-신규지급':
            case '출고-신규교체':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    [cj_id, 'useable', asset_number, 'wait']
                );
                break;
            case '신규-재계약':
                await connection.query(
                    `UPDATE assets SET in_user = ?, state = ?, day_of_start = ?, day_of_end = ?, unit_price = ? WHERE asset_number = ?`,
                    ['cjenc_inno', 'useable', new_day_of_start, new_day_of_end, new_unit_price, asset_number]
                );
                break;
            case '출고-사용자변경':
            case '출고-재고교체':
            case '출고-재고지급':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    [cj_id, 'useable', asset_number, 'useable']
                );
                break;
            case '출고-대여':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    [cj_id, 'rent', asset_number, 'useable']
                );
                break;
            case '입고-수리필요':
                await connection.query(
                    'UPDATE assets SET state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    ['repair', asset_number, 'useable']
                );
                break;
            case '입고-노후교체':
            case '입고-불량교체':
            case '입고-모델교체':
            case '입고-퇴사반납':
            case '입고-임의반납':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                    ['cjenc_inno', 'useable', asset_number]
                );
                break;
            case '입고-대여반납':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    ['cjenc_inno', 'useable', asset_number, 'rent']
                );
                break;
            case '입고-휴직반납':
            case '입고-재입사예정':
                await connection.query(
                    'UPDATE assets SET state = ? WHERE asset_number = ?',
                    ['wait', asset_number]
                );
                break;
            case '출고-수리완료':
                await connection.query(
                    'UPDATE assets SET state = ? WHERE asset_number = ? AND (state = ? OR state = "hold")',
                    ['useable', asset_number, 'repair']
                );
                break;
            case '반납':
            case '입고-반납':
            case '반납-노후반납':
            case '반납-고장교체':
            case '반납-조기반납':
            case '반납-폐기':
            case '반납-기타':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ? WHERE asset_number = ?',
                    ['aj_rent', 'termination', asset_number]
                );
                break;
            case '이동':
                await connection.query(
                    'UPDATE assets SET in_user = ?, state = ?, day_of_start = ? WHERE asset_number = ?',
                    [cj_id, 'useable', work_date, asset_number]
                );
                break;
        }
    }

    /**
     * 다수의 거래 건을 트랜잭션으로 한꺼번에 등록
     * @param {Array} trades 거래 데이터 배열
     */
    async registerTrades(trades) {
        if (!Array.isArray(trades) || trades.length === 0) return [];

        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const results = [];

            for (const trade of trades) {
                const { trade_id, new_day_of_start, new_day_of_end, new_unit_price, ...insertData } = trade;

                // 1. 자산 상태 변경 처리
                await this.processAssetTransition(connection, trade);

                // 2. 거래 유형에 따른 고정 사용자 ID 보정 (비즈니스 로직 동기화)
                if (trade.work_type) {
                    if (trade.work_type.startsWith('입고-') && trade.work_type !== '입고-휴직반납' && trade.work_type !== '입고-재입사예정' && trade.work_type !== '입고-수리필요') {
                        insertData.cj_id = 'cjenc_inno';
                    } else if (trade.work_type.startsWith('반납-') || trade.work_type === '반납') {
                        insertData.cj_id = 'aj_rent';
                    }
                }

                // 3. 거래 내역 삽입
                const columns = Object.keys(insertData);
                const values = Object.values(insertData);
                const placeholders = columns.map(() => '?').join(', ');
                const [result] = await connection.query(
                    `INSERT INTO trade (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
                    values
                );

                results.push({ trade_id: result.insertId, ...insertData });
            }

            await connection.commit();
            return results;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * 거래 취소 및 자산 상태 복구
     * @param {number} id 거래 ID
     */
    async cancelTrade(id) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 거래 정보 조회
            const [tradeRows] = await connection.query('SELECT * FROM trade WHERE trade_id = ?', [id]);
            if (tradeRows.length === 0) {
                throw new Error('거래를 찾을 수 없습니다.');
            }
            const trade = tradeRows[0];
            const { asset_number, work_type, ex_user, asset_state, asset_in_user, asset_memo } = trade;

            // 2. 복구할 상태 결정
            let revertUser = asset_in_user || ex_user || null;
            let revertState = asset_state || null;

            if (!revertState) {
                if (work_type.startsWith('출고-신규')) revertState = 'wait';
                else if (work_type === '출고-대여' || work_type === '입고-대여반납' || work_type === '입고-수리필요') revertState = 'useable';
                else if (work_type === '출고-수리완료') revertState = 'repair';
                else revertState = 'useable';
            }

            // 3. 자산 테이블 복구
            let updateAssetQuery = 'UPDATE assets SET in_user = ?, state = ?';
            let params = [revertUser, revertState];

            if (asset_memo !== undefined && asset_memo !== null) {
                updateAssetQuery += ', memo = ?';
                params.push(asset_memo);
            }

            updateAssetQuery += ' WHERE asset_number = ?';
            params.push(asset_number);

            await connection.query(updateAssetQuery, params);

            // 4. 거래 내역 삭제
            await connection.query('DELETE FROM trade WHERE trade_id = ?', [id]);

            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = new TradeService();
