import { Router } from 'express';
import {
  login,
  register,
  verifyUserForReset,
  resetPassword,
  getProfile,
  updateProfile,
  refreshToken,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema } from '../validators/schemas.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', register);
router.post('/forgot-password/verify', verifyUserForReset);
router.post('/forgot-password/reset', resetPassword);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

export default router;
