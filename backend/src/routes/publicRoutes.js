import { Router } from 'express';
import multer from 'multer';
import cmsController from '../controllers/cmsController.js';
import {
  getPublicQrOrderConfig,
  getPublicMenu,
  validateCartStock,
  checkoutQrOrder,
  getPublicOrderStatus,
} from '../controllers/qrOrderController.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const router = Router();

// Endpoint publik berkecepatan tinggi tanpa autentikasi untuk landing page
router.get('/landing', (req, res, next) => cmsController.getPublicLandingData(req, res, next));

// Endpoint publik untuk Customer QR Order Meja
router.get('/qr-order/config', getPublicQrOrderConfig);
router.get('/qr-order/menu', getPublicMenu);
router.post('/qr-order/validate-cart', validateCartStock);
router.post('/qr-order/checkout', upload.single('proof'), checkoutQrOrder);
router.get('/qr-order/status/:identifier', getPublicOrderStatus);

export default router;
