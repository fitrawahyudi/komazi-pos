import { getBotUser } from '../context.js';
import { shiftService } from '../../services/shift.service.js';
import { rupiah } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';
import { checkStaffShiftEligibility } from '../../services/scheduleGuard.service.js';

export async function openShift(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun Anda belum tertaut.');

  const eligibility = await conversation.external(async () => {
    return checkStaffShiftEligibility(user.id, user.role);
  });
  if (!eligibility.eligible) {
    return ctx.reply(`⚠️ <b>Akses Ditolak</b>\n\n${eligibility.message}`, {
      parse_mode: 'HTML',
    });
  }

  const current = await conversation.external(async () => {
    const s = await shiftService.getCurrent(user.id);
    return s ? { id: s.id } : null;
  });
  if (current) {
    return ctx.reply('⚠️ Anda masih memiliki shift yang sedang aktif.');
  }

  await ctx.reply('💰 <b>Buka Shift Kasir</b>\nMasukkan modal kas awal (hanya angka, misal: <code>500000</code>):', {
    parse_mode: 'HTML',
  });

  let amount;
  while (true) {
    const { message } = await conversation.waitFor('message:text');
    amount = Number((message.text || '').replace(/\D/g, ''));
    if (amount >= 0 && message.text.trim().length > 0) break;
    await ctx.reply('Nominal tidak valid. Masukkan angka (misal: <code>500000</code>) atau ketik /batal:');
  }

  const shift = await conversation.external(async () => {
    const s = await shiftService.open(user.id, amount);
    return { id: s.id, openingCash: Number(s.openingCash) };
  });
  await conversation.external(() => logBotAudit(user.id, 'OPEN_SHIFT', { shiftId: shift.id, amount }));

  const caption = `✅ <b>Shift Kasir Berhasil Dibuka!</b>\nModal Kas Awal: <b>${rupiah(amount)}</b>\nKasir: ${user.name}`;

  await replyWithPhotoFallback(ctx, {
    imageBufferPromise: generateBotImage('shift_open', {
      cashierName: user.name,
      initialCash: amount,
      shiftId: shift.id,
    }),
    captionHtml: caption,
  });
}
