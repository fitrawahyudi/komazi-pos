import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { approvalService } from '../../services/approval.service.js';
import { stockService } from '../../services/stock.service.js';
import { menuService } from '../../services/menu.service.js';
import { orderService } from '../../services/order.service.js';
import { notifier } from '../notifier.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';

export function registerManager(bot) {
  // 1) Daftar Approval & Keputusan
  bot.command('approval', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const list = await approvalService.listPending();

    if (!list || list.length === 0) {
      return ctx.reply('✨ Tidak ada permintaan persetujuan (approval) yang sedang menunggu.');
    }

    for (const req of list) {
      const kb = new InlineKeyboard()
        .text('✅ Setujui', `apr:ok:${req.id}`)
        .text('❌ Tolak', `apr:no:${req.id}`);

      await ctx.reply(
        `🔔 <b>Permintaan Persetujuan #${req.id}</b>\n━━━━━━━━━━━━━━━━━━\nJenis: <b>${req.type}</b>\nDiajukan Oleh: ${esc(req.requester?.name || 'Kasir')}\nAlasan: <i>${esc(req.reason)}</i>\n━━━━━━━━━━━━━━━━━━`,
        {
          parse_mode: 'HTML',
          reply_markup: kb,
        }
      );
    }
  });

  bot.callbackQuery(/^apr:(ok|no):(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const decision = ctx.match[1] === 'ok';
    const reqId = Number(ctx.match[2]);

    const result = await approvalService.decide({
      id: reqId,
      deciderId: ctx.user.id,
      approve: decision,
    });

    if (!result.ok) {
      return ctx.answerCallbackQuery({ text: result.message, show_alert: true });
    }

    await ctx.answerCallbackQuery({ text: decision ? 'Disetujui' : 'Ditolak' });

    await logBotAudit(ctx.user.id, 'DECIDE_APPROVAL', {
      requestId: reqId,
      approved: decision,
    });

    const statusText = decision ? '✅ Disetujui' : '❌ Ditolak';
    await ctx.editMessageText(
      `🔔 <b>Permintaan Persetujuan #${reqId}</b>\n━━━━━━━━━━━━━━━━━━\nStatus: <b>${statusText}</b> oleh <b>${esc(ctx.user.name)}</b> (${ctx.user.role})\n━━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML' }
    );

    // Kirim notifikasi ke kasir yang meminta
    if (result.request.requesterId) {
      await notifier.toUser(
        result.request.requesterId,
        `🔔 Permintaan persetujuan #${reqId} (${result.request.type}) telah <b>${decision ? 'DISETUJUI ✅' : 'DITOLAK ❌'}</b> oleh ${esc(ctx.user.name)}.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // 2) Cek Stok Bahan
  bot.command('stok', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const all = await stockService.listAll();

    if (!all || all.length === 0) {
      return ctx.reply('Belum ada data stok bahan baku.');
    }

    const lines = all.map((item) => {
      const cur = parseFloat(item.stock);
      const min = parseFloat(item.minStock);
      const isLow = cur <= min;
      const icon = isLow ? '⚠️' : '🟢';
      return `${icon} <b>${esc(item.name)}</b>: ${cur} ${item.unit} ${isLow ? `<i>(Min: ${min})</i>` : ''}`;
    }).join('\n');

    return ctx.reply(
      `📦 <b>Laporan Stok Inventaris Bahan Baku:</b>\n━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━\n<i>Gunakan /stok_masuk untuk mencatat penerimaan barang.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // 3) Catat Stok Masuk
  bot.command('stok_masuk', requireRole('MANAGER', 'OWNER'), (ctx) =>
    ctx.conversation.enter('stockIn')
  );

  // 4) Toggle Menu Habis / Tersedia
  bot.command('habis', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const products = await menuService.listAllForToggle();

    if (!products || products.length === 0) {
      return ctx.reply('Belum ada menu produk terdaftar.');
    }

    const kb = new InlineKeyboard();
    products.slice(0, 15).forEach((p) => {
      const icon = p.isSoldOut ? '🚫 [Habis]' : '🟢 [Tersedia]';
      kb.text(`${icon} ${p.name}`, `toggle_sold:${p.id}`).row();
    });

    return ctx.reply(
      '🍽️ <b>Pengaturan Ketersediaan Menu (Sold Out Toggle):</b>\nKlik salah satu menu untuk mengubah status:',
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  bot.callbackQuery(/^toggle_sold:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const productId = Number(ctx.match[1]);
    try {
      const updated = await menuService.toggleSoldOut(productId);
      await ctx.answerCallbackQuery({
        text: `${updated.name} kini ${updated.isSoldOut ? 'HABIS (Sold Out)' : 'TERSEDIA'}`,
      });

      // Refresh list
      const products = await menuService.listAllForToggle();
      const kb = new InlineKeyboard();
      products.slice(0, 15).forEach((p) => {
        const icon = p.isSoldOut ? '🚫 [Habis]' : '🟢 [Tersedia]';
        kb.text(`${icon} ${p.name}`, `toggle_sold:${p.id}`).row();
      });

      await ctx.editMessageReplyMarkup({ reply_markup: kb });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: err.message, show_alert: true });
    }
  });

  // 5) Laporan Hari Ini
  bot.command('laporan', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const summary = await orderService.getSummary('today');

    const topLines = (summary.topProducts || [])
      .map((p, i) => `${i + 1}. ${esc(p.name)}: <b>${p.qty} terjual</b>`)
      .join('\n') || '-';

    const text = `
📊 <b>LAPORAN PENJUALAN HARI INI</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Rincian Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Paling Laris:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
<i>Data realtime POS Komazi Coffee & Workspace</i>
    `.trim();

    return ctx.reply(text, { parse_mode: 'HTML' });
  });
}
