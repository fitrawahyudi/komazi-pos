import { Router } from 'express';
import {
  handlePaymentWebhook,
  checkPaymentStatus,
  simulatePaymentSuccess,
  getWebhookInfo,
} from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Webhook endpoint for payment providers (Midtrans, Xendit, Android Notification Forwarder)
router.post('/webhook', handlePaymentWebhook);

// Check payment status (used by frontend polling while QR is open)
router.get('/status/:invoiceNo', checkPaymentStatus);

// Simulate payment success (strictly protected for Owner/Manager test purposes)
router.post('/simulate', authenticate, requireRole(['OWNER', 'MANAGER']), simulatePaymentSuccess);

// Webhook connection info (protected for Owner/Manager)
router.get('/webhook-info', authenticate, requireRole(['OWNER', 'MANAGER']), getWebhookInfo);

export default router;
