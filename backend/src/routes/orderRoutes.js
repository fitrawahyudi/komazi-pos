import { Router } from 'express';
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  payOrder,
  updateKitchenStatus,
  voidOrder,
  refundOrder,
} from '../controllers/orderController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import {
  createOrderSchema,
  voidOrderSchema,
  refundOrderSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.post('/', validate(createOrderSchema), createOrder);
router.put('/:id', validate(createOrderSchema), updateOrder);
router.post('/:id/pay', payOrder);
router.patch('/:id/kitchen-status', updateKitchenStatus);

// Void & Refund (Void for PAID requires MANAGER or OWNER; OPEN orders can be voided by CASHIER)
router.post('/:id/void', validate(voidOrderSchema), voidOrder);
router.post('/:id/refund', requireRole(['MANAGER', 'OWNER']), validate(refundOrderSchema), refundOrder);

export default router;
