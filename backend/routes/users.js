var express = require('express');
var router = express.Router();
const pool = require('../utils/db');
const { success, error } = require('../utils/response');
const bcrypt = require('bcrypt');

/* POST 로그인 */
router.post('/login', async (req, res) => {
  try {
    const { cj_id, password } = req.body;

    if (!cj_id || !password) {
      return error(res, '아이디와 비밀번호를 입력하세요.', 400);
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE cj_id = ?',
      [cj_id]
    );

    if (users.length === 0) {
      return error(res, '아이디 또는 비밀번호가 일치하지 않습니다.', 401);
    }

    const user = users[0];

    // 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return error(res, '아이디 또는 비밀번호가 일치하지 않습니다.', 401);
    }

    // 로그인 성공
    const token = Buffer.from(cj_id + ':' + Date.now()).toString('base64');

    success(res, {
      message: '로그인 성공',
      token: token,
      user: {
        user_id: user.user_id,
        cj_id: user.cj_id,
        name: user.name,
        sec_level: user.sec_level
      }
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    error(res, '로그인 중 오류가 발생했습니다: ' + err.message);
  }
});

/* GET users listing - 모든 사용자 조회 */
router.get('/', async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    success(res, users);
  } catch (err) {
    error(res, err.message);
  }
});

/* GET user by id - ID로 특정 사용자 조회 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [user] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);

    if (user.length === 0) {
      return error(res, '사용자를 찾을 수 없습니다.', 404);
    }

    success(res, user[0]);
  } catch (err) {
    console.error('GET /users/:id 오류:', err);
    error(res, err.message);
  }
});

/* PUT user - 사용자 정보 수정 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 사용자 존재 확인
    const [existingUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      return error(res, '사용자를 찾을 수 없습니다.', 404);
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

    const [result] = await pool.query(
      `UPDATE users SET ${updateFields} WHERE user_id = ?`,
      updateValues
    );

    if (result.affectedRows > 0) {
      success(res, { id, ...updateData });
    } else {
      error(res, '수정 실패');
    }
  } catch (err) {
    error(res, err.message);
  }
});

module.exports = router;
