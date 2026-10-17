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

// Void & Refund (Void/Refund pesanan PAID memerlukan MANAGER/OWNER atau otorisasi PIN Supervisor jika oleh CASHIER)
router.post('/:id/void', requireRole(['OWNER', 'MANAGER', 'CASHIER']), validate(voidOrderSchema), voidOrder);
router.post('/:id/refund', requireRole(['OWNER', 'MANAGER', 'CASHIER']), validate(refundOrderSchema), refundOrder);

export default router;
