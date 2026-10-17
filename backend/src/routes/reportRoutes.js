import { Router } from 'express';
import {
  getSummary,
  getSales,
  getTopProducts,
  exportCSV,
} from '../controllers/reportController.js';
import { getCogsReport } from '../controllers/cogsReportController.js';
import { getProfitAndLossReport } from '../controllers/profitController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Reports require MANAGER or OWNER
router.use(authenticate, requireRole(['MANAGER', 'OWNER']));

router.get('/summary', getSummary);
router.get('/sales', getSales);
router.get('/products', getTopProducts);
router.get('/export', exportCSV);

// COGS / HPP report — OWNER only (sensitive financial data)
router.get('/cogs', requireRole(['OWNER', 'MANAGER']), getCogsReport);

// Net Profit / P&L executive report
router.get('/profit-loss', requireRole(['OWNER', 'MANAGER']), getProfitAndLossReport);

export default router;

