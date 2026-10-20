import { Router } from 'express';
import {
  getDepreciations,
  previewDepreciation,
  processDepreciation,
} from '../controllers/depreciationController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Proteksi pemrosesan penyusutan khusus OWNER dan MANAGER (Kasir dilarang tegas)
router.use(authenticate, requireRole(['OWNER', 'MANAGER']));

router.get('/', getDepreciations);
router.post('/preview', previewDepreciation);
router.post('/process', processDepreciation);

export default router;
