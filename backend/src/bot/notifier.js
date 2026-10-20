import { bot } from './index.js';
import prisma from '../config/db.js';
import { events } from './events.js';
import { buildOrderCard } from './keyboards/index.js';
import { rupiah, esc } from './utils/format.js';
import { InlineKeyboard } from 'grammy';
import { generateBotImage } from '../services/botImage/index.js';
import { sendPhotoWithFallback, notifierVisual } from './utils/sendVisual.js';

async function getSetting(key, defaultValue = null) {
  try {
    const s = await prisma.setting.findUnique({ where: { key } });
    return s ? s.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function safeSend(chatId, text, extra = {}) {
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
    return true;
  } catch (err) {
    if (err.error_code === 403) {
      // User memblokir bot -> bersihkan tautan agar tidak error berulang
      await prisma.user.updateMany({
        where: { telegramId: String(chatId) },
        data: { telegramId: null },
      });
    } else {
      console.warn(`[Notifier] Gagal mengirim pesan ke ${chatId}:`, err.description || err.message);
    }
    return false;
  }
}

export const notifier = {
  async toUser(userId, text, extra = {}) {
    const u = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (u?.telegramId) {
      await safeSend(u.telegramId, text, extra);
    }
  },

  async toRoles(roles = [], text, extra = {}) {
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
        telegramId: { not: null },
      },
    });
    await Promise.all(users.map((u) => safeSend(u.telegramId, text, extra)));
  },
};

// --- Event Subscribers ---

// 1) Pesanan Baru Masuk -> Barista (DM atau Grup) dengan CardKitchenTicket
events.on('order.created', async (order) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    if (!botEnabled) return;

    const { text, keyboard } = buildOrderCard(order);
    const groupId = (await getSetting('botBaristaChatId')) || (await getSetting('bot.barista_chat_id'));

    const imagePromise = generateBotImage('kitchen_ticket', order);

    if (groupId) {
      await sendPhotoWithFallback({
        chatId: groupId,
        imageBufferPromise: imagePromise,
        captionHtml: text,
        replyMarkup: keyboard,
      });
    } else {
      await notifierVisual.toRoles(['BARISTA'], {
        imageBufferPromise: imagePromise,
        captionHtml: text,
        replyMarkup: keyboard,
      });
    }
  } catch (err) {
    console.warn('[Notifier] order.created error:', err.message);
  }
});

// 2) Pesanan Siap -> Kasir dengan CardOrderReady
events.on('order.ready', async (order) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    if (!botEnabled) return;

    if (order.cashier?.telegramId || order.cashierId) {
      const msg = `☕ <b>Pesanan Siap!</b>\nPesanan <b>${esc(order.invoiceNo)}</b> ${order.tableNo ? `(Meja ${esc(order.tableNo)})` : ''} sudah siap diantar / disajikan.`;
      const imagePromise = generateBotImage('order_ready', {
        invoiceNo: order.invoiceNo,
        tableNo: order.tableNo,
        customerName: order.customerName || 'Pelanggan',
      });

      if (order.cashier?.telegramId) {
        await sendPhotoWithFallback({
          chatId: order.cashier.telegramId,
          imageBufferPromise: imagePromise,
          captionHtml: msg,
        });
      } else {
        await notifierVisual.toUser(order.cashierId, {
          imageBufferPromise: imagePromise,
          captionHtml: msg,
        });
      }
    }
  } catch (err) {
    console.warn('[Notifier] order.ready error:', err.message);
  }
});

// 3) Permintaan Persetujuan Baru -> Manager & Owner dengan CardApprovalRequest
events.on('approval.requested', async ({ request, order }) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyApproval = (await getSetting('botNotifyApproval', 'true')) === 'true';
    if (!botEnabled || !notifyApproval) return;

    const kb = new InlineKeyboard()
      .text('✅ Setujui', `apr:ok:${request.id}`)
      .text('❌ Tolak', `apr:no:${request.id}`);

    const text = `
🔔 <b>Permintaan Persetujuan #${request.id}</b>
━━━━━━━━━━━━━━━━━━
<b>Jenis:</b> ${request.type}
<b>Pesanan:</b> ${esc(order.invoiceNo)} (${rupiah(order.total)})
<b>Kasir:</b> ${esc(request.requester?.name || 'Kasir')}
<b>Alasan:</b> <i>${esc(request.reason)}</i>
━━━━━━━━━━━━━━━━━━
    `.trim();

    const imagePromise = generateBotImage('approval_request', {
      reqId: request.id,
      type: request.type,
      invoiceNo: order.invoiceNo,
      amount: order.total,
      requesterName: request.requester?.name || 'Kasir',
      reason: request.reason,
    });

    await notifierVisual.toRoles(['MANAGER', 'OWNER'], {
      imageBufferPromise: imagePromise,
      captionHtml: text,
      replyMarkup: kb,
    });
  } catch (err) {
    console.warn('[Notifier] approval.requested error:', err.message);
  }
});

// 4) Pesanan di-Void -> Owner dengan CardSecurityAlert
events.on('order.voided', async ({ order, reason }) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyVoid = (await getSetting('botNotifyVoid', 'true')) === 'true';
    if (!botEnabled || !notifyVoid) return;

    const minAlertSetting = (await getSetting('botVoidMinAmount')) || (await getSetting('bot.void_alert_min', '100000'));
    const minAlert = parseFloat(minAlertSetting);
    if (Number(order.total) >= minAlert) {
      const text = `
⚠️ <b>NOTIFIKASI VOID PESANAN TINGGI</b>
━━━━━━━━━━━━━━━━━━
Pesanan: <b>${esc(order.invoiceNo)}</b>
Nominal: <b>${rupiah(order.total)}</b>
Alasan: <i>${esc(reason)}</i>
Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB
━━━━━━━━━━━━━━━━━━
      `.trim();

      const imagePromise = generateBotImage('security_alert', {
        invoiceNo: order.invoiceNo,
        amount: order.total,
        reason,
      });

      await notifierVisual.toRoles(['OWNER'], {
        imageBufferPromise: imagePromise,
        captionHtml: text,
      });
    }
  } catch (err) {
    console.warn('[Notifier] order.voided error:', err.message);
  }
});

// 5) Peringatan Stok Menipis -> Manager & Owner dengan CardInventoryCritical
events.on('stock.low', async ({ ingredientName, currentStock, minStock, unit }) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyStock = (await getSetting('botNotifyLowStock', 'true')) === 'true';
    if (!botEnabled || !notifyStock) return;

    const text = `
⚠️ <b>PERINGATAN STOK MENIPIS</b>
━━━━━━━━━━━━━━━━━━
Bahan: <b>${esc(ingredientName)}</b>
Sisa Stok: <b>${currentStock} ${unit}</b>
Batas Minimum: ${minStock} ${unit}
━━━━━━━━━━━━━━━━━━
<i>Segera restock atau catat pembelian dengan /stok_masuk.</i>
    `.trim();

    const imagePromise = generateBotImage('inventory_critical', {
      items: [{ name: ingredientName, stock: currentStock, minStock, unit }],
    });

    await notifierVisual.toRoles(['MANAGER', 'OWNER'], {
      imageBufferPromise: imagePromise,
      captionHtml: text,
    });
  } catch (err) {
    console.warn('[Notifier] stock.low error:', err.message);
  }
});

// 6a) Shift Dibuka -> Manager & Owner dengan CardShiftOpen
events.on('shift.opened', async ({ shift, cashier, openingCash, register }) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyShift = (await getSetting('botNotifyShift', 'true')) === 'true';
    if (!botEnabled || !notifyShift) return;

    const cashierName = cashier?.name || shift?.cashier?.name || 'Kasir';
    const regName = register?.name || shift?.register?.name || 'Kasir Utama';
    const regCode = register?.code || shift?.register?.code || 'REG-01';
    const initialCash = Number(openingCash !== undefined ? openingCash : (shift?.openingCash || 0));
    const shiftId = shift?.id || 'NEW';

    const text = `
🟢 <b>NOTIFIKASI BUKA SHIFT KASIR</b>
━━━━━━━━━━━━━━━━━━
Kasir: <b>${esc(cashierName)}</b>
Terminal: <b>${esc(regName)}</b>
Modal Awal Kas: <b>${rupiah(initialCash)}</b>
Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB
━━━━━━━━━━━━━━━━━━
<i>Sesi kasir baru siap melayani pesanan POS.</i>
    `.trim();

    const imagePromise = generateBotImage('shift_open', {
      shiftId,
      cashierName,
      initialCash,
      outletName: 'Komazi Coffee & Workspace',
      openedAt: shift?.openedAt || new Date(),
    });

    await notifierVisual.toRoles(['MANAGER', 'OWNER'], {
      imageBufferPromise: imagePromise,
      captionHtml: text,
    });
  } catch (err) {
    console.warn('[Notifier] shift.opened error:', err.message);
  }
});

// 6b) Shift Ditutup -> Manager & Owner dengan CardShiftClosed
events.on('shift.closed', async ({ cashier, summary }) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyShift = (await getSetting('botNotifyShift', 'true')) === 'true';
    if (!botEnabled || !notifyShift) return;

    const cashierName = cashier?.name || summary?.cashierName || 'Kasir';
    const closedByName = summary?.closedByName || cashierName;
    const regName = summary?.registerName || 'Kasir Utama';
    const shiftId = summary?.id || 'Z-REP';

    const initialCash = Number(summary?.openingCash || 0);
    const countedCash = Number(summary?.closingCash || 0);
    const expectedCash = Number(summary?.expectedCash || 0);
    const diff = Number(
      summary?.difference !== undefined
        ? summary.difference
        : summary?.diff !== undefined
        ? summary.diff
        : countedCash - expectedCash
    );
    const cashSales = Number(summary?.totalCashSales || summary?.cashSales || 0);
    const nonCashSales = Number(summary?.totalNonCashSales || summary?.nonCashSales || 0);
    const totalSales = Number(summary?.totalSales || (cashSales + nonCashSales));
    const ordersCount = Number(summary?.ordersCount || 0);
    const notes = summary?.notes || '';

    const diffText = diff === 0
      ? '🟢 Kas Imbang (Pas / Rp 0)'
      : diff > 0
      ? `🔵 Lebih +${rupiah(diff)}`
      : `🔴 Selisih Kurang ${rupiah(diff)}`;

    const text = `
🔒 <b>NOTIFIKASI TUTUP SHIFT KASIR (Z-REPORT)</b>
━━━━━━━━━━━━━━━━━━
ID Sesi: <b>#${shiftId}</b> • Terminal: <b>${esc(regName)}</b>
Kasir Pembuka: <b>${esc(cashierName)}</b>
${closedByName && closedByName !== cashierName ? `Kasir Penutup: <b>${esc(closedByName)}</b>\n` : ''}Waktu Tutup: ${new Date().toLocaleTimeString('id-ID')} WIB
━━━━━━━━━━━━━━━━━━
Modal Awal: ${rupiah(initialCash)}
Penjualan Tunai: ${rupiah(cashSales)}
Penjualan Non-Tunai: ${rupiah(nonCashSales)}
Total Penjualan: <b>${rupiah(totalSales)}</b> (${ordersCount} transaksi)
━━━━━━━━━━━━━━━━━━
Kas yang Diharapkan: ${rupiah(expectedCash)}
Kas Fisik Aktual: <b>${rupiah(countedCash)}</b>
Status Rekonsiliasi: <b>${diffText}</b>
${notes ? `Catatan: <i>${esc(notes)}</i>\n` : ''}━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
    `.trim();

    const imagePromise = generateBotImage('shift_closed', {
      shiftId,
      cashierName,
      initialCash,
      closingCash: countedCash,
      expectedCash,
      diff,
      notes,
      cashSales,
      qrisSales: nonCashSales,
      totalSales,
    });

    await notifierVisual.toRoles(['MANAGER', 'OWNER'], {
      imageBufferPromise: imagePromise,
      captionHtml: text,
    });
  } catch (err) {
    console.warn('[Notifier] shift.closed error:', err.message);
  }
});

// 7) Transaksi Berhasil (Order Paid) -> Owner & Manager
events.on('order.paid', async (order) => {
  try {
    const botEnabled = (await getSetting('botEnabled', 'true')) === 'true';
    const notifyTx = (await getSetting('botNotifyTransaction', 'true')) === 'true';
    if (!botEnabled || !notifyTx) return;

    const { notifyPaidTransaction } = await import('../services/telegramService.js');
    await notifyPaidTransaction(order);
  } catch (err) {
    console.warn('[Notifier] order.paid error:', err.message);
  }
});
