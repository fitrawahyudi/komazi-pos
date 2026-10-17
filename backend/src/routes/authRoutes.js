import { Router } from 'express';
import {
  login,
  register,
  verifyResetToken,
  completePasswordReset,
  requestOwnerResetOtp,
  verifyAndCompleteOwnerReset,
  getProfile,
  updateProfile,
  refreshToken,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import {
  loginSchema,
  completePasswordResetSchema,
  verifyPasswordResetTokenSchema,
  requestOwnerResetOtpSchema,
  verifyOwnerResetOtpSchema,
} from '../validators/schemas.js';
import rateLimit from 'express-rate-limit';

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan per 15 menit
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Terlalu banyak percobaan reset password. Silakan coba lagi 15 menit kemudian.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/login', validate(loginSchema), login);
// Registrasi staf dapat dipanggil oleh OWNER atau MANAGER yang terautentikasi
router.post('/register', authenticate, requireRole(['OWNER', 'MANAGER']), register);

// Endpoint Lupa Password Aman Berbasis Token Sekali Pakai & Verifikasi Manual Owner
router.post('/password-reset/verify-token', passwordResetLimiter, validate(verifyPasswordResetTokenSchema), verifyResetToken);
router.post('/password-reset/complete', passwordResetLimiter, validate(completePasswordResetSchema), completePasswordReset);

// Endpoint Lupa Password Mandiri Khusus Owner Berbasis OTP Telegram
router.post('/password-reset/owner-request', passwordResetLimiter, validate(requestOwnerResetOtpSchema), requestOwnerResetOtp);
router.post('/password-reset/owner-verify', passwordResetLimiter, validate(verifyOwnerResetOtpSchema), verifyAndCompleteOwnerReset);

router.post('/refresh', refreshToken);
router.get('/me', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

export default router;
