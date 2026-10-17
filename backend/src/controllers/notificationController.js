import {
  registerDeviceToken,
  deactivateDeviceToken,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
} from '../services/notification.service.js';
import { isFCMConfigured } from '../services/fcm.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Register or update FCM device token for authenticated user
 * POST /api/notifications/devices
 */
export async function registerDevice(req, res) {
  try {
    const { token, platform, deviceModel } = req.body;

    if (!token || typeof token !== 'string') {
      return errorResponse(res, 'Token FCM wajib disertakan', 400);
    }

    const userId = req.user.id;
    const device = await registerDeviceToken({
      userId,
      token,
      platform: platform || 'android',
      deviceModel,
    });

    return successResponse(res, device, 'Perangkat berhasil didaftarkan untuk notifikasi', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Deactivate FCM device token on user logout
 * POST /api/notifications/devices/logout
 */
export async function logoutDevice(req, res) {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    await deactivateDeviceToken({ userId, token });

    return successResponse(res, null, 'Perangkat berhasil dinonaktifkan dari sesi notifikasi');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Get authenticated user's notification history
 * GET /api/notifications
 */
export async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const { category, isRead, page = 1, limit = 20 } = req.query;

    const data = await getUserNotifications({
      userId,
      category,
      isRead,
      page,
      limit,
    });

    return successResponse(res, data, 'Daftar notifikasi berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Get unread notification badge count
 * GET /api/notifications/unread-count
 */
export async function getUnreadBadgeCount(req, res) {
  try {
    const userId = req.user.id;
    const count = await getUnreadCount(userId);

    return successResponse(res, { count }, 'Jumlah notifikasi belum dibaca');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markSingleNotificationAsRead(req, res) {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(id)) {
      return errorResponse(res, 'ID notifikasi tidak valid', 400);
    }

    const result = await markAsRead({ id, userId });
    return successResponse(res, result, 'Notifikasi telah ditandai dibaca');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Mark all notifications as read for current user
 * PATCH /api/notifications/read-all
 */
export async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user.id;
    const result = await markAllAsRead(userId);

    return successResponse(res, result, 'Semua notifikasi telah ditandai dibaca');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Test push notification (Protected: Owner & Manager only)
 * POST /api/notifications/test-push
 */
export async function testPushNotification(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['OWNER', 'MANAGER'].includes(userRole)) {
      return errorResponse(res, 'Hanya Owner atau Manager yang dapat menguji notifikasi push', 403);
    }

    const configured = isFCMConfigured();

    const dispatchRes = await dispatchNotification({
      event: 'OPERATIONAL_TEST',
      category: 'ALERTS',
      title: '🔔 Uji Coba Push Notification Komazi POS',
      body: `Notifikasi uji coba berhasil dikirim untuk akun ${req.user.name} (${userRole}). Mode: ${
        configured ? 'Firebase Cloud Messaging Aktif' : 'Simulated / Dev Mode'
      }`,
      data: {
        url: '/settings',
        testId: String(Date.now()),
      },
      targetUserIds: [userId],
    });

    return successResponse(
      res,
      {
        ...dispatchRes,
        isFCMConfigured: configured,
      },
      configured
        ? 'Notifikasi uji coba FCM berhasil dikirim ke perangkat Anda'
        : 'Notifikasi uji coba berhasil disimpan (FCM running in simulated mode)'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
