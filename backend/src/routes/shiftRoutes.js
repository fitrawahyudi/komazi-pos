import { Router } from 'express';
import { getCurrentShift, openShift, closeShift, getShiftHistory } from '../controllers/shiftController.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { openShiftSchema, closeShiftSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/current', getCurrentShift);
router.get('/history', getShiftHistory);
router.post('/open', validate(openShiftSchema), openShift);
router.post('/close', validate(closeShiftSchema), closeShift);

export default router;
