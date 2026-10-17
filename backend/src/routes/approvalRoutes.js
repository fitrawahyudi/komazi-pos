import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { getPendingApprovals, decideApproval } from '../controllers/approvalController.js';

const router = Router();

router.use(authenticate);

// Semua pengguna terautentikasi dapat melihat status permintaan approval
router.get('/pending', getPendingApprovals);

// Hanya Manager dan Owner yang dapat menyetujui / menolak approval
router.post('/:id/decide', requireRole(['OWNER', 'MANAGER']), decideApproval);

export default router;
