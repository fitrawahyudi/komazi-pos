import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import productRoutes from './productRoutes.js';
import recipeRoutes from './recipeRoutes.js';
import orderRoutes from './orderRoutes.js';
import shiftRoutes from './shiftRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';
import stockRoutes from './stockRoutes.js';
import reportRoutes from './reportRoutes.js';
import settingRoutes from './settingRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import aiAnalyticsRoutes from './aiAnalyticsRoutes.js';
import kdsRoutes from './kdsRoutes.js';
import bdsRoutes from './bdsRoutes.js';
import stationRoutes from './stationRoutes.js';
import telegramRoutes from './telegramRoutes.js';
import customerRoutes from './customerRoutes.js';
import approvalRoutes from './approvalRoutes.js';
import hrisRoutes from './hrisRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import printerRoutes, {
  printerSettingsRouter,
  printJobsRouter,
  kitchenRoutesRouter,
} from './printerRoutes.js';
import publicRoutes from './publicRoutes.js';
import cmsRoutes from './cmsRoutes.js';
import backupRoutes from './backupRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import assetRoutes from './assetRoutes.js';
import depreciationRoutes from './depreciationRoutes.js';

const router = Router();

// Public & Marketing CMS Endpoints
router.use('/public', publicRoutes);
router.use('/cms', cmsRoutes);

router.use('/backup', backupRoutes);
router.use('/hris', hrisRoutes);
router.use('/attendance', hrisRoutes);
router.use('/approvals', approvalRoutes);
router.use('/notifications', notificationRoutes);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/printers', printerRoutes);
router.use('/printer-settings', printerSettingsRouter);
router.use('/print-jobs', printJobsRouter);
router.use('/kitchen-printer-routes', kitchenRoutesRouter);
router.use('/categories', categoryRoutes);
router.use('/products', recipeRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/kds', kdsRoutes);
router.use('/bds', bdsRoutes);
router.use('/stations', stationRoutes);
router.use('/shifts', shiftRoutes);
router.use('/workspace', workspaceRoutes);
router.use('/ingredients', stockRoutes);
router.use('/stock', stockRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingRoutes);
router.use('/upload', uploadRoutes);
router.use('/payments', paymentRoutes);
router.use('/analytics/ai', aiAnalyticsRoutes);
router.use('/telegram', telegramRoutes);
router.use('/expenses', expenseRoutes);
router.use('/assets', assetRoutes);
router.use('/depreciations', depreciationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Komazi POS Backend API', timestamp: new Date().toISOString() });
});

export default router;
