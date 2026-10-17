import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  createPasswordResetToken,
  revokePasswordResetToken,
  getPasswordResetStatus,
  resetPasswordByOwner,
  deleteUser,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/schemas.js';

const router = Router();

// Only OWNER can manage users
router.use(authenticate, requireRole(['OWNER']));

router.get('/', getAllUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);

// Penerbitan dan pengelolaan token reset sekali pakai oleh Owner
router.post('/:id/password-reset-token', createPasswordResetToken);
router.delete('/:id/password-reset-token', revokePasswordResetToken);
router.get('/:id/password-reset-status', getPasswordResetStatus);

// Override password langsung oleh Owner (backward compatibility)
router.post('/:id/reset-password', resetPasswordByOwner);
router.delete('/:id', deleteUser);

export default router;
