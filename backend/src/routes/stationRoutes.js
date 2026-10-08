import { Router } from 'express';
import {
  getStations,
  createStation,
  updateStation,
  deleteStation,
} from '../controllers/kdsController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();
router.use(authenticate);

// View stations: all authenticated staff
router.get('/', getStations);

// Modify stations: MANAGER & OWNER
router.post('/', requireRole(['MANAGER', 'OWNER']), createStation);
router.patch('/:id', requireRole(['MANAGER', 'OWNER']), updateStation);
router.delete('/:id', requireRole(['MANAGER', 'OWNER']), deleteStation);

export default router;
