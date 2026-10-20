import { Router } from 'express';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  recordMovement,
  recordWaste,
  getWasteAnalytics,
  getWhatsAppRestockUrl,
  deleteIngredient,
  bulkDeleteIngredients,
  bulkCreateIngredients,
  getStockMovements,
} from '../controllers/stockController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import { stockMovementSchema } from '../validators/schemas.js';

const router = Router();

// Autentikasi untuk semua route bahan baku
router.use(authenticate);

// Kasir & Barista dapat melihat stok bahan untuk POS & KDS (Read-only)
router.get('/', getIngredients);

// Riwayat log pergerakan stok (Read-only untuk seluruh staff, data HPP disanitasi jika bukan Manager/Owner)
router.get('/movements', getStockMovements);

// Analisis waste (di atas route parameterized /:id)
router.get('/waste-analytics', requireRole(['MANAGER', 'OWNER']), getWasteAnalytics);

// Manajemen master bahan baku & pencatatan mutasi dibatasi untuk MANAGER & OWNER
router.post('/bulk', requireRole(['MANAGER', 'OWNER']), bulkCreateIngredients);
router.post('/', requireRole(['MANAGER', 'OWNER']), createIngredient);
router.get('/:id/movements', getStockMovements);
router.get('/:id/whatsapp-url', requireRole(['MANAGER', 'OWNER', 'BARISTA', 'KITCHEN']), getWhatsAppRestockUrl);
router.put('/:id', requireRole(['MANAGER', 'OWNER']), updateIngredient);
router.post('/bulk-delete', requireRole(['MANAGER', 'OWNER']), bulkDeleteIngredients);
router.delete('/:id', requireRole(['MANAGER', 'OWNER']), deleteIngredient);
router.post('/:id/movements', requireRole(['MANAGER', 'OWNER']), validate(stockMovementSchema), recordMovement);
router.post('/:id/waste', requireRole(['MANAGER', 'OWNER', 'BARISTA', 'KITCHEN']), recordWaste);

export default router;
