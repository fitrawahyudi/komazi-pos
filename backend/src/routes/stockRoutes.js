import { Router } from 'express';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  recordMovement,
  deleteIngredient,
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

// Manajemen master bahan baku & pencatatan mutasi dibatasi untuk MANAGER & OWNER
router.post('/', requireRole(['MANAGER', 'OWNER']), createIngredient);
router.put('/:id', requireRole(['MANAGER', 'OWNER']), updateIngredient);
router.delete('/:id', requireRole(['MANAGER', 'OWNER']), deleteIngredient);
router.post('/:id/movements', requireRole(['MANAGER', 'OWNER']), validate(stockMovementSchema), recordMovement);

export default router;
