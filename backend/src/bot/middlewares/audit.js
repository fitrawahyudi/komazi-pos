import prisma from '../../config/db.js';

export async function logBotAudit(userId, action, detail = {}) {
  try {
    if (!userId) return;
    await prisma.auditLog.create({
      data: {
        userId: Number(userId),
        action: `TELEGRAM_${action}`,
        detail: {
          source: 'telegram',
          ...detail,
        },
      },
    });
  } catch (err) {
    console.warn('[AuditLog] Failed to record telegram audit:', err.message);
  }
}
