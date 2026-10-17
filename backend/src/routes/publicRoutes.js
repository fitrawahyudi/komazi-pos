import { Router } from 'express';
import cmsController from '../controllers/cmsController.js';

const router = Router();

// Endpoint publik berkecepatan tinggi tanpa autentikasi untuk landing page
router.get('/landing', (req, res, next) => cmsController.getPublicLandingData(req, res, next));

export default router;
