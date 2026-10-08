import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { approvalService } from '../../services/approval.service.js';
import { orderService } from '../../services/order.service.js';
import { rupiah, esc } from '../utils/format.js';
import prisma from '../../config/db.js';

export async function requestApproval(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  // 1) Pilih Jenis Persetujuan
  const kbType = new InlineKeyboard()
    .text('❌ Void / Batalkan Pesanan', 'apr_type:VOID_ORDER')
    .row()
    .text('🏷️ Diskon Khusus', 'apr_type:DISCOUNT')
    .row()
    .text('↩️ Pengembalian Dana (Refund)', 'apr_type:REFUND')
    .row()
    .text('Batal', 'apr_type:cancel');

  await ctx.reply('🔔 <b>Pengajuan Persetujuan Manager / Owner:</b>\nPilih jenis persetujuan:', {
    parse_mode: 'HTML',
    reply_markup: kbType,
  });

  const typeCtx = await conversation.waitForCallbackQuery(/^apr_type:(VOID_ORDER|DISCOUNT|REFUND|cancel)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.callbackQuery.data.split(':')[1];
  if (type === 'cancel') return ctx.reply('Pengajuan dibatalkan.');

  // 2) Tentukan Pesanan (Pilih dari daftar pesanan aktif atau ketik invoice)
  const openOrders = await conversation.external(() => orderService.listOpenBills());

  let targetOrder = null;
  if (openOrders && openOrders.length > 0) {
    const kbOrders = new InlineKeyboard();
    openOrders.slice(0, 8).forEach((o) => {
      kbOrders.text(`${o.invoiceNo} · ${rupiah(o.total)}`, `ord_select:${o.id}`).row();
    });
    kbOrders.text('🔍 Ketik Nomor Invoice Manual', 'ord_select:manual').row();
    kbOrders.text('Batal', 'ord_select:cancel');

    await ctx.reply('Pilih pesanan yang ingin diajukan persetujuan:', {
      reply_markup: kbOrders,
    });

    const ordCtx = await conversation.waitForCallbackQuery(/^ord_select:(.+)$/);
    await ordCtx.answerCallbackQuery();
    const sel = ordCtx.callbackQuery.data.split(':')[1];

    if (sel === 'cancel') return ctx.reply('Pengajuan dibatalkan.');
    if (sel !== 'manual') {
      const orderId = Number(sel);
      targetOrder = await conversation.external(() =>
        prisma.order.findUnique({ where: { id: orderId } })
      );
    }
  }

  if (!targetOrder) {
    await ctx.reply('Ketik nomor invoice pesanan (contoh: <code>KMZ-20261008-0001</code>):', {
      parse_mode: 'HTML',
    });
    const invMsg = await conversation.waitFor('message:text');
    const invoiceNo = invMsg.message.text.trim();
    targetOrder = await conversation.external(() =>
      prisma.order.findUnique({ where: { invoiceNo } })
    );

    if (!targetOrder) {
      return ctx.reply('❌ Pesanan dengan nomor invoice tersebut tidak ditemukan.');
    }
  }

  // 3) Parameter Tambahan (Jika Diskon)
  let payload = null;
  if (type === 'DISCOUNT') {
    await ctx.reply('Masukkan nominal potongan harga diskon (Rp):');
    const discMsg = await conversation.waitFor('message:text');
    const discountVal = parseFloat(discMsg.message.text.replace(/\D/g, ''));
    if (isNaN(discountVal) || discountVal <= 0) {
      return ctx.reply('Nominal diskon tidak valid.');
    }
    payload = { discount: discountVal };
  }

  // 4) Alasan Pengajuan
  await ctx.reply('Tuliskan alasan pengajuan persetujuan:');
  const reasonMsg = await conversation.waitFor('message:text');
  const reason = reasonMsg.message.text.trim();
  if (reason.length < 3) {
    return ctx.reply('Alasan terlalu pendek. Pengajuan dibatalkan.');
  }

  try {
    const reqRecord = await conversation.external(() =>
      approvalService.request({
        type,
        orderId: targetOrder.id,
        requesterId: user.id,
        reason,
        payload,
      })
    );

    await ctx.reply(
      `✅ <b>Permintaan Persetujuan #${reqRecord.id} Terkirim!</b>\n━━━━━━━━━━━━━━━━━━\nJenis: <b>${type}</b>\nPesanan: <b>${esc(targetOrder.invoiceNo)}</b> (${rupiah(targetOrder.total)})\nAlasan: <i>${esc(reason)}</i>\n━━━━━━━━━━━━━━━━━━\n<i>Kartu persetujuan telah otomatis disiarkan ke Telegram Manager & Owner.</i>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    await ctx.reply(`❌ Gagal mengajukan persetujuan: ${err.message}`);
  }
}
