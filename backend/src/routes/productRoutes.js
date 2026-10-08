import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import { productSchema } from '../validators/schemas.js';

const router = Router();

// Viewing products is public or authenticated (cashier, etc.)
router.get('/', authenticate, getAllProducts);
router.get('/:id', authenticate, getProductById);

// Modifying products requires MANAGER or OWNER
router.post('/', authenticate, requireRole(['MANAGER', 'OWNER']), validate(productSchema), createProduct);
router.patch('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), updateProduct);
router.delete('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), deleteProduct);

export default router;
