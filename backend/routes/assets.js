var express = require('express');
var router = express.Router();
const { body } = require('express-validator');
const pool = require('../utils/db');
const { success, error } = require('../utils/response');
const { validate } = require('../middleware/validator');

/* GET assets listing - 모든 자산 조회 */
router.get('/', async (req, res, next) => {
  try {
    const { onlyReplacements } = req.query;
    let query = `
      SELECT 
        a.*,
        u.name as user_name,
        u.part as user_part
      FROM assets a
      LEFT JOIN users u ON a.in_user = u.cj_id
    `;

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
    }

    const [assets] = await pool.query(query);
    success(res, assets);
  } catch (err) {
    error(res, err.message);
  }
});


/* GET asset by id - ID로 특정 자산 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [asset] = await pool.query(
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

    if (asset.length === 0) {
      return error(res, '자산을 찾을 수 없습니다.', 404);
    }
    success(res, asset[0]);
  } catch (err) {
    error(res, err.message);
  }
});

/* PUT asset - 자산 정보 수정 */
router.put('/:id', [
  body('asset_number').notEmpty().withMessage('Asset Number is required'),
  // Add more validations as needed, e.g., model, serial_number checks
  validate
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log(`PUT /assets/${id} - updateData:`, JSON.stringify(updateData));

    // 자산 존재 확인
    const [existingAsset] = await pool.query('SELECT * FROM assets WHERE asset_id = ?', [id]);
    if (existingAsset.length === 0) {
      return error(res, '자산을 찾을 수 없습니다.', 404);
    }

    // 업데이트 실행 (생성 열 및 조인 필드 제외)
    const {
      asset_id,
      contract_month,
      user_cj_id,
      user_name,
      user_part,
      asset_memo,
      ...dataToUpdate
    } = updateData;

    // 날짜 형식 변환 (ISO 8601 -> MySQL DATE)
    if (dataToUpdate.day_of_start && typeof dataToUpdate.day_of_start === 'string') {
      dataToUpdate.day_of_start = dataToUpdate.day_of_start.split('T')[0];
    }
    if (dataToUpdate.day_of_end && typeof dataToUpdate.day_of_end === 'string') {
      dataToUpdate.day_of_end = dataToUpdate.day_of_end.split('T')[0];
    }

    const updateFields = Object.keys(dataToUpdate)
      .map(key => `${key} = ?`)
      .join(', ');
    const updateValues = Object.values(dataToUpdate);
    updateValues.push(id);

    const [result] = await pool.query(
      `UPDATE assets SET ${updateFields} WHERE asset_id = ?`,
      updateValues
    );

    if (result.affectedRows > 0) {
      success(res, { id, ...updateData });
    } else {
      error(res, '수정 실패');
    }
  } catch (err) {
    console.error(`PUT /assets/${req.params.id} - Error:`, err.message);
    error(res, err.message);
  }
});

/* POST bulk assets - 자산 대량 등록 */
router.post('/bulk', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { items, default_work_type } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, '등록할 데이터가 없습니다.', 400);
    }

    // 1. 사용자 ID 검증 (Foreign Key 오류 방지)
    const userIdsToCheck = new Set();
    items.forEach(item => {
      if (item.in_user) userIdsToCheck.add(item.in_user);
    });
    // 기본값으로 사용될 수 있는 cjenc_inno도 확인 필요 (이미직접 입력된 경우는 위에서 추가됨)
    userIdsToCheck.add('cjenc_inno');

    const uniqueUserIds = Array.from(userIdsToCheck);
    if (uniqueUserIds.length > 0) {
      const [existingUsers] = await connection.query(
        'SELECT cj_id FROM users WHERE cj_id IN (?)',
        [uniqueUserIds]
      );
      const existingUserIdSet = new Set(existingUsers.map(u => u.cj_id));

      const missingUsers = uniqueUserIds.filter(id => !existingUserIdSet.has(id));
      if (missingUsers.length > 0) {
        connection.release();
        return error(res, `존재하지 않는 사용자 ID가 포함되어 있습니다: ${missingUsers.join(', ')}`, 400);
      }
    }

    await connection.beginTransaction();

    const results = [];
    const errors = [];

    for (const item of items) {
      // 2. 필수 필드 검증
      if (!item.asset_number || !item.category || !item.model) {
        errors.push(`필수 필드 누락: ${item.asset_number || 'UNKNOWN'}`);
        continue;
      }

      const workType = item.work_type || default_work_type || '신규-계약';

      // 3. 자산 존재 확인
      const [existing] = await connection.query('SELECT * FROM assets WHERE asset_number = ?', [item.asset_number]);
      const assetExists = existing.length > 0;

      // 신규 등록인데 이미 존재하고, 작업유형이 '신규-재계약'이 아니면 에러
      if (assetExists && workType !== '신규-재계약') {
        errors.push(`이미 존재하는 자산번호: ${item.asset_number}`);
        continue;
      }

      // 4. 자산 데이터 준비
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
      let snapshotMemo = null;

      if (assetExists) {
        // --- 재계약 업데이트 (UPDATE) ---
        const oldAsset = existing[0];
        snapshotState = oldAsset.state;
        snapshotUser = oldAsset.in_user;
        snapshotMemo = oldAsset.memo;

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
        // --- 신규 등록 (INSERT) ---
        snapshotState = 'wait';
        snapshotUser = 'aj_rent'; // 가상의 이전 상태

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

      // 5. 거래 기록 등록
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
          snapshotUser === 'cjenc_inno' ? 'aj_rent' : snapshotUser // 이전 사용자가 전산실이면 렌탈사 반납 후 입고로 간주 (유연하게)
        ]
      );

      results.push(assetData.asset_number);
    }

    if (results.length === 0 && errors.length > 0) {
      await connection.rollback();
      return error(res, `모든 등록 실패: ${errors.join(', ')}`, 400);
    }

    await connection.commit();
    success(res, {
      message: `${results.length}건 등록 완료`,
      results,
      errors: errors.length > 0 ? errors : null
    });

  } catch (err) {
    await connection.rollback();
    console.error('Bulk insert error:', err);
    error(res, '대량 등록 중 오류가 발생했습니다: ' + err.message);
  } finally {
    connection.release();
  }
});

module.exports = router;
