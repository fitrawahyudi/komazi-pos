import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { notifier } from '../notifier.js';
import { rupiah, esc } from '../utils/format.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback, sendPhotoWithFallback } from '../utils/sendVisual.js';
import { withLoadingAnimation } from '../utils/loading.js';

export function registerBarista(bot) {
  // 1) Lihat antrean pesanan sesuai role staf (Dengan Animasi Loading Kontekstual)
  bot.command(['antrean', 'antrian'], requireRole('BARISTA', 'KITCHEN', 'MANAGER', 'OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      {
        chatAction: 'upload_photo',
        frames: [
          '🔍 <b>Memindai tiket pesanan aktif stasiun...</b>',
          '☕ <b>Menyortir urutan antrean racikan...</b>',
          '🎨 <b>Menyiapkan papan antrean visual...</b>',
        ],
      },
      async () => {
        const userRole = (ctx.user?.role || 'BARISTA').toUpperCase();
        const queue = await orderService.listQueue(userRole);

        let emptyMessage = '✨ <b>Antrean Bersih!</b>\nTidak ada pesanan yang sedang menunggu racikan saat ini.';
        let roleTitle = '📋 Antrean Pesanan';
        let cardBadge = 'KDS QUEUE DASHBOARD';
        let cardBadgeColor = 'badge-amber';
        let cardTitle = 'Status Antrean Pesanan';
        let cardSubtitle = 'Pemantauan live antrean pesanan Komazi POS';

        if (userRole === 'BARISTA') {
          emptyMessage = '✨ <b>Antrean Bar Bersih!</b>\nTidak ada pesanan minuman yang sedang menunggu racikan barista saat ini.';
          roleTitle = `☕ <b>Antrean Bar Minuman (Barista - ${queue.length} Pesanan):</b>`;
          cardBadge = 'BDS BARISTA QUEUE';
          cardBadgeColor = 'badge-amber';
          cardTitle = 'Status Antrean Bar Minuman (Barista)';
          cardSubtitle = 'Live pemantauan antrean pesanan racikan bar & kopi';
        } else if (userRole === 'KITCHEN') {
          emptyMessage = '✨ <b>Antrean Dapur Bersih!</b>\nTidak ada pesanan makanan yang sedang menunggu persiapan dapur saat ini.';
          roleTitle = `🥐 <b>Antrean Dapur Makanan (Kitchen - ${queue.length} Pesanan):</b>`;
          cardBadge = 'KDS KITCHEN QUEUE';
          cardBadgeColor = 'badge-coral';
          cardTitle = 'Status Antrean Dapur Makanan (Kitchen)';
          cardSubtitle = 'Live pemantauan antrean pesanan dapur & pastry';
        } else {
          emptyMessage = '✨ <b>Antrean Kedai Bersih!</b>\nTidak ada pesanan aktif yang menunggu di bar maupun dapur saat ini.';
          roleTitle = `📋 <b>Antrean Pesanan Keseluruhan (Bar & Dapur - ${queue.length} Pesanan):</b>`;
          cardBadge = 'KDS/BDS MASTER QUEUE';
          cardBadgeColor = 'badge-amber';
          cardTitle = 'Status Antrean Barista & Dapur';
          cardSubtitle = 'Live pemantauan seluruh antrean minuman & makanan Komazi POS';
        }

        if (!queue || queue.length === 0) {
          return ctx.reply(emptyMessage, {
            parse_mode: 'HTML',
          });
        }

        const cards = queue.map((o) => {
          const items = (o.items || [])
            .map((i) => `• <b>${i.qty}×</b> ${esc(i.productName || i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ''}`)
            .join('\n');
          const icon = userRole === 'KITCHEN' ? '🥐' : '☕';
          return `${icon} <b>${esc(o.invoiceNo)}</b> (${o.type} ${o.tableNo ? `Meja ${esc(o.tableNo)}` : ''})\n${items}\nStatus: <code>${o.status}</code>`;
        }).join('\n\n━━━━━━━━━━━━━━━━━━\n\n');

        const caption = `${roleTitle}\n━━━━━━━━━━━━━━━━━━\n\n${cards}\n\n━━━━━━━━━━━━━━━━━━`;

        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('queue_dashboard', {
            queue,
            badgeText: cardBadge,
            badgeColor: cardBadgeColor,
            title: cardTitle,
            subtitle: cardSubtitle,
          }),
          captionHtml: caption,
        });
      }
    );
  });

  // 2) Tombol Aksi: Proses & Siap
  bot.callbackQuery(/^ord:(prep|ready):(\d+)$/, async (ctx) => {
    const action = ctx.match[1];
    const orderId = Number(ctx.match[2]);

    // Handle perizinan: harus staf terdaftar dengan role yang sesuai
    if (!ctx.user || !['BARISTA', 'KITCHEN', 'MANAGER', 'OWNER'].includes(ctx.user.role)) {
      return ctx.answerCallbackQuery({
        text: '⛔ Akses Ditolak: Anda belum terdaftar atau tidak memiliki hak akses barista/kitchen/manager.',
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

    const staffName = ctx.user?.name || ctx.from?.first_name || 'Staf';

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

      // Kabari kasir pembuat pesanan dengan kartu visual OrderReady
      if (res.order.cashier?.telegramId) {
        const readyCaption = `☕ <b>Pesanan Siap!</b>\nPesanan <b>${esc(res.order.invoiceNo)}</b> ${res.order.tableNo ? `(Meja ${esc(res.order.tableNo)})` : ''} sudah siap di-pick up / disajikan ke pelanggan.`;
        await sendPhotoWithFallback({
          chatId: res.order.cashier.telegramId,
          imageBufferPromise: generateBotImage('order_ready', {
            invoiceNo: res.order.invoiceNo,
            tableNo: res.order.tableNo,
            customerName: res.order.customerName || 'Pelanggan',
            baristaName: staffName,
          }),
          captionHtml: readyCaption,
        });
      }
    }
  });
}
