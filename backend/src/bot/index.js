import { Bot } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { limit } from '@grammyjs/ratelimiter';

import { auth } from './middlewares/auth.js';
import { errorHandler } from './middlewares/error.js';

import { registerStart } from './handlers/start.js';
import { registerCashier } from './handlers/cashier.js';
import { registerBarista } from './handlers/barista.js';
import { registerManager } from './handlers/manager.js';
import { registerOwner } from './handlers/owner.js';

import { openShift } from './conversations/openShift.js';
import { closeShift } from './conversations/closeShift.js';
import { quickOrder } from './conversations/quickOrder.js';
import { checkinWorkspace } from './conversations/checkinWorkspace.js';
import { stockIn } from './conversations/stockIn.js';
import { requestApproval } from './conversations/requestApproval.js';

import { telegramLinkService } from '../services/telegramLinkService.js';
import { setCommandsForUser } from './commands.js';
import { mainMenu } from './keyboards/index.js';
import { esc } from './utils/format.js';

const token = process.env.TELEGRAM_BOT_TOKEN || '123456:placeholder_token_for_init';
export const bot = new Bot(token);

// 1) Infrastruktur
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 5 }));
bot.use(sequentialize((ctx) => ctx.chat?.id?.toString()));
bot.use(
  limit({
    timeFrame: 2000,
    limit: 6,
    onLimitExceeded: (ctx) => ctx.reply('Terlalu cepat, mohon tunggu beberapa detik.'),
  })
);

// 2) Autentikasi staf
bot.use(auth);

// 3) Perintah pembatalan didaftarkan sebelum conversation
bot.command('batal', async (ctx) => {
  try {
    await ctx.conversation.exitAll();
    await ctx.reply('Proses percakapan dibatalkan.');
  } catch {
    await ctx.reply('Tidak ada proses percakapan aktif yang berjalan.');
  }
});

// 4) Conversations v2
bot.use(conversations());
bot.use(createConversation(openShift, 'openShift'));
bot.use(createConversation(closeShift, 'closeShift'));
bot.use(createConversation(quickOrder, 'quickOrder'));
bot.use(createConversation(checkinWorkspace, 'checkinWorkspace'));
bot.use(createConversation(stockIn, 'stockIn'));
bot.use(createConversation(requestApproval, 'requestApproval'));

// 5) Handlers peran & fitur
registerStart(bot);
registerCashier(bot);
registerBarista(bot);
registerManager(bot);
registerOwner(bot);

// 6) Fallback untuk pesan/perintah yang tidak terdaftar atau unauthorized
bot.on('message', async (ctx) => {
  if (ctx.chat.type !== 'private') return;

  const text = (ctx.message?.text || '').trim();

  // Jika belum tertaut dan pengguna mengirimkan 8 karakter kode langsung
  if (!ctx.user && /^[a-fA-F0-9]{8}$/.test(text)) {
    const linkRes = await telegramLinkService.verifyAndLink(text, ctx.from.id, ctx.from.username);
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
  }

  // Jika bukan staf terdaftar, tolak dengan alert tegas
  if (!ctx.user) {
    return ctx.reply(
      `⛔ <b>AKSES DITOLAK (UNAUTHORIZED)</b>\n\nBot Komazi POS diproteksi ketat dan hanya dapat digunakan oleh staf outlet yang memiliki hak akses terdaftar.\n\n• ID Telegram Anda: <code>${ctx.from.id}</code>\n• Status: <b>Belum Ditautkan</b>\n\nHubungi <b>Owner</b> atau buka menu <b>Pengaturan POS Web</b> untuk mendapatkan Kode Tautan resmi, lalu kirim:\n<code>/start KODE_TAUTAN</code>`,
      { parse_mode: 'HTML' }
    );
  }

  return ctx.reply(
    `Perintah tidak dikenali. Ketik /menu untuk melihat daftar fitur sesuai peran Anda (<b>${ctx.user.role}</b>).`,
    { parse_mode: 'HTML' }
  );
});

// 7) Global error handling
bot.catch(errorHandler);

export async function initBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken.includes('placeholder')) {
    console.log('ℹ️ [Telegram Bot] TELEGRAM_BOT_TOKEN belum diset di .env. Bot Telegram ditangguhkan.');
    return;
  }

  try {
    if (process.env.NODE_ENV === 'production') {
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (webhookUrl) {
        await bot.init();
        await bot.api.setWebhook(webhookUrl, {
          secret_token: webhookSecret || undefined,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        });
        console.log(`📡 [Telegram Bot] Webhook aktif di ${webhookUrl}`);
      } else {
        console.warn('⚠️ [Telegram Bot] Mode production aktif namun TELEGRAM_WEBHOOK_URL tidak diset.');
      }
    } else {
      // Development mode: long-polling
      await bot.api.deleteWebhook().catch(() => {});
      bot.start({
        onStart: (me) => console.log(`🤖 [Telegram Bot] Aktif (Long Polling) sebagai @${me.username}`),
      }).catch((err) => {
        console.warn('⚠️ [Telegram Bot] Gagal memulai polling:', err.message);
      });
    }
  } catch (err) {
    console.warn('⚠️ [Telegram Bot] Inisialisasi bot gagal:', err.message);
  }
}
