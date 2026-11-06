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
import {
  getPendingQrOrders,
  confirmQrOrderPayment,
  rejectQrOrderPayment,
} from '../controllers/qrOrderController.js';
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

// Pesanan QR Order Meja yang menunggu verifikasi bukti transfer
router.get('/qr-pending', requireRole(['OWNER', 'MANAGER', 'CASHIER']), getPendingQrOrders);
router.post('/:id/confirm-qr-payment', requireRole(['OWNER', 'MANAGER', 'CASHIER']), confirmQrOrderPayment);
router.post('/:id/reject-qr-payment', requireRole(['OWNER', 'MANAGER', 'CASHIER']), rejectQrOrderPayment);

router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.post('/', validate(createOrderSchema), createOrder);
router.put('/:id', validate(createOrderSchema), updateOrder);
router.post('/:id/pay', payOrder);
router.patch('/:id/kitchen-status', updateKitchenStatus);

// Void & Refund (Void/Refund pesanan PAID memerlukan MANAGER/OWNER atau otorisasi PIN Supervisor jika oleh CASHIER)
router.post('/:id/void', requireRole(['OWNER', 'MANAGER', 'CASHIER']), validate(voidOrderSchema), voidOrder);
router.post('/:id/refund', requireRole(['OWNER', 'MANAGER', 'CASHIER']), validate(refundOrderSchema), refundOrder);

// Larang penghapusan transaksi langsung sesuai kebijakan keamanan & integritas data finansial
const rejectOrderDeletion = (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Transaksi tidak dapat dihapus. Gunakan prosedur pembatalan (void) atau refund resmi yang tersedia.',
  });
};
router.delete('/:id', rejectOrderDeletion);
router.delete('/', rejectOrderDeletion);

export default router;
