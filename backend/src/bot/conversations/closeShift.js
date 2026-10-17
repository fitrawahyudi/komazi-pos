import { getBotUser } from '../context.js';
import { shiftService } from '../../services/shift.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';
import { events } from '../events.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';

export async function closeShift(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun Anda belum tertaut.');

  const current = await conversation.external(async () => {
    const s = await shiftService.getCurrent(user.id);
    if (!s) return null;
    let cashSales = 0;
    let qrisSales = 0;
    let transferSales = 0;
    for (const order of s.orders || []) {
      if (order.status === 'PAID') {
        for (const p of order.payments || []) {
          if (p.method === 'CASH') cashSales += Number(p.amount);
          else if (p.method === 'QRIS') qrisSales += Number(p.amount);
          else if (p.method === 'TRANSFER') transferSales += Number(p.amount);
        }
      }
    }
    return {
      id: s.id,
      openingCash: Number(s.openingCash),
      cashSales,
      qrisSales,
      transferSales,
      ordersCount: (s.orders || []).filter(o => o.status === 'PAID').length,
    };
  });

  if (!current) {
    return ctx.reply('⚠️ Anda tidak memiliki shift aktif saat ini.');
  }

  const openingCash = current.openingCash;
  const cashSales = current.cashSales;
  const expectedCash = openingCash + cashSales;

  await ctx.reply(
    `🔒 <b>Tutup Shift Kasir</b>\nModal Awal: ${rupiah(openingCash)}\nPenjualan Tunai: ${rupiah(cashSales)}\nEstimasi Kas Laci Seharusnya: <b>${rupiah(expectedCash)}</b>\n\nMasukkan total uang kas aktual fisik di laci kasir saat ini:`,
    { parse_mode: 'HTML' }
  );

  let actualAmount;
  while (true) {
    const { message } = await conversation.waitFor('message:text');
    actualAmount = Number((message.text || '').replace(/\D/g, ''));
    if (actualAmount >= 0 && message.text.trim().length > 0) break;
    await ctx.reply('Nominal tidak valid. Masukkan angka (misal: <code>750000</code>) atau ketik /batal:');
  }

  await ctx.reply('Masukkan catatan shift (atau ketik <code>-</code> jika tidak ada):', { parse_mode: 'HTML' });
  const noteMsg = await conversation.waitFor('message:text');
  const notes = noteMsg.message.text.trim() === '-' ? null : noteMsg.message.text.trim();

  try {
    const summary = await conversation.external(async () => {
      const res = await shiftService.close(user.id, actualAmount, notes);
      return {
        openingCash: Number(res.openingCash),
        closingCash: Number(res.closingCash),
        expectedCash: Number(res.expectedCash),
        cashSales: Number(res.cashSales),
        nonCashSales: Number(res.nonCashSales),
        diff: Number(res.diff),
      };
    });

    await conversation.external(() => logBotAudit(user.id, 'CLOSE_SHIFT', { shiftId: current.id, actualAmount, diff: summary.diff }));

    // Emit event shift closed for notifier
    events.emit('shift.closed', {
      cashier: user,
      summary,
    });

    const diffText = summary.diff === 0
      ? '🟢 Kas Sesuai (Imbang)'
      : summary.diff > 0
      ? `🟡 Lebih: +${rupiah(summary.diff)}`
      : `🔴 Selisih Kurang: ${rupiah(summary.diff)}`;

    const caption = `✅ <b>Shift Kasir Berhasil Ditutup (Z-Report)!</b>\n━━━━━━━━━━━━━━━━━━\nKasir: ${esc(user.name)}\nModal Awal: ${rupiah(summary.openingCash)}\nTotal Kas Aktual: <b>${rupiah(summary.closingCash)}</b>\nKas Seharusnya: ${rupiah(summary.expectedCash)}\nStatus: <b>${diffText}</b>\n${notes ? `Catatan: <i>${esc(notes)}</i>\n` : ''}━━━━━━━━━━━━━━━━━━`;

    await replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('shift_closed', {
        cashierName: user.name,
        initialCash: summary.openingCash,
        closingCash: summary.closingCash,
        expectedCash: summary.expectedCash,
        cashSales: summary.cashSales,
        qrisSales: current.qrisSales || summary.nonCashSales,
        transferSales: current.transferSales || 0,
        totalSales: summary.cashSales + summary.nonCashSales,
        diff: summary.diff,
        notes: notes || 'Shift ditutup seimbang.',
        shiftId: current.id,
      }),
      captionHtml: caption,
    });
  } catch (err) {
    await ctx.reply(`❌ Gagal menutup shift: ${err.message}`);
  }
}
