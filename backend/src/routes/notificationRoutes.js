import { Router } from 'express';
import {
  registerDevice,
  logoutDevice,
  getNotifications,
  getUnreadBadgeCount,
  markSingleNotificationAsRead,
  markAllNotificationsAsRead,
  testPushNotification,
} from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

// All notification endpoints require authenticated user
router.use(authenticate);

// Device token lifecycle
router.post('/devices', registerDevice);
router.post('/devices/logout', logoutDevice);

// Notification queries and read status
router.get('/', getNotifications);
router.get('/unread-count', getUnreadBadgeCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markSingleNotificationAsRead);

// Protected manual test trigger for Owner / Manager
router.post('/test-push', requireRole(['OWNER', 'MANAGER']), testPushNotification);

export default router;
