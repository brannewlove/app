const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const assetService = require('../services/AssetService');
const { success, error } = require('../utils/response');
const { validate } = require('../middleware/validator');

/* GET assets listing - 모든 자산 조회 */
router.get('/', async (req, res) => {
  try {
    const assets = await assetService.getAssetsWithUser(req.query);
    success(res, assets);
  } catch (err) {
    error(res, err.message);
  }
});

/* GET asset by id - ID로 특정 자산 조회 */
router.get('/:id', async (req, res) => {
  try {
    const asset = await assetService.getAssetByIdWithUser(req.params.id);
    if (!asset) {
      return error(res, '자산을 찾을 수 없습니다.', 404);
    }
    success(res, asset);
  } catch (err) {
    error(res, err.message);
  }
});

/* GET asset by number - 자산번호로 특정 자산 조회 */
router.get('/number/:asset_number', async (req, res) => {
  try {
    const asset = await assetService.getAssetByNumberWithUser(req.params.asset_number);
    if (!asset) {
      return error(res, '자산을 찾을 수 없습니다.', 404);
    }
    success(res, asset);
  } catch (err) {
    error(res, err.message);
  }
});

/* PUT asset - 자산 정보 수정 */
router.put('/:id', [
  body('asset_number').notEmpty().withMessage('Asset Number is required'),
  validate
], async (req, res) => {
  try {
    const updated = await assetService.updateAsset(req.params.id, req.body);
    if (updated) {
      success(res, { id: req.params.id, ...req.body });
    } else {
      error(res, '자산을 찾을 수 없거나 수정 실패');
    }
  } catch (err) {
    error(res, err.message);
  }
});

/* POST bulk assets - 자산 대량 등록 */
router.post('/bulk', async (req, res) => {
  try {
    const { items, default_work_type } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, '등록할 데이터가 없습니다.', 400);
    }

    const { results, errors } = await assetService.bulkInsertAssets(items, default_work_type);

    success(res, {
      message: `${results.length}건 등록 완료`,
      results,
      errors: errors.length > 0 ? errors : null
    });
  } catch (err) {
    error(res, err.message);
  }
});

module.exports = router;
