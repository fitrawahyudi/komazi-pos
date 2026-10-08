import { Router } from 'express';
import {
  getProductRecipe,
  saveProductRecipe,
  getCogsOverview,
} from '../controllers/recipeController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// All recipe/COGS endpoints require MANAGER or OWNER
router.use(authenticate, requireRole(['MANAGER', 'OWNER']));

// COGS overview for all products (must be BEFORE /:id routes)
router.get('/cogs/overview', getCogsOverview);

// Product-specific recipe CRUD
router.get('/:id/recipe', getProductRecipe);
router.put('/:id/recipe', saveProductRecipe);

export default router;
