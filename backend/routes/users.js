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

/* POST 로그인 */
router.post('/login', async (req, res) => {
  try {
    const { cj_id, password } = req.body;
    
    if (!cj_id || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력하세요.'
      });
    }
    
    const connection = await pool.getConnection();
    
    // 테스트: 첫 번째 사용자 확인
    const [testUsers] = await connection.query('SELECT * FROM users LIMIT 1');
    console.log('Users table sample:', testUsers[0]);
    
    const [users] = await connection.query(
      'SELECT * FROM users WHERE cj_id = ?',
      [cj_id]
    );
    connection.release();
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 일치하지 않습니다.'
      });
    }
    
    const user = users[0];
    
    // 비밀번호 검증
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 일치하지 않습니다.'
      });
    }
    
    // 로그인 성공
    const token = Buffer.from(cj_id + ':' + Date.now()).toString('base64');
    
    res.json({
      success: true,
      message: '로그인 성공',
      token: token,
      user: {
        user_id: user.user_id,
        cj_id: user.cj_id,
        name: user.name
      }
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.',
      error: err.message
    });
  }
});

/* GET users listing - 모든 사용자 조회 */
router.get('/', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query('SELECT * FROM users');
    connection.release();
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* GET user by id - ID로 특정 사용자 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [user] = await connection.query('SELECT * FROM users WHERE user_id = ?', [id]);
    connection.release();
    
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: user[0]
    });
  } catch (err) {
    console.error('GET /users/:id 오류:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* PUT user - 사용자 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const connection = await pool.getConnection();
    
    // 사용자 존재 확인
    const [existingUser] = await connection.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 업데이트 실행
    // user_id는 업데이트하지 않도록 제외
    const { user_id, ...dataToUpdate } = updateData;
    
    // 동적 SQL 생성
    const updateFields = Object.keys(dataToUpdate)
      .map(key => `${key} = ?`)
      .join(', ');
    const updateValues = Object.values(dataToUpdate);
    updateValues.push(id); // WHERE 절의 user_id
    
    const [result] = await connection.query(
      `UPDATE users SET ${updateFields} WHERE user_id = ?`,
      updateValues
    );
    connection.release();
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: '사용자 정보가 성공적으로 수정되었습니다.',
        data: { id, ...updateData }
      });
    } else {
      res.json({
        success: false,
        error: '수정 실패'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
