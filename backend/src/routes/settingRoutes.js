import { Router } from 'express';
import { getSettings, updateSettings, verifySupervisorPin } from '../controllers/settingController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

router.use(authenticate);

// Viewing settings is allowed for authenticated staff
router.get('/', getSettings);

// Verifikasi PIN otorisasi supervisor (bisa dipanggil kasir saat butuh void/refund)
router.post('/verify-pin', verifySupervisorPin);

// Modifying settings requires OWNER (PRD Section 8)
router.put('/', requireRole(['OWNER']), updateSettings);

export default router;
