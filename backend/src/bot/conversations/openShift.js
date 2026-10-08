import { getBotUser } from '../context.js';
import { shiftService } from '../../services/shift.service.js';
import { rupiah } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';

export async function openShift(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun Anda belum tertaut.');

  const current = await conversation.external(() => shiftService.getCurrent(user.id));
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

  const shift = await conversation.external(() => shiftService.open(user.id, amount));
  await conversation.external(() => logBotAudit(user.id, 'OPEN_SHIFT', { shiftId: shift.id, amount }));

  await ctx.reply(`✅ <b>Shift Kasir Berhasil Dibuka!</b>\nModal Kas Awal: <b>${rupiah(amount)}</b>\nKasir: ${user.name}`, {
    parse_mode: 'HTML',
  });
}
