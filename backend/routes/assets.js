var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');

/* GET assets listing - 모든 자산 조회 */
router.get('/', async (req, res, next) => {
  try {
    const [assets] = await pool.query(
      `SELECT 
        a.*,
        u.cj_id as user_cj_id,
        u.name as user_name,
        u.part as user_part
      FROM assets a
      LEFT JOIN users u ON a.in_user = u.cj_id`
    );
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
        a.state, a.in_user, a.day_of_start, a.day_of_end, a.unit_price, a.contract_month,
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
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log(`PUT /assets/${id} - updateData:`, JSON.stringify(updateData));

    // 자산 존재 확인
    const [existingAsset] = await pool.query('SELECT * FROM assets WHERE asset_id = ?', [id]);
    if (existingAsset.length === 0) {
      return error(res, '자산을 찾을 수 없습니다.', 404);
    }

    // 업데이트 실행 (생성 열 contract_month 제외, 날짜 형식 변환)
    const { asset_id, contract_month, ...dataToUpdate } = updateData;

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

module.exports = router;
