import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { workspaceService } from '../../services/workspace.service.js';
import { rupiah, esc } from '../utils/format.js';

export function registerCashier(bot) {
  // 1) Shift Kasir
  bot.command('buka_shift', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('openShift')
  );

  bot.command('tutup_shift', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('closeShift')
  );

  // 2) Pesanan Cepat
  bot.command('order', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('quickOrder')
  );

  // 3) Daftar Open Bill / Pesanan Aktif
  bot.command('pesanan', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const openOrders = await orderService.listOpenBills();

    if (!openOrders || openOrders.length === 0) {
      return ctx.reply('✨ Tidak ada pesanan berstatus Open Bill saat ini. Semua pesanan telah diselesaikan.');
    }

    const lines = openOrders
      .map(
        (o, i) =>
          `<b>${i + 1}. ${esc(o.invoiceNo)}</b>\n• Tipe: ${o.type} ${o.tableNo ? `(Meja ${esc(o.tableNo)})` : ''}\n• Total: <b>${rupiah(o.total)}</b> (${o.items?.length || 0} item)\n• Status: <code>${o.status}</code>`
      )
      .join('\n\n');

    return ctx.reply(
      `📋 <b>Daftar Pesanan Belum Lunas (Open Bill):</b>\n━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━\n<i>Gunakan layar kasir web untuk memproses pelunasan tunai/QRIS.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // 4) Area Workspace & Timer
  bot.command('workspace', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const areas = await workspaceService.listAllAreasWithStatus();

    if (!areas || areas.length === 0) {
      return ctx.reply('Belum ada area workspace yang terkonfigurasi.');
    }

    const lines = areas.map((a) => {
      const activeSession = a.sessions && a.sessions[0];
      if (!activeSession) {
        return `🟢 <b>${esc(a.name)}</b>: Tersedia (Kapasitas: ${a.capacity})`;
      }

      const elapsed = Math.max(1, Math.round((Date.now() - new Date(activeSession.checkInAt).getTime()) / 60000));
      const dur = activeSession.package?.durationMin || 60;
      const rem = dur - elapsed;

      const timerStatus = rem > 0
        ? `🔴 Terisi (${esc(activeSession.customerName)} — Sisa ${rem} mnt)`
        : `🟡 Overtime (+${Math.abs(rem)} mnt)`;

      return `🔴 <b>${esc(a.name)}</b>: ${timerStatus}`;
    }).join('\n');

    const kb = new InlineKeyboard()
      .text('➕ Check-in Tamu', 'go:checkin_ws')
      .text('⏹️ Check-out Tamu', 'go:checkout_ws');

    return ctx.reply(
      `💻 <b>Status Area Workspace Komazi:</b>\n━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  bot.command('checkin', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('checkinWorkspace')
  );

  bot.callbackQuery('go:checkin_ws', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    await ctx.answerCallbackQuery();
    return ctx.conversation.enter('checkinWorkspace');
  });

  // 5) Check-out Workspace
  bot.command('checkout', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const activeSessions = await workspaceService.getActiveSessions();

    if (!activeSessions || activeSessions.length === 0) {
      return ctx.reply('✨ Tidak ada tamu workspace yang sedang aktif saat ini.');
    }

    const kb = new InlineKeyboard();
    activeSessions.forEach((s) => {
      const statusLabel = s.isOvertime ? `Overtime +${Math.abs(s.remainingMinutes)}m` : `Sisa ${s.remainingMinutes}m`;
      kb.text(`Check-out ${s.area?.name} (${s.customerName} - ${statusLabel})`, `wsco:${s.id}`).row();
    });
    kb.text('❌ Batal', 'wsco:cancel');

    return ctx.reply('Pilih sesi tamu yang akan di-checkout:', { reply_markup: kb });
  });

  bot.callbackQuery('go:checkout_ws', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    await ctx.answerCallbackQuery();
    const activeSessions = await workspaceService.getActiveSessions();

    if (!activeSessions || activeSessions.length === 0) {
      return ctx.reply('✨ Tidak ada tamu workspace yang sedang aktif saat ini.');
    }

    const kb = new InlineKeyboard();
    activeSessions.forEach((s) => {
      const statusLabel = s.isOvertime ? `Overtime +${Math.abs(s.remainingMinutes)}m` : `Sisa ${s.remainingMinutes}m`;
      kb.text(`Check-out ${s.area?.name} (${s.customerName} - ${statusLabel})`, `wsco:${s.id}`).row();
    });
    kb.text('❌ Batal', 'wsco:cancel');

    return ctx.reply('Pilih sesi tamu yang akan di-checkout:', { reply_markup: kb });
  });

  bot.callbackQuery(/^wsco:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const sessionId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
      const res = await workspaceService.checkOut(sessionId);
      await ctx.editMessageText(
        `✅ <b>Check-out Workspace Selesai!</b>\n━━━━━━━━━━━━━━━━━━\nArea: <b>${esc(res.area?.name)}</b>\nPelanggan: <b>${esc(res.customerName)}</b>\nDurasi Aktual: ${res.elapsedMinutes} Menit\nTarif Dasar: ${rupiah(res.baseCharge)}\n${res.overtimeCharge > 0 ? `Biaya Overtime: ${rupiah(res.overtimeCharge)}\n` : ''}<b>TOTAL TAGIHAN: ${rupiah(res.totalCharge)}</b>\n━━━━━━━━━━━━━━━━━━\n<i>Tagihan dapat dibayar terpisah atau digabung ke struk F&B di POS kasir.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      await ctx.reply(`❌ Gagal check-out: ${err.message}`);
    }
  });

  bot.callbackQuery('wsco:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Dibatalkan' });
    await ctx.deleteMessage().catch(() => {});
  });

  // 6) Permintaan Approval oleh Kasir
  bot.command('approval', requireRole('CASHIER'), (ctx) =>
    ctx.conversation.enter('requestApproval')
  );
}
