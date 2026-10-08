import { Router } from 'express';
import {
  getKdsOrders,
  updateItemStatus,
  bumpItem,
  bumpKdsTicket,
} from '../controllers/kdsController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();
router.use(authenticate);

// Hak akses KDS: KITCHEN, MANAGER, OWNER
const kdsRoles = ['KITCHEN', 'MANAGER', 'OWNER'];

router.get('/orders', requireRole(kdsRoles), getKdsOrders);
router.patch('/items/:itemId/status', requireRole(kdsRoles), updateItemStatus);
router.post('/items/:itemId/bump', requireRole(kdsRoles), bumpItem);
router.post('/orders/:orderId/bump', requireRole(kdsRoles), bumpKdsTicket);

export default router;
