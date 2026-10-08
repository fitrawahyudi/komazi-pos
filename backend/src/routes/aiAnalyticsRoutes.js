import { Router } from 'express';
import { askAi, getQuickSalesInsight, testAiConnection } from '../controllers/aiAnalyticsController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Endpoint dilindungi oleh autentikasi JWT dan dapat diakses oleh seluruh peran staf sesuai batasan role masing-masing
router.use(authenticate);

router.post('/ask', requireRole(['OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN']), askAi);
router.get('/quick-insight', requireRole(['OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN']), getQuickSalesInsight);
router.get('/status', requireRole(['OWNER', 'MANAGER']), testAiConnection);

export default router;
