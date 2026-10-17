import prisma from '../config/db.js';
import { fcmService } from './fcm.service.js';
import { getIO } from '../config/socket.js';
import logger from '../utils/logger.js';

function maskToken(token) {
  if (!token || typeof token !== 'string') return '***';
  if (token.length <= 12) return '***';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

/**
 * Role-Based Recipient Resolution Service (PRD Section 3)
 * Resolves target active users strictly based on business event rules.
 * Does not trust client-supplied recipient arrays.
 */
export async function resolveRecipientsForEvent(event, context = {}) {
  const targetUserIds = new Set();

  try {
    let targetRoles = [];

    switch (event) {
      case 'NEW_ORDER': {
        // Targeted routing based on ordered items:
        // Food items -> KITCHEN, MANAGER
        // Drinks -> BARISTA, MANAGER
        // Both / default -> KITCHEN, BARISTA, MANAGER
        const { hasKitchen = true, hasBar = true } = context;
        if (hasKitchen) targetRoles.push('KITCHEN');
        if (hasBar) targetRoles.push('BARISTA');
        targetRoles.push('MANAGER');
        break;
      }

      case 'ORDER_PAID': {
        // Operational summary: OWNER and MANAGER
        targetRoles = ['OWNER', 'MANAGER'];
        break;
      }

      case 'ORDER_READY': {
        // When kitchen/bar finishes prep, notify cashiers to serve
        targetRoles = ['CASHIER', 'MANAGER'];
        if (context.cashierId) {
          targetUserIds.add(Number(context.cashierId));
        }
        break;
      }

      case 'ORDER_VOIDED': {
        // Void requires supervisor awareness; also kitchen/bar if prep was cancelled
        targetRoles = ['OWNER', 'MANAGER'];
        if (context.hadActivePrep) {
          targetRoles.push('KITCHEN', 'BARISTA');
        }
        break;
      }

      case 'REFUND_REQUEST':
      case 'APPROVAL_REQUEST': {
        // Approvals strictly targeted to OWNER and MANAGER
        targetRoles = ['OWNER', 'MANAGER'];
        break;
      }

      case 'LOW_STOCK': {
        // Inventory alert: OWNER, MANAGER, and responsible operational role
        targetRoles = ['OWNER', 'MANAGER'];
        if (context.isCoffeeOrDrink) {
          targetRoles.push('BARISTA');
        } else if (context.isFood) {
          targetRoles.push('KITCHEN');
        }
        break;
      }

      case 'SHIFT_CLOSED': {
        targetRoles = ['OWNER', 'MANAGER'];
        break;
      }

      default: {
        targetRoles = ['OWNER', 'MANAGER'];
        break;
      }
    }

    // Query active users with the matching roles
    const activeUsers = await prisma.user.findMany({
      where: {
        role: { in: targetRoles },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
    });

    activeUsers.forEach((u) => targetUserIds.add(u.id));

    // Exclude sender / initiator from receiving their own action notification if specified
    if (context.initiatorId && context.excludeInitiator) {
      targetUserIds.delete(Number(context.initiatorId));
    }
  } catch (err) {
    logger.notification.error('Error resolving recipients for event:', {
      event,
      error: err.message,
    });
  }

  return Array.from(targetUserIds);
}

/**
 * Registers or updates an FCM device token for a user.
 * Reassigns token if device was previously logged in as another user (single active token guarantee).
 */
export async function registerDeviceToken({ userId, token, platform = 'android', deviceModel = null }) {
  if (!userId || !token) {
    throw new Error('User ID dan token FCM wajib disertakan');
  }

  const cleanToken = token.trim();
  const cleanPlatform = String(platform || 'android').toLowerCase();

  const record = await prisma.deviceToken.upsert({
    where: { token: cleanToken },
    create: {
      userId: Number(userId),
      token: cleanToken,
      platform: cleanPlatform,
      deviceModel: deviceModel ? String(deviceModel).trim() : null,
      isActive: true,
      lastUsedAt: new Date(),
    },
    update: {
      userId: Number(userId),
      platform: cleanPlatform,
      deviceModel: deviceModel ? String(deviceModel).trim() : null,
      isActive: true,
      lastUsedAt: new Date(),
    },
  });

  logger.push.info(`PUSH.REGISTER | userId=${userId} platform=${cleanPlatform} token=${maskToken(cleanToken)}`, {
    userId,
    platform: cleanPlatform,
    token: maskToken(cleanToken),
  });

  return record;
}

/**
 * Deactivates device token(s) when a user logs out.
 */
export async function deactivateDeviceToken({ userId, token = null }) {
  if (!userId) return { count: 0 };

  const whereClause = { userId: Number(userId) };
  if (token && typeof token === 'string' && token.trim()) {
    whereClause.token = token.trim();
  }

  const result = await prisma.deviceToken.updateMany({
    where: whereClause,
    data: { isActive: false },
  });

  logger.push.info(`PUSH.DEACTIVATE | userId=${userId} deactivatedCount=${result.count}`, {
    userId,
    count: result.count,
    token: token ? maskToken(token) : 'ALL',
  });

  return result;
}

/**
 * Dispatches a notification asynchronously:
 * 1. Resolves authorized recipient user IDs.
 * 2. Persists in-app Notification records in MySQL for all recipients.
 * 3. Broadcasts realtime Socket.IO notification to active client sessions.
 * 4. Gathers active FCM device tokens for resolved users.
 * 5. Sends multicast push via Firebase Admin SDK.
 * 6. Deactivates invalid tokens reported by FCM.
 *
 * NOTE: Non-blocking execution. POS operations MUST NOT await or fail if this encounters network error.
 */
export async function dispatchNotification({
  event,
  category = 'GENERAL',
  title,
  body,
  data = {},
  targetUserIds = null,
  context = {},
}) {
  try {
    // 1. Resolve recipients
    let resolvedUserIds = targetUserIds;
    if (!resolvedUserIds || !Array.isArray(resolvedUserIds) || resolvedUserIds.length === 0) {
      resolvedUserIds = await resolveRecipientsForEvent(event, context);
    }

    if (!resolvedUserIds || resolvedUserIds.length === 0) {
      logger.notification.debug(`No active recipients for notification event: ${event}`);
      return { success: true, count: 0, reason: 'NO_RECIPIENTS' };
    }

    // Deduplicate recipient IDs
    const uniqueUserIds = Array.from(new Set(resolvedUserIds.map((id) => Number(id))));

    // 2. Persist in-app notifications in MySQL
    const notificationRecords = await prisma.$transaction(
      uniqueUserIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            category,
            event,
            title,
            body,
            data: data || {},
            isRead: false,
            pushStatus: 'PENDING',
          },
        })
      )
    );

    // 3. Realtime Socket.IO dispatch to connected frontend apps
    try {
      const io = getIO();
      if (io) {
        notificationRecords.forEach((notif) => {
          io.emit('notification:new', notif);
        });
      }
    } catch (sockErr) {
      logger.notification.debug(`Socket.IO emit notice: ${sockErr.message}`);
    }

    // 4. Fetch active FCM tokens for these users
    const activeTokens = await prisma.deviceToken.findMany({
      where: {
        userId: { in: uniqueUserIds },
        isActive: true,
      },
      select: { token: true, userId: true },
    });

    if (activeTokens.length === 0) {
      // Mark push status as SKIPPED since no mobile devices are registered for these users
      await prisma.notification.updateMany({
        where: { id: { in: notificationRecords.map((n) => n.id) } },
        data: { pushStatus: 'SKIPPED' },
      });

      return {
        success: true,
        persistedCount: notificationRecords.length,
        pushedCount: 0,
        reason: 'NO_ACTIVE_DEVICE_TOKENS',
      };
    }

    // 5. Send multicast push via FCM
    const tokensList = Array.from(new Set(activeTokens.map((t) => t.token)));
    const fcmResult = await fcmService.sendMulticastPush({
      tokens: tokensList,
      title,
      body,
      data: {
        ...data,
        notificationId: notificationRecords[0]?.id ? String(notificationRecords[0].id) : '',
        category,
        event,
      },
      category: category === 'ORDERS' ? 'komazi_orders' : category === 'ALERTS' ? 'komazi_alerts' : 'komazi_general',
    });

    // 6. Handle invalid tokens if reported by FCM
    if (fcmResult.invalidTokens && fcmResult.invalidTokens.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { token: { in: fcmResult.invalidTokens } },
        data: { isActive: false },
      });
      logger.push.warn(`Deactivated ${fcmResult.invalidTokens.length} invalid tokens reported by FCM`);
    }

    // 7. Update status in DB
    const finalPushStatus = fcmResult.successCount > 0 ? 'SENT' : fcmResult.isSimulated ? 'SIMULATED' : 'FAILED';
    await prisma.notification.updateMany({
      where: { id: { in: notificationRecords.map((n) => n.id) } },
      data: { pushStatus: finalPushStatus },
    });

    return {
      success: true,
      persistedCount: notificationRecords.length,
      pushedCount: fcmResult.successCount,
      failedPushCount: fcmResult.failureCount,
      isSimulated: fcmResult.isSimulated,
    };
  } catch (err) {
    logger.notification.error('Error dispatching notification:', {
      event,
      title,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Retrieval and state management for user In-App notifications.
 */
export async function getUserNotifications({ userId, category = null, isRead = null, page = 1, limit = 20 }) {
  const take = Math.min(Math.max(1, Number(limit) || 20), 100);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const where = { userId: Number(userId) };
  if (category && typeof category === 'string' && category.trim()) {
    where.category = category.trim().toUpperCase();
  }
  if (isRead !== null && isRead !== undefined) {
    where.isRead = isRead === 'true' || isRead === true;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page: Number(page) || 1,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

export async function getUnreadCount(userId) {
  const count = await prisma.notification.count({
    where: {
      userId: Number(userId),
      isRead: false,
    },
  });
  return count;
}

export async function markAsRead({ id, userId }) {
  const updated = await prisma.notification.updateMany({
    where: {
      id: Number(id),
      userId: Number(userId),
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  logger.notification.info(`NOTIFICATION.READ | notifId=${id} userId=${userId}`);
  return { updated: updated.count > 0 };
}

export async function markAllAsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: {
      userId: Number(userId),
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  logger.notification.info(`NOTIFICATION.READ_ALL | userId=${userId} count=${result.count}`);
  return { count: result.count };
}

export const notificationService = {
  resolveRecipientsForEvent,
  registerDeviceToken,
  deactivateDeviceToken,
  dispatchNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};

export default notificationService;
