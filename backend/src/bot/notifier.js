import { bot } from './index.js';
import prisma from '../config/db.js';
import { events } from './events.js';
import { buildOrderCard } from './keyboards/index.js';
import { rupiah, esc } from './utils/format.js';
import { InlineKeyboard } from 'grammy';

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

// 1) Pesanan Baru Masuk -> Barista (DM atau Grup)
events.on('order.created', async (order) => {
  try {
    const { text, keyboard } = buildOrderCard(order);
    const groupId = await getSetting('bot.barista_chat_id');
    if (groupId) {
      await safeSend(groupId, text, { reply_markup: keyboard });
    } else {
      await notifier.toRoles(['BARISTA'], text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.warn('[Notifier] order.created error:', err.message);
  }
});

// 2) Pesanan Siap -> Kasir
events.on('order.ready', async (order) => {
  try {
    if (order.cashier?.telegramId || order.cashierId) {
      const msg = `☕ <b>Pesanan Siap!</b>\nPesanan <b>${esc(order.invoiceNo)}</b> ${order.tableNo ? `(Meja ${esc(order.tableNo)})` : ''} sudah siap diantar / disajikan.`;
      if (order.cashier?.telegramId) {
        await safeSend(order.cashier.telegramId, msg);
      } else {
        await notifier.toUser(order.cashierId, msg);
      }
    }
  } catch (err) {
    console.warn('[Notifier] order.ready error:', err.message);
  }
});

// 3) Permintaan Persetujuan Baru -> Manager & Owner
events.on('approval.requested', async ({ request, order }) => {
  try {
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

    await notifier.toRoles(['MANAGER', 'OWNER'], text, { reply_markup: kb });
  } catch (err) {
    console.warn('[Notifier] approval.requested error:', err.message);
  }
});

// 4) Pesanan di-Void -> Owner
events.on('order.voided', async ({ order, reason }) => {
  try {
    const minAlert = parseFloat(await getSetting('bot.void_alert_min', '100000'));
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
      await notifier.toRoles(['OWNER'], text);
    }
  } catch (err) {
    console.warn('[Notifier] order.voided error:', err.message);
  }
});

// 5) Peringatan Stok Menipis -> Manager & Owner
events.on('stock.low', async ({ ingredientName, currentStock, minStock, unit }) => {
  try {
    const text = `
⚠️ <b>PERINGATAN STOK MENIPIS</b>
━━━━━━━━━━━━━━━━━━
Bahan: <b>${esc(ingredientName)}</b>
Sisa Stok: <b>${currentStock} ${unit}</b>
Batas Minimum: ${minStock} ${unit}
━━━━━━━━━━━━━━━━━━
<i>Segera restock atau catat pembelian dengan /stok_masuk.</i>
    `.trim();

    await notifier.toRoles(['MANAGER', 'OWNER'], text);
  } catch (err) {
    console.warn('[Notifier] stock.low error:', err.message);
  }
});

// 6) Shift Ditutup -> Manager & Owner
events.on('shift.closed', async ({ cashier, summary }) => {
  try {
    const diffText = summary.diff === 0
      ? '🟢 Kas Imbang'
      : summary.diff > 0
      ? `🟡 Lebih +${rupiah(summary.diff)}`
      : `🔴 Selisih Kurang ${rupiah(summary.diff)}`;

    const text = `
🔒 <b>NOTIFIKASI TUTUP SHIFT</b>
━━━━━━━━━━━━━━━━━━
Kasir: <b>${esc(cashier.name)}</b>
Total Kas Aktual: <b>${rupiah(summary.closingCash)}</b>
Kas Seharusnya: ${rupiah(summary.expectedCash)}
Status Laci: <b>${diffText}</b>
${summary.notes ? `Catatan: <i>${esc(summary.notes)}</i>\n` : ''}━━━━━━━━━━━━━━━━━━
    `.trim();

    await notifier.toRoles(['MANAGER', 'OWNER'], text);
  } catch (err) {
    console.warn('[Notifier] shift.closed error:', err.message);
  }
});

// 7) Transaksi Berhasil (Order Paid) -> Owner & Manager
events.on('order.paid', async (order) => {
  try {
    const { notifyPaidTransaction } = await import('../services/telegramService.js');
    await notifyPaidTransaction(order);
  } catch (err) {
    console.warn('[Notifier] order.paid error:', err.message);
  }
});

