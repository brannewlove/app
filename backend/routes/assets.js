var express = require('express');
var router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/db.config');

// MySQL 연결 풀
const pool = mysql.createPool({
  connectionLimit: 10,
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  enableKeepAlive: true
});

/* GET assets listing - 모든 자산 조회 */
router.get('/', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    const [assets] = await connection.query(
      `SELECT 
        a.*,
        u.cj_id as user_cj_id,
        u.name as user_name,
        u.part as user_part
      FROM assets a
      LEFT JOIN users u ON a.in_user = u.cj_id`
    );
    connection.release();
    
    res.json({
      success: true,
      data: assets,
      count: assets.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


/* GET asset by id - ID로 특정 자산 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [asset] = await connection.query('SELECT * FROM assets WHERE asset_id = ?', [id]);
    connection.release();
    
    if (asset.length === 0) {
      return res.status(404).json({
        success: false,
        error: '자산을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: asset[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* PUT asset - 자산 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log(`PUT /assets/${id} - updateData:`, JSON.stringify(updateData));
    
    const connection = await pool.getConnection();
    
    // 자산 존재 확인
    const [existingAsset] = await connection.query('SELECT * FROM assets WHERE asset_id = ?', [id]);
    if (existingAsset.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: '자산을 찾을 수 없습니다.'
      });
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
    
    const [result] = await connection.query(
      `UPDATE assets SET ${updateFields} WHERE asset_id = ?`,
      updateValues
    );
    connection.release();
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: '자산 정보가 성공적으로 수정되었습니다.',
        data: { id, ...updateData }
      });
    } else {
      res.json({
        success: false,
        error: '수정 실패'
      });
    }
  } catch (err) {
    console.error(`PUT /assets/${req.params.id} - Error:`, err.message);
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
