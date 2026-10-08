import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
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
router.post('/:id/reset-password', resetPasswordByOwner);
router.delete('/:id', deleteUser);

export default router;
