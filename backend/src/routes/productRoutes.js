import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  bulkCreateProducts,
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
router.post('/bulk', authenticate, requireRole(['MANAGER', 'OWNER']), bulkCreateProducts);
router.post('/', authenticate, requireRole(['MANAGER', 'OWNER']), validate(productSchema), createProduct);
router.patch('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), updateProduct);
router.post('/bulk-delete', authenticate, requireRole(['MANAGER', 'OWNER']), bulkDeleteProducts);
router.delete('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), deleteProduct);

export default router;
