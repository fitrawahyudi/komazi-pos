import { telegramLinkService } from '../../services/telegramLinkService.js';
import { setCommandsForUser } from '../commands.js';
import { mainMenu } from '../keyboards/index.js';
import { esc } from '../utils/format.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';
import { getBotStatusData } from '../../services/botStatusService.js';
import { withLoadingAnimation } from '../utils/loading.js';
import { InlineKeyboard } from 'grammy';
import { renderJobsList } from './jobs.js';

/**
 * Format teks informasi status bot yang komprehensif, rapi, dan sesuai PUEBI.
 */
export function formatBotInfoCaption(data, callerName, callerRole, telegramId) {
  return `
🤖 <b>STATUS & PERFORMA ASISTEN KOMAZI</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 <b>Status:</b> ONLINE • ⏱ <b>Uptime:</b> <b>${esc(data.bot.uptime)}</b>
⚡ <b>Mode:</b> ${esc(data.bot.mode)} • <b>Node:</b> ${esc(data.bot.nodeVersion)}
🧠 <b>RAM:</b> ${esc(data.bot.memory.heapUsed)} / RSS ${esc(data.bot.memory.rss)}

🗄️ <b>Database MySQL & Prisma</b>
• Status: <b>${data.database.status === 'CONNECTED' ? '🟢 Terhubung' : '🔴 Gangguan'}</b> (${esc(data.database.latency)})
• Model Entitas: <b>${data.database.modelsCount} Model</b>

👥 <b>Statistik Akun Staf</b>
• Tertaut: <b>${data.staff.linked} dari ${data.staff.total} Staf</b>
• Peran: Owner (${data.staff.roles.OWNER.linked}/${data.staff.roles.OWNER.total}) • Mgr (${data.staff.roles.MANAGER.linked}/${data.staff.roles.MANAGER.total}) • Kasir (${data.staff.roles.CASHIER.linked}/${data.staff.roles.CASHIER.total}) • Barista (${data.staff.roles.BARISTA.linked}/${data.staff.roles.BARISTA.total}) • Dapur (${data.staff.roles.KITCHEN.linked}/${data.staff.roles.KITCHEN.total})

☕ <b>Operasional Outlet</b>
• Shift Kasir: <b>${data.operations.openShifts} Sesi</b> • Pesanan: <b>${data.operations.orders}</b>
• Menu: <b>${data.operations.products}</b> • Bahan: <b>${data.operations.ingredients}</b> (Kritis: <b>${data.operations.lowStock}</b>)
• Coworking: <b>${data.operations.activeWorkspaces} Sesi Aktif</b>

🔔 <b>Otomasi & Scheduler</b>
• Notif Transaksi: ${data.notifications.transaction ? 'Aktif ✅' : 'Nonaktif ❌'} • Stok Menipis: ${data.notifications.lowStock ? 'Aktif ✅' : 'Nonaktif ❌'}
• Tutup Buku (22:00 WIB): ${data.notifications.dailySummary ? 'Aktif ✅' : 'Nonaktif ❌'}
• AI Scheduler: Morning & Evening Brief ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <i>Diakses oleh: <b>${esc(callerName)}</b> (${esc(callerRole)}) • ID: <code>${telegramId}</code></i>
  `.trim();
}

/**
 * Keyboard interaktif untuk kartu status bot
 */
export function botInfoKeyboard(role) {
  const kb = new InlineKeyboard()
    .text('🔄 Segarkan Status', 'bot:refresh_info');
  if (role) {
    kb.text('📋 Menu Utama', 'go:menu');
  } else {
    kb.text('ℹ️ Info Akun', 'go:whoami');
  }
  return kb;
}

/**
 * Handler utama untuk menampilkan informasi status bot dengan animasi loading
 */
async function handleBotInfo(ctx) {
  return withLoadingAnimation(
    ctx,
    {
      chatAction: 'upload_photo',
      frames: [
        '⏳ <b>Memeriksa status operasional bot Komazi...</b>',
        '🔍 <b>Menguji konektivitas & latensi database MySQL...</b>',
        '📊 <b>Mengkalkulasi metrik staf, memori, dan antrean...</b>',
        '🎨 <b>Merender kartu status performa sistem...</b>',
      ],
    },
    async () => {
      const data = await getBotStatusData();
      const callerName = ctx.user ? ctx.user.name : (ctx.from?.first_name || 'Tamu');
      const callerRole = ctx.user ? ctx.user.role : 'Belum Ditautkan';

      const caption = formatBotInfoCaption(data, callerName, callerRole, ctx.from?.id);
      const keyboard = botInfoKeyboard(ctx.user?.role);

      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('bot_info', data),
        captionHtml: caption,
        replyMarkup: keyboard,
      });
    }
  );
}

export function registerStart(bot) {
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const code = (ctx.match || '').trim();

    // 1. Sudah tertaut dan tanpa kode baru -> tampilkan kartu welcome hero & menu utama
    if (ctx.user && !code) {
      await setCommandsForUser(bot, ctx.from.id, ctx.user.role);
      const caption = `Halo, <b>${esc(ctx.user.name)}</b>! ☕\nPeran aktif Anda: <b>${ctx.user.role}</b>\n\nPilih menu operasional di bawah ini:`;
      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('welcome', { user: ctx.user, telegramId: ctx.from.id }),
        captionHtml: caption,
        replyMarkup: mainMenu(ctx.user.role),
      });
    }

    // 2. Belum tertaut dan tanpa kode -> tampilkan kartu proteksi visual
    if (!code) {
      const caption = `🔒 <b>AKSES TERBATAS — BOT INTERNAL KOMAZI POS</b>\n\nBot ini diproteksi ketat dan hanya dapat digunakan oleh staf outlet yang memiliki hak akses terdaftar.\n\n• ID Telegram Anda: <code>${ctx.from.id}</code>\n• Status: <b>Belum Ditautkan</b>\n\nSilakan minta <b>Kode Tautan</b> kepada Owner outlet (atau buka menu Pengaturan di web POS), lalu kirimkan:\n<code>/start KODE_TAUTAN</code>`;
      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('welcome', { user: null, telegramId: ctx.from.id }),
        captionHtml: caption,
      });
    }

    // 3. Proses penautikan kode
    const linkRes = await telegramLinkService.verifyAndLink(code, ctx.from.id, ctx.from.username);
    if (!linkRes.ok) {
      return ctx.reply(
        `⛔ <b>AKSES DITOLAK</b>\n${linkRes.message}`,
        { parse_mode: 'HTML' }
      );
    }

    const linkedUser = linkRes.user;
    await setCommandsForUser(bot, ctx.from.id, linkedUser.role);

    const successCaption = `🎉 <b>Penautikan Berhasil!</b>\nAkun Anda telah terhubung sebagai <b>${esc(linkedUser.name)}</b> (${linkedUser.role}).\n\nDaftar menu dan perintah cepat telah disesuaikan dengan peran Anda.`;
    return replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('welcome', { user: linkedUser, telegramId: ctx.from.id }),
      captionHtml: successCaption,
      replyMarkup: mainMenu(linkedUser.role),
    });
  });

  // Profil Staf (/whoami)
  bot.command('whoami', (ctx) => {
    if (!ctx.user) {
      return ctx.reply('Akun Telegram ini belum ditautkan ke POS Komazi.');
    }
    const caption = `👤 <b>Profil Staf POS</b>\nNama: <b>${esc(ctx.user.name)}</b>\nUsername: @${ctx.user.username}\nRole: <b>${ctx.user.role}</b>\nTelegram ID: <code>${ctx.from.id}</code>`;
    return replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('whoami', { user: ctx.user, telegramId: ctx.from.id }),
      captionHtml: caption,
    });
  });

  // Menu Utama (/menu)
  bot.command('menu', (ctx) => {
    if (!ctx.user) {
      return ctx.reply('Akun belum tertaut. Silakan tautkan akun terlebih dahulu dengan <code>/start KODE</code>', { parse_mode: 'HTML' });
    }
    const caption = `📋 <b>Menu Utama Komazi POS (${ctx.user.role}):</b>\nPilih fitur operasional outlet melalui tombol navigasi di bawah ini:`;
    return replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('menu', { role: ctx.user.role }),
      captionHtml: caption,
      replyMarkup: mainMenu(ctx.user.role),
    });
  });

  // Status Bot (/infobot) - Dapat diakses oleh semua role
  bot.command('infobot', async (ctx) => {
    return handleBotInfo(ctx);
  });

  // Callback segarkan status bot
  bot.callbackQuery('bot:refresh_info', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Memperbarui status sistem bot...' }).catch(() => {});
    return handleBotInfo(ctx);
  });

  // Handler navigasi inline menu utama
  bot.callbackQuery(/^go:(\w+)$/, async (ctx) => {
    const feature = ctx.match[1];
    await ctx.answerCallbackQuery().catch(() => {});

    // infobot dan whoami bisa diakses meski belum tertaut
    if (feature === 'infobot') {
      return handleBotInfo(ctx);
    }

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
        return ctx.reply('Gunakan perintah /stok untuk cek persediaan stok bahan baku.');
      case 'stock_in':
        await ctx.conversation.exitAll().catch(() => {});
        return ctx.conversation.enter('stockIn');
      case 'approval':
        return ctx.reply('Gunakan perintah /approval untuk melihat permintaan persetujuan menunggu.');
      case 'soldout':
        return ctx.reply('Gunakan perintah /habis untuk menandai menu habis atau tersedia.');
      case 'report':
      case 'summary':
        return ctx.reply('Gunakan perintah /laporan atau /ringkasan untuk melihat omzet.');
      case 'link':
        return ctx.reply('Gunakan perintah /tautkan untuk membuat kode tautan staf baru.');
      case 'jobs':
        return renderJobsList(ctx, 1);
      case 'menu':
        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('menu', { role: ctx.user.role }),
          captionHtml: `📋 <b>Menu Utama Komazi POS (${ctx.user.role}):</b>\nPilih fitur operasional outlet melalui tombol navigasi di bawah ini:`,
          replyMarkup: mainMenu(ctx.user.role),
        });
      default:
        return ctx.reply('Fitur siap digunakan.');
    }
  });
}
