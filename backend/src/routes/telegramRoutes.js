import { Router } from 'express';
import { handleTelegramWebhook, sendTelegramMessage, sendTelegramPhoto } from '../services/telegramService.js';
import { generateReceiptImageBuffer } from '../services/receiptCanvasService.js';
import { telegramLinkService } from '../services/telegramLinkService.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { successResponse, errorResponse } from '../utils/response.js';
import prisma from '../config/db.js';
import { bot, getBotMode } from '../bot/index.js';

const router = Router();

/**
 * Public Webhook endpoint called by Telegram Servers (Section 33)
 */
router.post('/webhook', async (req, res) => {
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (incomingSecret !== secretToken) {
        console.warn('[Telegram Webhook] Akses ditolak: Secret token tidak valid.');
        return res.status(401).json({ ok: false, error: 'Unauthorized secret token' });
      }
    }

    const update = req.body;
    if (update && (update.update_id !== undefined || update.message || update.callback_query)) {
      if (!bot.isInited()) {
        await bot.init();
      }
      await bot.handleUpdate(update);
      return res.json({ ok: true });
    }
    const result = await handleTelegramWebhook(update);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[TelegramRoute] Error in webhook:', err);
    return res.status(200).json({ ok: true, warning: err.message });
  }
});

/**
 * Test notification endpoint for Admin/Owner in POS settings
 * Mengirimkan banner grafis Canvas + caption digital receipt
 */
router.post('/test', authenticate, requireRole(['OWNER', 'MANAGER']), async (req, res) => {
  try {
    const dateObj = new Date();
    const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    const invoiceNo = `KMZ-${dateObj.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const customer = req.user?.name ? `${req.user.name} (${req.user.role})` : 'Ridho Mckinnon (Owner)';

    const sampleOrder = {
      invoiceNo,
      customerName: customer,
      cashierName: 'Sarah (Shift Pagi)',
      paymentMethod: 'QRIS Dinamis (EMVCo)',
      paidAt: dateObj,
      subtotal: 98000,
      tax: 0,
      discount: 0,
      total: 98000,
      items: [
        {
          name: 'Aren Latte Signature',
          variantName: 'Large (Iced)',
          note: 'Less Sugar, Oat Milk',
          qty: 2,
          unitPrice: 34000,
          lineTotal: 68000,
        },
        {
          name: 'Butter Croissant Almond',
          variantName: 'Warm (Dipanaskan)',
          note: 'Extra Napkin',
          qty: 1,
          unitPrice: 30000,
          lineTotal: 30000,
        },
      ],
    };

    let photoBuffer = null;
    try {
      photoBuffer = await generateReceiptImageBuffer(sampleOrder);
    } catch (err) {
      console.warn('[TelegramRoute] Test canvas error:', err.message);
    }

    const caption = `
🧾 <b>STRUK TRANSAKSI — PAID ✅</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Pelanggan:</b> <code>${customer}</code>
💳 <b>Metode:</b> <b>QRIS Dinamis (EMVCo)</b>
📅 <b>Waktu:</b> ${dateStr} · ${timeStr}
🧾 <b>No. Invoice:</b> <code>${invoiceNo}</code>
━━━━━━━━━━━━━━━━━━━━━
📋 <b>RINCIAN PESANAN:</b>
• <b>2× Aren Latte Signature</b> — Rp68.000 (Rp34.000/item)
   🏷️ <i>Varian/Suhu: Large (Iced)</i>
   📝 <i>Catatan: Less Sugar, Oat Milk</i>
• <b>1× Butter Croissant Almond</b> — Rp30.000 (Rp30.000/item)
   🏷️ <i>Varian: Warm (Dipanaskan)</i>
   📝 <i>Catatan: Extra Napkin</i>
─────────────────────
🧮 <b>Subtotal (3 item):</b> Rp98.000
💵 <b>TOTAL BAYAR:</b> <b>Rp98.000</b>
━━━━━━━━━━━━━━━━━━━━━
☕ <i>Komazi Coffee & Workspace</i>
    `.trim();

    let result;
    if (photoBuffer) {
      result = await sendTelegramPhoto(photoBuffer, caption);
    } else {
      result = await sendTelegramMessage(caption);
    }

    if (!result.success) {
      return errorResponse(res, `Gagal mengirim pesan: ${result.reason || result.error || 'Konfigurasi bot token atau Chat ID penerima belum ada'}`, 400);
    }
    return successResponse(res, result, 'Banner struk grafis dan notifikasi berhasil dikirim ke bot Telegram!');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * Status endpoint
 */
router.get('/status', authenticate, async (req, res) => {
  const isConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
  if (isConfigured && !bot.isInited()) {
    try {
      await bot.init();
    } catch (e) {
      console.warn('[TelegramRoute] bot.init failed in status:', e.message);
    }
  }

  const linkedAdmins = await prisma.user.count({
    where: {
      role: { in: ['OWNER', 'MANAGER'] },
      isActive: true,
      telegramId: { not: null },
    },
  });

  const botUsername = bot.isInited() ? bot.botInfo?.username : (process.env.TELEGRAM_BOT_USERNAME || null);

  return successResponse(res, {
    configured: isConfigured,
    hasToken: isConfigured,
    hasRecipients: linkedAdmins > 0,
    linkedAdminsCount: linkedAdmins,
    mode: getBotMode(),
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || null,
    botUsername,
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

router.post('/link-code', authenticate, async (req, res) => {
  try {
    const targetUserId = req.body?.userId ? Number(req.body.userId) : req.user.id;
    if (targetUserId !== req.user.id && !['OWNER', 'MANAGER'].includes(req.user.role)) {
      return errorResponse(res, 'Hanya Owner atau Manager yang dapat membuat kode untuk staf lain', 403);
    }

    const code = await telegramLinkService.generate(targetUserId);

    if (process.env.TELEGRAM_BOT_TOKEN && !bot.isInited()) {
      try {
        await bot.init();
      } catch (e) {
        console.warn('[TelegramRoute] bot.init failed in link-code:', e.message);
      }
    }

    const botUsername = bot.isInited() ? bot.botInfo?.username : (process.env.TELEGRAM_BOT_USERNAME || null);

    return successResponse(res, { code, botUsername }, 'Kode tautan berhasil dibuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/unlink', authenticate, async (req, res) => {
  try {
    const targetUserId = req.body?.userId ? Number(req.body.userId) : req.user.id;
    if (targetUserId !== req.user.id && !['OWNER', 'MANAGER'].includes(req.user.role)) {
      return errorResponse(res, 'Hanya Owner atau Manager yang dapat memutuskan tautan staf lain', 403);
    }

    const unlinked = await telegramLinkService.unlink(targetUserId);
    return successResponse(res, unlinked, 'Akun telegram berhasil diputuskan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

export default router;
