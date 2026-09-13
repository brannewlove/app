const express = require('express');
const router = express.Router();
const userService = require('../services/UserService');
const { success, error } = require('../utils/response');
const RateLimiter = require('../utils/RateLimiter');

// 로그인 무차별 대입(Brute-Force) 방어: 1분당 최대 5회 시도 제한
const loginLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해 주세요.'
});

/* POST 로그인 */
router.post('/login', loginLimiter.middleware(), async (req, res) => {
  try {
    const { cj_id, password } = req.body;
    const result = await userService.login(cj_id, password);
    // 로그인 성공 시 해당 IP 제한 카운트 리셋
    loginLimiter.reset(loginLimiter.getKey(req));
    success(res, {
      message: '로그인 성공',
      ...result
    });
  } catch (err) {
    error(res, err.message, err.message.includes('일치하지') ? 401 : 400);
  }
});

/* GET users listing - 모든 사용자 조회 */
router.get('/', async (req, res) => {
  try {
    const users = await userService.findAll();
    success(res, users);
  } catch (err) {
    error(res, err.message);
  }
});

/* GET user by cj_id - CJ ID로 특정 사용자 조회 */
router.get('/cj/:cjId', async (req, res) => {
  try {
    console.log('Fetching user by CJ ID:', req.params.cjId);
    const userData = await userService.getUserByCjIdWithAssets(req.params.cjId);
    if (!userData) {
      console.log('User not found for CJ ID:', req.params.cjId);
      return error(res, '사용자를 찾을 수 없습니다.', 404);
    }
    success(res, userData);
  } catch (err) {
    console.error('Error fetching user by CJ ID:', err);
    error(res, err.message);
  }
});

/* GET user by id - ID로 특정 사용자 조회 */
router.get('/:id', async (req, res) => {
  try {
    const userData = await userService.getUserByIdWithAssets(req.params.id);
    if (!userData) {
      return error(res, '사용자를 찾을 수 없습니다.', 404);
    }
    success(res, userData);
  } catch (err) {
    error(res, err.message);
  }
});

/* PUT user - 사용자 정보 수정 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // password 및 sec_level은 일반 프로필 수정에서 직접 변경 불가하도록 차단 (Mass Assignment 방지)
    const { user_id, password, sec_level, ...dataToUpdate } = req.body;
    const updated = await userService.update(id, dataToUpdate, 'user_id');
    if (updated) {
      success(res, { id, ...dataToUpdate });
    } else {
      error(res, '수정 실패');
    }
  } catch (err) {
    error(res, err.message);
  }
});

/* DELETE user - 사용자 삭제 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await userService.delete(req.params.id, 'user_id');
    if (deleted) {
      success(res, { message: '사용자가 삭제되었습니다.' });
    } else {
      error(res, '삭제 실패');
    }
  } catch (err) {
    error(res, err.message);
  }
});

/* GET temporary users count - 임시 사용자 수 조회 */
router.get('/temporary/count', async (req, res) => {
  try {
    const [result] = await userService.pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_temporary = TRUE'
    );
    success(res, { count: result[0].count });
  } catch (err) {
    error(res, err.message);
  }
});

/* POST temporary user - 임시 사용자 생성 */
router.post('/temporary', async (req, res) => {
  try {
    const result = await userService.registerTemporaryUser(req.body.name);
    success(res, {
      ...result,
      message: '임시 사용자가 등록되었습니다.'
    });
  } catch (err) {
    error(res, err.message);
  }
});

/* PATCH finalize user - 임시 사용자를 정식 사용자로 전환 */
router.patch('/:id/finalize', async (req, res) => {
  try {
    const { id } = req.params;
    const { cj_id, part } = req.body;
    const result = await userService.finalizeUser(id, cj_id, part);
    success(res, {
      ...result,
      message: '정식 사용자로 전환되었습니다.'
    });
  } catch (err) {
    error(res, err.message);
  }
});

module.exports = router;
