import { Router } from 'express';
import {
  getAllPrinters,
  getPrinterById,
  createPrinter,
  updatePrinter,
  deletePrinter,
  getReceiptSettings,
  updateReceiptSettings,
  getPrintJobs,
  getPrintJobById,
  createPrintJob,
  retryPrintJob,
  reprintPrintJob,
  getKitchenRoutes,
  updateKitchenRoutes,
} from '../controllers/printerController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// ================= PRINTER PROFILES =================
router.get('/', authenticate, getAllPrinters);
router.get('/:id', authenticate, getPrinterById);
router.post('/', authenticate, requireRole(['OWNER']), createPrinter);
router.patch('/:id', authenticate, requireRole(['OWNER', 'MANAGER']), updatePrinter);
router.put('/:id', authenticate, requireRole(['OWNER', 'MANAGER']), updatePrinter);
router.delete('/:id', authenticate, requireRole(['OWNER']), deletePrinter);

export default router;

// Export secondary routers or combined routers
export const printerSettingsRouter = Router();
printerSettingsRouter.get('/receipt', authenticate, getReceiptSettings);
printerSettingsRouter.put('/receipt', authenticate, requireRole(['OWNER']), updateReceiptSettings);

export const printJobsRouter = Router();
printJobsRouter.get('/', authenticate, getPrintJobs);
printJobsRouter.get('/:id', authenticate, getPrintJobById);
printJobsRouter.post('/', authenticate, createPrintJob);
printJobsRouter.post('/:id/retry', authenticate, retryPrintJob);
printJobsRouter.post('/:id/reprint', authenticate, reprintPrintJob);

export const kitchenRoutesRouter = Router();
kitchenRoutesRouter.get('/', authenticate, getKitchenRoutes);
kitchenRoutesRouter.put('/', authenticate, requireRole(['OWNER']), updateKitchenRoutes);
