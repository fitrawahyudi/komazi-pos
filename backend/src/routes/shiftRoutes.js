import { Router } from 'express';
import {
  getRegisters,
  getCurrentShift,
  openShift,
  closeShift,
  createCashMovement,
  getCashMovements,
  getShiftHistory,
  getShiftDetail,
} from '../controllers/shiftController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import {
  openShiftSchema,
  closeShiftSchema,
  createCashMovementSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/registers', getRegisters);
router.get('/current', getCurrentShift);
router.get('/history', requireRole(['OWNER', 'MANAGER']), getShiftHistory);
router.get('/:id/movements', getCashMovements);
router.get('/:id', getShiftDetail);
router.post('/open', validate(openShiftSchema), openShift);
router.post('/close', validate(closeShiftSchema), closeShift);
router.post('/movements', validate(createCashMovementSchema), createCashMovement);
router.post('/:id/movements', validate(createCashMovementSchema), createCashMovement);

export default router;
