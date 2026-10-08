import { Router } from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import { categorySchema, updateCategorySchema } from '../validators/schemas.js';

const router = Router();

// Viewing categories is allowed for all authenticated users
router.get('/', authenticate, getAllCategories);

// Creating/modifying categories requires MANAGER or OWNER
router.post('/', authenticate, requireRole(['MANAGER', 'OWNER']), validate(categorySchema), createCategory);
router.patch('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), validate(updateCategorySchema), updateCategory);
router.delete('/:id', authenticate, requireRole(['MANAGER', 'OWNER']), deleteCategory);

export default router;
