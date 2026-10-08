import { Router } from 'express';
import {
  getBdsOrders,
  updateItemStatus,
  bumpItem,
  bumpBdsTicket,
} from '../controllers/kdsController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();
router.use(authenticate);

// Hak akses BDS: BARISTA, MANAGER, OWNER
const bdsRoles = ['BARISTA', 'MANAGER', 'OWNER'];

router.get('/orders', requireRole(bdsRoles), getBdsOrders);
router.patch('/items/:itemId/status', requireRole(bdsRoles), updateItemStatus);
router.post('/items/:itemId/bump', requireRole(bdsRoles), bumpItem);
router.post('/orders/:orderId/bump', requireRole(bdsRoles), bumpBdsTicket);

export default router;
