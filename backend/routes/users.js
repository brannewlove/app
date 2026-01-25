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

    // 자산 현황 조회
    const [assetCounts] = await pool.query(
      'SELECT category, COUNT(*) as count FROM assets WHERE in_user = ? GROUP BY category',
      [user[0].cj_id]
    );

    const userData = {
      ...user[0],
      asset_counts: assetCounts
    };

    success(res, userData);
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

/* DELETE user - 사용자 삭제 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 사용자 존재 확인
    const [existingUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      return error(res, '사용자를 찾을 수 없습니다.', 404);
    }

    // 사용자 삭제
    const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

    if (result.affectedRows > 0) {
      success(res, { message: '사용자가 삭제되었습니다.' });
    } else {
      error(res, '삭제 실패');
    }
  } catch (err) {
    console.error('DELETE /users/:id 오류:', err);
    error(res, '사용자 삭제 중 오류가 발생했습니다: ' + err.message);
  }
});

// 고유한 임시 cj_id 생성 함수
const generateTempCjId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TEMP_${timestamp}_${random}`;
};

/* GET temporary users count - 임시 사용자 수 조회 */
router.get('/temporary/count', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_temporary = TRUE'
    );
    success(res, { count: result[0].count });
  } catch (err) {
    console.error('GET /users/temporary/count 오류:', err);
    error(res, '임시 사용자 수 조회 중 오류가 발생했습니다: ' + err.message);
  }
});

/* POST temporary user - 임시 사용자 생성 */
router.post('/temporary', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, '이름을 입력해주세요.', 400);
    }

    // 임시 사용자 중 동일한 이름이 있는지 확인
    const [existingTempUser] = await pool.query(
      'SELECT name FROM users WHERE is_temporary = TRUE AND name = ?',
      [name.trim()]
    );

    if (existingTempUser.length > 0) {
      return error(res, '이미 동일한 이름의 임시 사용자가 존재합니다.', 400);
    }

    // 고유한 임시 cj_id 생성 (중복 방지를 위한 재시도 로직)
    let tempCjId;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      tempCjId = generateTempCjId();

      // 중복 체크
      const [existing] = await pool.query(
        'SELECT cj_id FROM users WHERE cj_id = ?',
        [tempCjId]
      );

      if (existing.length === 0) {
        break; // 중복 없음, 사용 가능
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      return error(res, '임시 ID 생성 실패. 다시 시도해주세요.', 500);
    }

    const [result] = await pool.query(
      'INSERT INTO users (name, cj_id, part, is_temporary) VALUES (?, ?, NULL, TRUE)',
      [name.trim(), tempCjId]
    );

    success(res, {
      user_id: result.insertId,
      name: name.trim(),
      cj_id: tempCjId,
      part: null,
      is_temporary: true,
      message: '임시 사용자가 등록되었습니다.'
    });
  } catch (err) {
    console.error('POST /users/temporary 오류:', err);
    error(res, '임시 사용자 등록 중 오류가 발생했습니다: ' + err.message);
  }
});

/* PATCH finalize user - 임시 사용자를 정식 사용자로 전환 */
router.patch('/:id/finalize', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { cj_id, part } = req.body;

    if (!cj_id || !cj_id.trim()) {
      return error(res, 'cj_id를 입력해주세요.', 400);
    }

    // 사용자 존재 확인
    const [existingUser] = await connection.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      connection.release();
      return error(res, '사용자를 찾을 수 없습니다.', 404);
    }

    const oldCjId = existingUser[0].cj_id;

    // cj_id 중복 확인
    const [duplicate] = await connection.query(
      'SELECT * FROM users WHERE cj_id = ? AND user_id != ?',
      [cj_id.trim(), id]
    );
    if (duplicate.length > 0) {
      connection.release();
      return error(res, '이미 사용 중인 cj_id입니다.', 400);
    }

    // 트랜잭션 시작
    await connection.beginTransaction();

    // 외래 키 체크 일시 비활성화
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. 해당 사용자의 모든 자산의 in_user를 새 cj_id로 업데이트
    await connection.query(
      'UPDATE assets SET in_user = ? WHERE in_user = ?',
      [cj_id.trim(), oldCjId]
    );

    // 2. 거래 기록의 cj_id와 asset_in_user를 새 cj_id로 업데이트
    await connection.query(
      'UPDATE trade SET cj_id = ?, asset_in_user = ? WHERE cj_id = ?',
      [cj_id.trim(), cj_id.trim(), oldCjId]
    );

    // ex_user 필드도 업데이트 (이전 사용자가 임시 사용자인 경우)
    await connection.query(
      'UPDATE trade SET ex_user = ? WHERE ex_user = ?',
      [cj_id.trim(), oldCjId]
    );

    // 3. 반납 자산 테이블의 user_id와 department 업데이트
    await connection.query(
      'UPDATE returned_assets SET user_id = ?, department = ? WHERE user_id = ?',
      [cj_id.trim(), part ? part.trim() : null, oldCjId]
    );

    // 4. 사용자 정보 업데이트 (정식 전환)
    const [result] = await connection.query(
      'UPDATE users SET cj_id = ?, part = ?, is_temporary = FALSE WHERE user_id = ?',
      [cj_id.trim(), part ? part.trim() : null, id]
    );

    // 외래 키 체크 재활성화
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    await connection.commit();

    if (result.affectedRows > 0) {
      success(res, {
        user_id: id,
        cj_id: cj_id.trim(),
        part: part ? part.trim() : null,
        is_temporary: false,
        message: '정식 사용자로 전환되었습니다.'
      });
    } else {
      error(res, '전환 실패');
    }
  } catch (err) {
    await connection.rollback();
    console.error('PATCH /users/:id/finalize 오류:', err);
    error(res, '사용자 전환 중 오류가 발생했습니다: ' + err.message);
  } finally {
    connection.release();
  }
});

module.exports = router;
