import { Router } from 'express';
import {
  getProductRecipe,
  saveProductRecipe,
  getCogsOverview,
  bulkSaveRecipes,
} from '../controllers/recipeController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// All recipe/COGS endpoints require MANAGER or OWNER
const requireManagerOrOwner = [authenticate, requireRole(['MANAGER', 'OWNER'])];

// COGS overview for all products (must be BEFORE /:id routes)
router.get('/cogs/overview', requireManagerOrOwner, getCogsOverview);

// Bulk recipe import (must be BEFORE /:id routes)
router.post('/recipes/bulk', requireManagerOrOwner, bulkSaveRecipes);

// Product-specific recipe CRUD
router.get('/:id/recipe', requireManagerOrOwner, getProductRecipe);
router.put('/:id/recipe', requireManagerOrOwner, saveProductRecipe);

export default router;
