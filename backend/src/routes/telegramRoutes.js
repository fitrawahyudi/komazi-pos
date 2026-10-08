import { Router } from 'express';
import { handleTelegramWebhook, sendTelegramMessage } from '../services/telegramService.js';
import { telegramLinkService } from '../services/telegramLinkService.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { successResponse, errorResponse } from '../utils/response.js';
import prisma from '../config/db.js';

const router = Router();

/**
 * Public Webhook endpoint called by Telegram Servers (Section 33)
 */
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    const result = await handleTelegramWebhook(update);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[TelegramRoute] Error in webhook:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Test notification endpoint for Admin/Owner in POS settings
 */
router.post('/test', authenticate, requireRole(['OWNER', 'MANAGER']), async (req, res) => {
  try {
    const { message } = req.body || {};
    const text = message || `🔔 <b>UJI COBA NOTIFIKASI TELEGRAM</b>\n\nKoneksi bot Telegram POS Komazi berhasil diverifikasi pada ${new Date().toLocaleTimeString('id-ID')} WIB.`;
    const result = await sendTelegramMessage(text);
    if (!result.success) {
      return errorResponse(res, `Gagal mengirim pesan: ${result.reason || result.error || 'Konfigurasi tidak lengkap'}`, 400);
    }
    return successResponse(res, result, 'Pesan uji coba berhasil dikirim ke Telegram!');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * Status endpoint
 */
router.get('/status', authenticate, async (req, res) => {
  const isConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
  const linkedAdmins = await prisma.user.count({
    where: {
      role: { in: ['OWNER', 'MANAGER'] },
      isActive: true,
      telegramId: { not: null },
    },
  });
  return successResponse(res, {
    configured: isConfigured,
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hasRecipients: linkedAdmins > 0,
    linkedAdminsCount: linkedAdmins,
  });
});

/**
 * Staff telegram linking endpoints for Owner
 */
router.get('/staff', authenticate, requireRole(['OWNER', 'MANAGER']), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, staff, 'Daftar staf dan status telegram');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/link-code', authenticate, requireRole(['OWNER', 'MANAGER']), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return errorResponse(res, 'userId diperlukan', 400);

    const code = await telegramLinkService.generate(userId);
    return successResponse(res, { code }, 'Kode tautan berhasil dibuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/unlink', authenticate, requireRole(['OWNER', 'MANAGER']), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return errorResponse(res, 'userId diperlukan', 400);

    const unlinked = await telegramLinkService.unlink(userId);
    return successResponse(res, unlinked, 'Akun telegram berhasil diputuskan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

export default router;
