import { Router } from 'express';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  redeemCustomerPoints,
  adjustCustomerPoints,
  syncBatchCustomers,
} from '../controllers/customerController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  redeemPointsSchema,
  adjustPointsSchema,
} from '../validators/schemas.js';

const router = Router();

// Viewing customers list & detail (accessible to all authenticated staff)
router.get('/', authenticate, getAllCustomers);
router.get('/:id', authenticate, getCustomerById);

// Create customer (Cashier, Manager, Owner)
router.post(
  '/',
  authenticate,
  requireRole(['CASHIER', 'MANAGER', 'OWNER']),
  validate(createCustomerSchema),
  createCustomer
);

// Update customer
router.put(
  '/:id',
  authenticate,
  requireRole(['CASHIER', 'MANAGER', 'OWNER']),
  validate(updateCustomerSchema),
  updateCustomer
);

// Delete / deactivate customer (Manager & Owner only)
router.delete(
  '/:id',
  authenticate,
  requireRole(['MANAGER', 'OWNER']),
  deleteCustomer
);

// Redeem loyalty points (Cashier, Manager, Owner)
router.post(
  '/:id/redeem',
  authenticate,
  requireRole(['CASHIER', 'MANAGER', 'OWNER']),
  validate(redeemPointsSchema),
  redeemCustomerPoints
);

// Adjust points manually (Manager, Owner only)
router.post(
  '/:id/adjust-points',
  authenticate,
  requireRole(['MANAGER', 'OWNER']),
  validate(adjustPointsSchema),
  adjustCustomerPoints
);

// Sync batch customers from localStorage
router.post(
  '/sync-batch',
  authenticate,
  requireRole(['CASHIER', 'MANAGER', 'OWNER']),
  syncBatchCustomers
);

export default router;
