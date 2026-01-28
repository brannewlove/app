const BaseService = require('./BaseService');

class AssetService extends BaseService {
    constructor() {
        super('assets');
    }

    async getAssetsWithUser(filters = {}) {
        const { onlyReplacements } = filters;
        let query;
        let params = [];

        if (onlyReplacements === 'true') {
            query = `
        SELECT 
          a.asset_id,
          a.asset_number,
          a.replacement,
          a_repl.model,
          a_repl.serial_number,
          u_repl.name as replacement_user_name,
          u_repl.part as replacement_user_part
        FROM assets a
        LEFT JOIN assets a_repl ON a.replacement = a_repl.asset_number
        LEFT JOIN users u_repl ON a_repl.in_user = u_repl.cj_id
        WHERE a.replacement IS NOT NULL AND a.replacement != ""
      `;
        } else {
            query = `
        SELECT 
          a.*,
          u.name as user_name,
          u.part as user_part
        FROM assets a
        LEFT JOIN users u ON a.in_user = u.cj_id
      `;
        }

        const [assets] = await this.pool.query(query, params);
        return assets;
    }

    async getAssetByIdWithUser(id) {
        const [asset] = await this.pool.query(
            `SELECT 
        a.asset_id, a.asset_number, a.category, a.model, a.serial_number, 
        a.state, a.in_user, a.day_of_start, a.day_of_end, a.unit_price, a.contract_month, a.replacement, a.memo,
        u.name as user_name,
        u.part as user_part
      FROM assets a
      LEFT JOIN users u ON a.in_user = u.cj_id
      WHERE a.asset_id = ?`,
            [id]
        );
        return asset[0];
    }

    async getAssetByNumberWithUser(assetNumber) {
        const [asset] = await this.pool.query(
            `SELECT 
        a.asset_id, a.asset_number, a.category, a.model, a.serial_number, 
        a.state, a.in_user, a.day_of_start, a.day_of_end, a.unit_price, a.contract_month, a.replacement, a.memo,
        u.name as user_name,
        u.part as user_part
      FROM assets a
      LEFT JOIN users u ON a.in_user = u.cj_id
      WHERE a.asset_number = ?`,
            [assetNumber]
        );
        return asset[0];
    }

    async updateAsset(id, updateData) {
        const {
            asset_id,
            contract_month,
            user_cj_id,
            user_name,
            user_part,
            asset_memo,
            ...dataToUpdate
        } = updateData;

        // 날짜 형식 변환
        if (dataToUpdate.day_of_start && typeof dataToUpdate.day_of_start === 'string') {
            dataToUpdate.day_of_start = dataToUpdate.day_of_start.split('T')[0];
        }
        if (dataToUpdate.day_of_end && typeof dataToUpdate.day_of_end === 'string') {
            dataToUpdate.day_of_end = dataToUpdate.day_of_end.split('T')[0];
        }

        return await this.update(id, dataToUpdate, 'asset_id');
    }

    async bulkInsertAssets(items, defaultWorkType) {
        const connection = await this.pool.getConnection();
        try {
            // 사용자 ID 검증
            const userIdsToCheck = new Set();
            items.forEach(item => {
                if (item.in_user) userIdsToCheck.add(item.in_user);
            });
            userIdsToCheck.add('cjenc_inno');

            const uniqueUserIds = Array.from(userIdsToCheck);
            const [existingUsers] = await connection.query(
                'SELECT cj_id FROM users WHERE cj_id IN (?)',
                [uniqueUserIds]
            );
            const existingUserIdSet = new Set(existingUsers.map(u => u.cj_id));
            const missingUsers = uniqueUserIds.filter(id => !existingUserIdSet.has(id));

            if (missingUsers.length > 0) {
                throw new Error(`존재하지 않는 사용자 ID가 포함되어 있습니다: ${missingUsers.join(', ')}`);
            }

            await connection.beginTransaction();

            const results = [];
            const errors = [];

            for (const item of items) {
                if (!item.asset_number || !item.category || !item.model) {
                    errors.push(`필수 필드 누락: ${item.asset_number || 'UNKNOWN'}`);
                    continue;
                }

                const workType = item.work_type || defaultWorkType || '신규-계약';
                const [existing] = await connection.query('SELECT * FROM assets WHERE asset_number = ?', [item.asset_number]);
                const assetExists = existing.length > 0;

                if (assetExists && workType !== '신규-재계약') {
                    errors.push(`이미 존재하는 자산번호: ${item.asset_number}`);
                    continue;
                }

                const formatDate = (dateValue) => {
                    if (!dateValue) return null;
                    const date = new Date(dateValue);
                    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
                };

                const assetData = {
                    asset_number: item.asset_number,
                    category: item.category,
                    model: item.model,
                    serial_number: item.serial_number || '',
                    state: (item.in_user === 'cjenc_inno' || !item.in_user) ? 'useable' : (item.state || 'wait'),
                    in_user: item.in_user || 'cjenc_inno',
                    day_of_start: formatDate(item.day_of_start),
                    day_of_end: formatDate(item.day_of_end),
                    unit_price: item.unit_price || 0,
                    memo: item.memo || null
                };

                let snapshotState = null;
                let snapshotUser = null;

                if (assetExists) {
                    const oldAsset = existing[0];
                    snapshotState = oldAsset.state;
                    snapshotUser = oldAsset.in_user;

                    await connection.query(
                        `UPDATE assets SET 
              category = ?, model = ?, serial_number = ?, state = ?, in_user = ?, 
              day_of_start = ?, day_of_end = ?, unit_price = ?, memo = ?
            WHERE asset_number = ?`,
                        [
                            assetData.category, assetData.model, assetData.serial_number, assetData.state, assetData.in_user,
                            assetData.day_of_start, assetData.day_of_end, assetData.unit_price, assetData.memo,
                            assetData.asset_number
                        ]
                    );
                } else {
                    snapshotState = 'wait';
                    snapshotUser = 'aj_rent';

                    await connection.query(
                        `INSERT INTO assets (
              asset_number, category, model, serial_number, state, in_user, 
              day_of_start, day_of_end, unit_price, memo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            assetData.asset_number, assetData.category, assetData.model, assetData.serial_number,
                            assetData.state, assetData.in_user, assetData.day_of_start, assetData.day_of_end,
                            assetData.unit_price, assetData.memo
                        ]
                    );
                }

                // 사용자가 변경되었거나 신규 등록인 경우에만 거래 기록 추가
                const userChanged = !assetExists || (assetData.in_user !== snapshotUser);
                const stateChanged = !assetExists || (assetData.state !== snapshotState);

                if (userChanged || stateChanged) {
                    await connection.query(
                        `INSERT INTO trade (
                work_type, asset_number, cj_id, memo, asset_state, asset_in_user, ex_user
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            workType,
                            assetData.asset_number,
                            assetData.in_user,
                            assetData.memo,
                            snapshotState,
                            snapshotUser,
                            snapshotUser === 'cjenc_inno' ? 'aj_rent' : (snapshotUser || 'aj_rent')
                        ]
                    );
                }

                results.push(assetData.asset_number);
            }

            if (results.length === 0 && errors.length > 0) {
                await connection.rollback();
                throw new Error(`모든 등록 실패: ${errors.join(', ')}`);
            }

            await connection.commit();
            return { results, errors };

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = new AssetService();
