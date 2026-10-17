import { Router } from 'express';
import cmsController from '../controllers/cmsController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// Seluruh endpoint CMS dilindungi oleh autentikasi JWT dan hanya boleh diakses oleh OWNER dan MANAGER (Admin)
router.use(authenticate);
router.use(requireRole(['OWNER', 'MANAGER']));

// 1. Config (Hero & Brand Identity)
router.get('/config', (req, res, next) => cmsController.getConfig(req, res, next));
router.put('/config', (req, res, next) => cmsController.updateConfig(req, res, next));

// 2. Menu Spotlight (Etalase Menu Unggulan)
router.get('/spotlights', (req, res, next) => cmsController.getSpotlights(req, res, next));
router.post('/spotlights', (req, res, next) => cmsController.createSpotlight(req, res, next));
router.post('/spotlights/reorder', (req, res, next) => cmsController.reorderSpotlights(req, res, next));
router.put('/spotlights/:id', (req, res, next) => cmsController.updateSpotlight(req, res, next));
router.delete('/spotlights/:id', (req, res, next) => cmsController.deleteSpotlight(req, res, next));

// 3. Promos & Events
router.get('/promos', (req, res, next) => cmsController.getPromos(req, res, next));
router.post('/promos', (req, res, next) => cmsController.createPromo(req, res, next));
router.put('/promos/:id', (req, res, next) => cmsController.updatePromo(req, res, next));
router.delete('/promos/:id', (req, res, next) => cmsController.deletePromo(req, res, next));

// 4. Facilities (Café Amenities)
router.get('/facilities', (req, res, next) => cmsController.getFacilities(req, res, next));
router.post('/facilities', (req, res, next) => cmsController.createFacility(req, res, next));
router.put('/facilities/:id', (req, res, next) => cmsController.updateFacility(req, res, next));
router.delete('/facilities/:id', (req, res, next) => cmsController.deleteFacility(req, res, next));

// 5. Customer Testimonials
router.get('/testimonials', (req, res, next) => cmsController.getTestimonials(req, res, next));
router.post('/testimonials', (req, res, next) => cmsController.createTestimonial(req, res, next));
router.put('/testimonials/:id', (req, res, next) => cmsController.updateTestimonial(req, res, next));
router.delete('/testimonials/:id', (req, res, next) => cmsController.deleteTestimonial(req, res, next));

// 6. Outlet Info & Hours
router.get('/outlet', (req, res, next) => cmsController.getOutletInfo(req, res, next));
router.put('/outlet', (req, res, next) => cmsController.updateOutletInfo(req, res, next));

export default router;
