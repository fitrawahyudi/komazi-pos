import { Router } from 'express';
import {
  handlePaymentWebhook,
  checkPaymentStatus,
  simulatePaymentSuccess,
  getWebhookInfo,
} from '../controllers/paymentController.js';

const router = Router();

// Public webhook endpoint for payment providers (Midtrans, Xendit, Android Notification Forwarder)
router.post('/webhook', handlePaymentWebhook);

// Check payment status (used by frontend polling while QR is open)
router.get('/status/:invoiceNo', checkPaymentStatus);

// Simulate payment success (test button for cashier/owner)
router.post('/simulate', simulatePaymentSuccess);

// Webhook connection info
router.get('/webhook-info', getWebhookInfo);

export default router;
