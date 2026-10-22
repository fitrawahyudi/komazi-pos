import { getBotUser } from '../context.js';
import { parseReportDateInput } from '../utils/dateParser.js';
import { orderService } from '../../services/order.service.js';
import { sendSalesReportResponse } from '../utils/salesReportHelper.js';
import { withLoadingAnimation } from '../utils/loading.js';

export async function customReportConversation(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun Anda belum tertaut.');

  await ctx.reply(
    `📅 <b>Pilih Tanggal Laporan Penjualan</b>\n\n` +
    `Ketik tanggal atau rentang tanggal yang ingin diperiksa:\n\n` +
    `<b>Contoh format yang didukung:</b>\n` +
    `• Tanggal tunggal: <code>15-10-2026</code> atau <code>15/10/2026</code>\n` +
    `• Teks bulan: <code>15 Oktober 2026</code> atau <code>15 Okt</code>\n` +
    `• Tahun berjalan: <code>15-10</code> atau <code>15/10</code>\n` +
    `• Rentang tanggal: <code>10-10-2026 s/d 15-10-2026</code>\n` +
    `• Rentang teks: <code>10 - 15 Oktober 2026</code>\n\n` +
    `<i>Ketik /batal untuk membatalkan.</i>`,
    { parse_mode: 'HTML' }
  );

  let parsedRange = null;
  while (true) {
    const { message } = await conversation.waitFor('message:text');
    const text = (message.text || '').trim();

    if (text.toLowerCase() === '/batal' || text.toLowerCase() === 'batal') {
      return ctx.reply('❌ Pemilihan tanggal laporan dibatalkan.');
    }

    parsedRange = parseReportDateInput(text);
    if (parsedRange) {
      break;
    }

    await ctx.reply(
      `⚠️ <b>Format tanggal tidak dikenali.</b>\n\n` +
      `Pastikan format sesuai contoh berikut:\n` +
      `• Tanggal tunggal: <code>15-10-2026</code> atau <code>15 Oktober 2026</code>\n` +
      `• Rentang tanggal: <code>10-10-2026 s/d 15-10-2026</code>\n\n` +
      `Silakan ketik ulang, atau ketik <code>/batal</code> untuk keluar:`,
      { parse_mode: 'HTML' }
    );
  }

  await conversation.external(async () => {
    return withLoadingAnimation(ctx, { chatAction: 'upload_photo' }, async () => {
      const summary = await orderService.getSummary('custom', parsedRange);
      return sendSalesReportResponse(ctx, summary, parsedRange.label);
    });
  });
}
