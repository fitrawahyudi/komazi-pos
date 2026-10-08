import { Router } from 'express';
import {
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getSessions,
  checkIn,
  checkOut,
} from '../controllers/workspaceController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import { workspaceCheckInSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

// Areas & packages
router.get('/areas', getAreas);
router.post('/areas', requireRole(['MANAGER', 'OWNER']), createArea);
router.put('/areas/:id', requireRole(['MANAGER', 'OWNER']), updateArea);
router.delete('/areas/:id', requireRole(['MANAGER', 'OWNER']), deleteArea);

router.get('/packages', getPackages);
router.post('/packages', requireRole(['MANAGER', 'OWNER']), createPackage);
router.put('/packages/:id', requireRole(['MANAGER', 'OWNER']), updatePackage);
router.delete('/packages/:id', requireRole(['MANAGER', 'OWNER']), deletePackage);

// Sessions & checkin/out (Cashier+)
router.get('/sessions', getSessions);
router.post('/sessions', validate(workspaceCheckInSchema), checkIn);
router.post('/sessions/:id/checkout', checkOut);

export default router;
