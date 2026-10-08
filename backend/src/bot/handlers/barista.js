import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { notifier } from '../notifier.js';
import { rupiah, esc } from '../utils/format.js';

export function registerBarista(bot) {
  // 1) Lihat antrean pesanan
  bot.command('antrean', requireRole('BARISTA', 'MANAGER'), async (ctx) => {
    const queue = await orderService.listQueue();

    if (!queue || queue.length === 0) {
      return ctx.reply('✨ <b>Antrean Bersih!</b>\nTidak ada pesanan yang sedang menunggu racikan barista saat ini.', {
        parse_mode: 'HTML',
      });
    }

    const cards = queue.map((o) => {
      const items = (o.items || [])
        .map((i) => `• <b>${i.qty}×</b> ${esc(i.productName || i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ''}`)
        .join('\n');
      return `☕ <b>${esc(o.invoiceNo)}</b> (${o.type} ${o.tableNo ? `Meja ${esc(o.tableNo)}` : ''})\n${items}\nStatus: <code>${o.status}</code>`;
    }).join('\n\n━━━━━━━━━━━━━━━━━━\n\n');

    return ctx.reply(
      `📋 <b>Antrean Pesanan Barista & Dapur (${queue.length} Pesanan):</b>\n━━━━━━━━━━━━━━━━━━\n\n${cards}\n\n━━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML' }
    );
  });

  // 2) Tombol Aksi: Proses & Siap
  bot.callbackQuery(/^ord:(prep|ready):(\d+)$/, async (ctx) => {
    const action = ctx.match[1];
    const orderId = Number(ctx.match[2]);

    // Handle perizinan: harus staf terdaftar dengan role yang sesuai
    if (!ctx.user || !['BARISTA', 'MANAGER', 'OWNER'].includes(ctx.user.role)) {
      return ctx.answerCallbackQuery({
        text: '⛔ Akses Ditolak: Anda belum terdaftar atau tidak memiliki hak akses barista/manager.',
        show_alert: true,
      });
    }

    const newStatus = action === 'prep' ? 'PREPARING' : 'READY';
    const res = await orderService.setStatus(orderId, newStatus, ctx.user?.id || null);

    if (!res.ok) {
      return ctx.answerCallbackQuery({ text: res.message, show_alert: true });
    }

    await ctx.answerCallbackQuery({
      text: newStatus === 'PREPARING' ? 'Pesanan sedang diracik...' : 'Pesanan siap disajikan!',
    });

    const staffName = ctx.user?.name || ctx.from?.first_name || 'Barista';

    if (newStatus === 'PREPARING') {
      const kb = new InlineKeyboard().text('✅ Tandai Siap Diantar', `ord:ready:${orderId}`);
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: kb });
      } catch {}
    } else {
      // READY
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(
          `✅ Pesanan <b>${esc(res.order.invoiceNo)}</b> telah diselesaikan oleh <b>${esc(staffName)}</b>.`,
          { parse_mode: 'HTML' }
        );
      } catch {}

      // Kabari kasir pembuat pesanan
      if (res.order.cashier?.telegramId) {
        await notifier.toUser(
          res.order.cashier.id,
          `☕ <b>Pesanan Siap!</b>\nPesanan <b>${esc(res.order.invoiceNo)}</b> ${res.order.tableNo ? `(Meja ${esc(res.order.tableNo)})` : ''} sudah siap di-pick up / disajikan ke pelanggan.`,
          { parse_mode: 'HTML' }
        );
      }
    }
  });
}
