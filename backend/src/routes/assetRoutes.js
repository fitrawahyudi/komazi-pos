import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  disposeAsset,
  getDepreciationSchedule,
  getAssetsSummary,
} from '../controllers/assetController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Proteksi seluruh endpoint aset untuk role OWNER dan MANAGER
router.use(authenticate, requireRole(['OWNER', 'MANAGER']));

router.get('/summary', getAssetsSummary);
router.get('/', getAssets);
router.get('/:id', getAssetById);
router.get('/:id/depreciation-schedule', getDepreciationSchedule);
router.post('/', createAsset);
router.patch('/:id', updateAsset);
router.post('/:id/dispose', disposeAsset);

export default router;
