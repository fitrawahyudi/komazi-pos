import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { userService } from '../../services/userService.js';
import { telegramLinkService } from '../../services/telegramLinkService.js';
import { workspaceService } from '../../services/workspace.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';

export function registerOwner(bot) {
  // 1) Ringkasan Realtime
  bot.command('ringkasan', requireRole('OWNER'), async (ctx) => {
    const [today, yesterday, activeWs] = await Promise.all([
      orderService.getSummary('today'),
      orderService.getSummary('yesterday'),
      workspaceService.getActiveSessions(),
    ]);

    const growth = yesterday.totalRevenue > 0
      ? (((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100).toFixed(1)
      : null;

    const growthText = growth !== null
      ? (Number(growth) >= 0 ? `(+${growth}%) 📈` : `(${growth}%) 📉`)
      : '-';

    const text = `
☕ <b>RINGKASAN EKSEKUTIF OWNER</b>
━━━━━━━━━━━━━━━━━━
<b>Omzet Hari Ini:</b> <b>${rupiah(today.totalRevenue)}</b> ${growthText}
<b>Omzet Kemarin:</b> ${rupiah(yesterday.totalRevenue)}

<b>Aktivitas Transaksi:</b>
• Transaksi Selesai: <b>${today.totalTransactions}</b>
• Tamu Workspace Aktif: <b>${activeWs.length}</b> sesi berjalan

<b>Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(today.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(today.byMethod.QRIS)}
• Transfer Bank: ${rupiah(today.byMethod.TRANSFER)}
━━━━━━━━━━━━━━━━━━
<i>Gunakan /laporan untuk melihat laporan per periode.</i>
    `.trim();

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 2) Laporan Berbagai Periode
  bot.command('laporan', requireRole('OWNER'), async (ctx) => {
    const kb = new InlineKeyboard()
      .text('Hari Ini', 'rep_per:today')
      .text('Kemarin', 'rep_per:yesterday')
      .row()
      .text('7 Hari Terakhir', 'rep_per:7d')
      .text('Bulan Ini', 'rep_per:month');

    return ctx.reply('📊 <b>Pilih Periode Laporan Penjualan:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^rep_per:(today|yesterday|7d|month)$/, requireRole('OWNER'), async (ctx) => {
    const period = ctx.match[1];
    await ctx.answerCallbackQuery();

    const summary = await orderService.getSummary(period);

    const periodLabels = {
      today: 'Hari Ini',
      yesterday: 'Kemarin',
      '7d': '7 Hari Terakhir',
      month: 'Bulan Ini',
    };

    const topLines = (summary.topProducts || [])
      .map((p, i) => `${i + 1}. ${esc(p.name)}: <b>${p.qty} item</b>`)
      .join('\n') || '-';

    const text = `
📊 <b>LAPORAN PENJUALAN (${periodLabels[period].toUpperCase()})</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Paling Diminati:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
    `.trim();

    return ctx.editMessageText(text, { parse_mode: 'HTML' });
  });

  // 3) Tautkan Akun Staf (Generate Link Code)
  bot.command('tautkan', requireRole('OWNER'), async (ctx) => {
    const unlinked = await userService.listUnlinked();

    if (!unlinked || unlinked.length === 0) {
      return ctx.reply('✨ Semua staf aktif sudah menautkan akun Telegram mereka.');
    }

    const kb = new InlineKeyboard();
    unlinked.forEach((u) => {
      kb.text(`${u.name} (${u.role})`, `link:${u.id}`).row();
    });

    return ctx.reply('🔗 <b>Pilih Staf untuk Ditautkan ke Telegram:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^link:(\d+)$/, requireRole('OWNER'), async (ctx) => {
    const staffId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
      const code = await telegramLinkService.generate(staffId);
      const staff = await userService.getById(staffId);

      await logBotAudit(ctx.user.id, 'GENERATE_LINK_CODE', { staffId, code });

      const ttlMin = process.env.BOT_LINK_CODE_TTL_MIN || '10';

      return ctx.reply(
        `✅ <b>Kode Tautan Staf Dibuat!</b>\n━━━━━━━━━━━━━━━━━━\nStaf: <b>${esc(staff?.name)}</b> (@${staff?.username} - ${staff?.role})\nKode: <code>${code}</code>\n<i>(Berlaku ${ttlMin} menit, satu kali pakai)</i>\n\nMinta staf membuka bot dan mengirim perintah:\n<code>/start ${code}</code>\n━━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return ctx.reply(`❌ Gagal membuat kode tautan: ${err.message}`);
    }
  });
}
