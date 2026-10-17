import { Router } from 'express';
import { getSettings, updateSettings, verifySupervisorPin } from '../controllers/settingController.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

import rateLimit from 'express-rate-limit';

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan per 15 menit untuk mitigasi brute force
  message: {
    success: false,
    message: 'Terlalu banyak percobaan PIN supervisor yang gagal. Silakan coba lagi 15 menit kemudian.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Viewing settings is allowed with optional auth (PIN masked for non-privileged users)
router.get('/', optionalAuthenticate, getSettings);

// Verifikasi PIN otorisasi supervisor (dilindungi rate limiter anti brute-force)
router.post('/verify-pin', authenticate, pinLimiter, verifySupervisorPin);

// Modifying settings requires OWNER (PRD Section 8)
router.put('/', authenticate, requireRole(['OWNER']), updateSettings);

export default router;
