import { Router } from 'express';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  cancelExpense,
  getExpenseSummary,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/expenseController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Proteksi seluruh endpoint biaya untuk role OWNER dan MANAGER (Admin)
router.use(authenticate, requireRole(['OWNER', 'MANAGER']));

// Category Routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Expense Routes
router.get('/summary', getExpenseSummary);
router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.patch('/:id', updateExpense);
router.post('/:id/cancel', cancelExpense);

export default router;
