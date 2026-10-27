import { Router } from 'express';
import {
  getPresetsHandler,
  updatePresetsHandler,
  validateVoucherHandler,
  getVouchersHandler,
  createVoucherHandler,
  updateVoucherHandler,
  deleteVoucherHandler,
} from '../controllers/promoController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Seluruh endpoint promo wajib login akun staf
router.use(authenticate);

// Endpoint untuk kasir & staf (akses semua role)
router.get('/presets', getPresetsHandler);
router.post('/validate-voucher', validateVoucherHandler);

// Endpoint manajemen promo (Khusus OWNER & MANAGER)
router.get('/vouchers', requireRole(['OWNER', 'MANAGER']), getVouchersHandler);
router.post('/vouchers', requireRole(['OWNER', 'MANAGER']), createVoucherHandler);
router.put('/vouchers/:code', requireRole(['OWNER', 'MANAGER']), updateVoucherHandler);
router.delete('/vouchers/:code', requireRole(['OWNER', 'MANAGER']), deleteVoucherHandler);
router.put('/presets', requireRole(['OWNER', 'MANAGER']), updatePresetsHandler);

export default router;
