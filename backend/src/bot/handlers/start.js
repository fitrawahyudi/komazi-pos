import { telegramLinkService } from '../../services/telegramLinkService.js';
import { setCommandsForUser } from '../commands.js';
import { mainMenu } from '../keyboards/index.js';
import { esc } from '../utils/format.js';

export function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const code = (ctx.match || '').trim();

    // Sudah tertaut dan tanpa kode baru -> tampilkan menu utama
    if (ctx.user && !code) {
      await setCommandsForUser(bot, ctx.from.id, ctx.user.role);
      return ctx.reply(
        `Halo, <b>${esc(ctx.user.name)}</b>! ☕\nPeran aktif Anda: <b>${ctx.user.role}</b>\n\nPilih menu di bawah ini:`,
        {
          parse_mode: 'HTML',
          reply_markup: mainMenu(ctx.user.role),
        }
      );
    }

    // Belum tertaut dan tanpa kode -> tampilkan alert proteksi
    if (!code) {
      return ctx.reply(
        `🔒 <b>AKSES TERBATAS — BOT INTERNAL KOMAZI POS</b>\n\nBot ini diproteksi ketat dan hanya dapat digunakan oleh staf outlet yang memiliki hak akses terdaftar.\n\nAkun Telegram Anda (ID: <code>${ctx.from.id}</code>) belum terhubung ke sistem POS.\n\nSilakan minta <b>Kode Tautan</b> kepada Owner outlet (atau buka menu Pengaturan di web POS), lalu kirimkan:\n<code>/start KODE_TAUTAN</code>`,
        { parse_mode: 'HTML' }
      );
    }

    // Proses penautikan kode
    const linkRes = await telegramLinkService.verifyAndLink(code, ctx.from.id, ctx.from.username);
    if (!linkRes.ok) {
      return ctx.reply(
        `⛔ <b>AKSES DITOLAK</b>\n${linkRes.message}`,
        { parse_mode: 'HTML' }
      );
    }

    const linkedUser = linkRes.user;
    await setCommandsForUser(bot, ctx.from.id, linkedUser.role);

    return ctx.reply(
      `🎉 <b>Penautikan Berhasil!</b>\nAkun Anda telah terhubung sebagai <b>${esc(linkedUser.name)}</b> (${linkedUser.role}).\n\nDaftar menu dan perintah cepat telah disesuaikan dengan peran Anda.`,
      {
        parse_mode: 'HTML',
        reply_markup: mainMenu(linkedUser.role),
      }
    );
  });

  bot.command('whoami', (ctx) => {
    if (!ctx.user) {
      return ctx.reply('Akun Telegram ini belum ditautkan ke POS Komazi.');
    }
    return ctx.reply(
      `👤 <b>Profil Staf POS</b>\nNama: <b>${esc(ctx.user.name)}</b>\nUsername: @${ctx.user.username}\nRole: <b>${ctx.user.role}</b>\nTelegram ID: <code>${ctx.from.id}</code>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.command('menu', (ctx) => {
    if (!ctx.user) {
      return ctx.reply('Akun belum tertaut. Silakan tautkan akun terlebih dahulu dengan <code>/start KODE</code>', { parse_mode: 'HTML' });
    }
    return ctx.reply('📋 <b>Menu Utama Komazi POS:</b>', {
      parse_mode: 'HTML',
      reply_markup: mainMenu(ctx.user.role),
    });
  });

  // Handler navigasi inline menu utama
  bot.callbackQuery(/^go:(\w+)$/, async (ctx) => {
    const feature = ctx.match[1];
    await ctx.answerCallbackQuery();

    if (!ctx.user) {
      return ctx.reply('Akun Anda belum tertaut.');
    }

    switch (feature) {
      case 'order':
        return ctx.conversation.enter('quickOrder');
      case 'orders':
        return ctx.reply('Gunakan perintah /pesanan untuk melihat daftar open bill.');
      case 'shift':
        return ctx.reply('Pilih aksi shift:\n• /buka_shift - Buka shift baru\n• /tutup_shift - Tutup shift kasir');
      case 'workspace':
        return ctx.reply('Pilih aksi workspace:\n• /workspace - Cek ketersediaan area\n• /checkin - Check-in tamu\n• /checkout - Hitung durasi & check-out');
      case 'queue':
        return ctx.reply('Gunakan perintah /antrean untuk melihat antrean pesanan.');
      case 'stock':
        return ctx.reply('Gunakan perintah /stok untuk cek persediaan menipis.');
      case 'approval':
        return ctx.reply('Gunakan perintah /approval untuk melihat permintaan persetujuan menunggu.');
      case 'soldout':
        return ctx.reply('Gunakan perintah /habis untuk menandai menu habis atau tersedia.');
      case 'report':
      case 'summary':
        return ctx.reply('Gunakan perintah /laporan atau /ringkasan untuk melihat omzet.');
      case 'link':
        return ctx.reply('Gunakan perintah /tautkan untuk membuat kode tautan staf baru.');
      default:
        return ctx.reply('Fitur siap digunakan.');
    }
  });
}
