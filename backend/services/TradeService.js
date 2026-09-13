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
                    ['hold', asset_number]
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

                // 3. 거래 내역 삽입 (허용된 컬럼만 엄격히 필터링하여 SQLi 및 Mass Assignment 방지)
                const ALLOWED_TRADE_COLUMNS = [
                    'asset_number', 'work_type', 'cj_id', 'asset_state',
                    'asset_in_user', 'asset_memo', 'memo', 'timestamp',
                    'ex_user', 'is_cancelled', 'cancelled_at', 'asset_snapshot'
                ];

                const validInsertData = {};
                for (const col of ALLOWED_TRADE_COLUMNS) {
                    if (insertData[col] !== undefined) {
                        validInsertData[col] = insertData[col];
                    }
                }

                const columns = Object.keys(validInsertData);
                if (columns.length === 0) {
                    throw new Error('등록할 유효한 거래 컬럼이 없습니다.');
                }
                const values = Object.values(validInsertData);
                const placeholders = columns.map(() => '?').join(', ');
                const [result] = await connection.query(
                    `INSERT INTO trade (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
                    values
                );

                results.push({ trade_id: result.insertId, ...validInsertData });
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
     * 거래 취소 및 자산 상태 복구 (새 거래 로그 생성 및 취소 사유 기록)
     * @param {number} id 취소 대상 거래 ID
     * @param {string} cancelReason 사용자가 입력한 취소 사유
     */
    async cancelTrade(id, cancelReason = '') {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 취소 대상 거래 정보 조회
            const [tradeRows] = await connection.query('SELECT * FROM trade WHERE trade_id = ?', [id]);
            if (tradeRows.length === 0) {
                throw new Error('거래를 찾을 수 없습니다.');
            }
            const originTrade = tradeRows[0];
            const { asset_number, work_type, ex_user, asset_state, asset_in_user, asset_memo, cj_id } = originTrade;

            // 2. 현재 자산 정보 조회
            const [assetRows] = await connection.query('SELECT * FROM assets WHERE asset_number = ?', [asset_number]);
            const currentAsset = assetRows.length > 0 ? assetRows[0] : null;

            let newWorkType = '';
            let newCjId = null;
            let newExUser = currentAsset ? currentAsset.in_user : cj_id;
            let newAssetState = currentAsset ? currentAsset.state : asset_state;
            let newAssetInUser = currentAsset ? currentAsset.in_user : cj_id;
            let newAssetMemo = currentAsset ? currentAsset.memo : null;

            const isRevertCancel = work_type.startsWith('취소-');
            const isNewRegistration = ['신규-계약', '신규-고장교체', '신규-기타'].includes(work_type);

            // 오직 자산이 삭제되는 신규 자산 취소(또는 그 철회) 시에만 스냅샷을 선별 저장하여 리소스 절약
            let newAssetSnapshot = null;
            if (isNewRegistration && currentAsset) {
                newAssetSnapshot = JSON.stringify(currentAsset);
            } else if (isRevertCancel && originTrade.asset_snapshot) {
                newAssetSnapshot = typeof originTrade.asset_snapshot === 'string'
                    ? originTrade.asset_snapshot
                    : JSON.stringify(originTrade.asset_snapshot);
            }

            if (isRevertCancel) {
                // ==========================================
                // Case A: "취소의 취소 (Re-cancel)" 처리
                // ==========================================
                const origType = work_type.replace(/^취소-/, '');
                newWorkType = `재실행-${origType}`;

                const revertUser = asset_in_user || ex_user || cj_id || null;
                const revertState = asset_state || 'useable';
                const revertMemo = asset_memo || null;

                let snapshotData = null;
                if (originTrade.asset_snapshot) {
                    try {
                        snapshotData = typeof originTrade.asset_snapshot === 'string'
                            ? JSON.parse(originTrade.asset_snapshot)
                            : originTrade.asset_snapshot;
                    } catch (e) {
                        snapshotData = null;
                    }
                }

                if (!currentAsset && snapshotData) {
                    // 신규 자산 취소로 삭제되었던 자산을 스냅샷의 전체 스펙(모델, 시리얼, 계약일, 단가 등)으로 완벽 복원 생성
                    await connection.query(
                        `INSERT INTO assets (
                            asset_number, category, model, serial_number, state, in_user, 
                            day_of_start, day_of_end, unit_price, memo
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            asset_number,
                            snapshotData.category || null,
                            snapshotData.model || null,
                            snapshotData.serial_number || null,
                            snapshotData.state || revertState,
                            snapshotData.in_user || revertUser,
                            snapshotData.day_of_start || null,
                            snapshotData.day_of_end || null,
                            snapshotData.unit_price || 0,
                            snapshotData.memo || revertMemo
                        ]
                    );
                } else if (!currentAsset) {
                    // 스냅샷이 없는 과거 데이터 폴백
                    await connection.query(
                        `INSERT INTO assets (asset_number, state, in_user, memo) VALUES (?, ?, ?, ?)`,
                        [asset_number, revertState, revertUser, revertMemo]
                    );
                } else {
                    await connection.query(
                        'UPDATE assets SET in_user = ?, state = ?, memo = ? WHERE asset_number = ?',
                        [revertUser, revertState, revertMemo, asset_number]
                    );
                }

                newCjId = revertUser;
                newExUser = currentAsset ? currentAsset.in_user : null;
            } else if (isNewRegistration) {
                // ==========================================
                // Case B: 신규 등록 거래 취소 (자산 삭제)
                // ==========================================
                newWorkType = `취소-${work_type}`;
                newCjId = null;
                newExUser = currentAsset ? currentAsset.in_user : cj_id;

                await connection.query('DELETE FROM assets WHERE asset_number = ?', [asset_number]);
            } else {
                // ==========================================
                // Case C: 일반 출고/입고/반납 거래 취소
                // ==========================================
                newWorkType = `취소-${work_type}`;

                let revertUser = asset_in_user || ex_user || null;
                let revertState = asset_state || null;

                if (!revertState) {
                    if (work_type.startsWith('출고-신규')) revertState = 'wait';
                    else if (work_type === '출고-대여' || work_type === '입고-대여반납' || work_type === '입고-수리필요') revertState = 'useable';
                    else if (work_type === '출고-수리완료') revertState = 'repair';
                    else revertState = 'useable';
                }

                let updateAssetQuery = 'UPDATE assets SET in_user = ?, state = ?';
                let params = [revertUser, revertState];

                if (asset_memo !== undefined && asset_memo !== null) {
                    updateAssetQuery += ', memo = ?';
                    params.push(asset_memo);
                }

                updateAssetQuery += ' WHERE asset_number = ?';
                params.push(asset_number);

                await connection.query(updateAssetQuery, params);

                newCjId = revertUser;
            }

            // 3. 신규 취소/재실행 거래 로그 레코드 INSERT
            const finalMemo = cancelReason 
                ? (isRevertCancel ? `[취소철회 사유] ${cancelReason}` : `[취소사유] ${cancelReason}`)
                : (isRevertCancel ? '취소 철회 (거래 재실행)' : '거래 취소');

            const [insertResult] = await connection.query(
                `INSERT INTO trade (
                    asset_number, work_type, cj_id, ex_user, 
                    asset_state, asset_in_user, asset_memo, memo, 
                    asset_snapshot, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    asset_number, newWorkType, newCjId, newExUser,
                    newAssetState, newAssetInUser, newAssetMemo, finalMemo,
                    newAssetSnapshot
                ]
            );

            await connection.commit();
            return {
                trade_id: insertResult.insertId,
                work_type: newWorkType,
                asset_number,
                cj_id: newCjId,
                memo: finalMemo
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = new TradeService();
