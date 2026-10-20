import './utils/clonePatch.js';
import { Bot } from 'grammy';
import { conversations, createConversation, Conversation } from '@grammyjs/conversations';
import { sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { limit } from '@grammyjs/ratelimiter';

// Patch Conversation.prototype.external to prevent DOMException [DataCloneError]
// when structuredClone encounters Prisma.Decimal, Dates, or non-cloneable prototypes.
if (Conversation && Conversation.prototype && Conversation.prototype.external) {
  const origExternal = Conversation.prototype.external;
  const sanitizeForClone = (val) => {
    if (val === undefined || val === null) return val;
    try {
      return JSON.parse(
        JSON.stringify(val, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (typeof value.toNumber === 'function') return value.toNumber();
            if (value.constructor?.name === 'Decimal') return Number(value);
          }
          if (typeof value === 'function') return undefined;
          return value;
        })
      );
    } catch {
      return val;
    }
  };

  Conversation.prototype.external = function (op) {
    if (typeof op === 'function') {
      return origExternal.call(this, {
        task: op,
        beforeStore: (x) => sanitizeForClone(x),
      });
    } else if (op && typeof op === 'object') {
      const origBeforeStore = op.beforeStore || ((x) => x);
      return origExternal.call(this, {
        ...op,
        beforeStore: async (x) => sanitizeForClone(await origBeforeStore(x)),
      });
    }
    return origExternal.call(this, op);
  };
}

import { auth } from './middlewares/auth.js';
import { errorHandler } from './middlewares/error.js';
import logger from '../utils/logger.js';

import { registerStart } from './handlers/start.js';
import { registerCashier } from './handlers/cashier.js';
import { registerBarista } from './handlers/barista.js';
import { registerManager } from './handlers/manager.js';
import { registerOwner } from './handlers/owner.js';
import { registerAiHandler, executeAiQuery } from './handlers/ai.js';
import { registerJobHandlers } from './handlers/jobs.js';
import { registerStaffMenu } from './handlers/staffMenu.js';
import { isAiDirectChatMode, setAiDirectChatMode } from './ai/aiSessionManager.js';

import { openShift } from './conversations/openShift.js';
import { closeShift } from './conversations/closeShift.js';
import { quickOrder } from './conversations/quickOrder.js';
import { checkinWorkspace } from './conversations/checkinWorkspace.js';
import { stockIn } from './conversations/stockIn.js';
import { requestApproval } from './conversations/requestApproval.js';
import { createJobWizard } from './conversations/createJobWizard.js';
import { recordWasteConv } from './conversations/recordWaste.js';
import { renderJobsList, storeQuickJobDraft } from './handlers/jobs.js';
import { parseNaturalScheduleText } from '../services/cron/naturalScheduleParser.js';
import { formatScheduleNaturalReply } from '../services/ai/aiToneFormatter.js';
import { universalSchedulerAgent } from '../services/ai/universalSchedulerAgent.js';
import { InlineKeyboard } from 'grammy';

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
  if (ctx.user) {
    setAiDirectChatMode(ctx.user.id, false);
  }
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
bot.use(createConversation(recordWasteConv, 'recordWasteConv'));
bot.use(createConversation(requestApproval, 'requestApproval'));
bot.use(createConversation(createJobWizard, 'createJobWizard'));

// 5) Handlers peran & fitur
registerStart(bot);
registerCashier(bot);
registerBarista(bot);
registerManager(bot);
registerOwner(bot);
registerAiHandler(bot);
registerJobHandlers(bot);
registerStaffMenu(bot);

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

  const lowerText = text.toLowerCase().trim();
  const isManagerOrOwner = ctx.user.role === 'OWNER' || ctx.user.role === 'MANAGER';

  // 1. Jika Mode Chat AI Langsung sedang aktif (pesan percakapan bebas tanpa prefix /)
  if (isAiDirectChatMode(ctx.user.id) && !text.startsWith('/')) {
    if (isManagerOrOwner) {
      return executeAiQuery(ctx, text, { fromDirectChat: true });
    } else {
      setAiDirectChatMode(ctx.user.id, false);
    }
  }

  // 2. Deteksi perintah jadwal dinamis tanpa garis miring (/)
  if (isManagerOrOwner && !text.startsWith('/')) {
    if (/^(jadwal|daftar\s+jadwal|list\s+jadwal|lihat\s+jadwal|cek\s+jadwal)$/i.test(lowerText)) {
      const listText = await universalSchedulerAgent.listActiveSchedulesNatural(ctx.user);
      return ctx.reply(listText, { parse_mode: 'HTML' });
    }

    const parsedSchedule = parseNaturalScheduleText(text, ctx.from.id);
    if (parsedSchedule) {
      // Jika instruksi umum seperti "buat jadwal", "tambah jadwal", "bikin jadwal"
      if (/^(buat\s+jadwal|tambah\s+jadwal|bikin\s+jadwal|jadwal\s+baru)$/i.test(lowerText)) {
        return ctx.conversation.enter('createJobWizard');
      }

      // Jika instruksi shift kerja staf HRIS, eksekusi langsung
      if (parsedSchedule.jobCategory === 'STAFF_SHIFT') {
        const shiftResult = await universalSchedulerAgent.executeSchedule(parsedSchedule, ctx.user);
        return ctx.reply(shiftResult.message, { parse_mode: 'HTML' });
      }

      // Jika instruksi teks natural (cth: "buat jadwal laporan omzet jam 21:00", "ingatkan saya jam 14:00 untuk cek stok")
      const draftId = storeQuickJobDraft({
        name: parsedSchedule.name,
        jobType: parsedSchedule.jobType,
        scheduleType: parsedSchedule.scheduleType,
        scheduleExpression: parsedSchedule.scheduleExpression,
        timezone: parsedSchedule.timezone || 'Asia/Jakarta',
        payload: parsedSchedule.payload || {},
        targetRoles: parsedSchedule.targetRoles || ['OWNER', 'MANAGER'],
      });

      const naturalReply = formatScheduleNaturalReply(parsedSchedule, { user: ctx.user, isSaved: false });
      const quickKb = new InlineKeyboard()
        .text('✅ Ya, Aktifkan Sekarang', `qjs:${draftId}`)
        .text('❌ Batal', 'job_action:cancel');

      return ctx.reply(naturalReply, { parse_mode: 'HTML', reply_markup: quickKb });
    }
  }

  return ctx.reply(
    `Perintah tidak dikenali. Ketik /menu untuk melihat daftar fitur sesuai peran Anda (<b>${ctx.user.role}</b>).`,
    { parse_mode: 'HTML' }
  );
});

// 7) Global error handling
bot.catch(errorHandler);

let botActiveMode = 'OFFLINE';

export function getBotMode() {
  return botActiveMode;
}

function startPolling(botInstance) {
  botInstance
    .start({
      onStart: (me) => console.log(`🤖 [Telegram Bot] Aktif (Long Polling) sebagai @${me.username}`),
    })
    .catch((err) => {
      console.warn('⚠️ [Telegram Bot] Gagal memulai polling:', err.message);
    });
}

export async function initBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken.includes('placeholder')) {
    console.log('ℹ️ [Telegram Bot] TELEGRAM_BOT_TOKEN belum diset di .env. Bot Telegram ditangguhkan.');
    botActiveMode = 'DISABLED';
    return;
  }

  try {
    await bot.init();
    console.log(`🤖 [Telegram Bot] Terhubung sebagai @${bot.botInfo.username} (ID: ${bot.botInfo.id})`);

    const isProduction = process.env.NODE_ENV === 'production';
    const forcedMode = (process.env.TELEGRAM_BOT_MODE || '').toLowerCase().trim(); // 'polling' | 'webhook'
    let webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Normalisasi Webhook URL:
    // Jika user hanya mengisi host/domain (cth: "https://backend-komazi.up.railway.app"),
    // tambahkan path endpoint webhook "/telegram/webhook"
    if (webhookUrl && !webhookUrl.includes('/telegram/') && !webhookUrl.includes('/api/')) {
      webhookUrl = webhookUrl.replace(/\/+$/, '') + '/telegram/webhook';
    }

    if (forcedMode === 'polling') {
      // 1. Dipaksa Long-Polling lewat konfigurasi TELEGRAM_BOT_MODE=polling
      console.log('🤖 [Telegram Bot] Konfigurasi TELEGRAM_BOT_MODE=polling aktif. Menghapus webhook lama & memulai polling...');
      await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
      botActiveMode = isProduction ? 'POLLING_PROD' : 'POLLING_DEV';
      startPolling(bot);
    } else if (isProduction && webhookUrl) {
      // 2. Mode Production dengan TELEGRAM_WEBHOOK_URL
      try {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: webhookSecret || undefined,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        });
        botActiveMode = 'WEBHOOK';
        logger.telegram.info(`Webhook active at ${webhookUrl}`);
      } catch (webhookErr) {
        logger.telegram.warn(`Failed to set webhook at ${webhookUrl}: ${webhookErr.message}`);
        logger.telegram.info('Switching to Long Polling to keep bot active...');
        await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
        botActiveMode = 'POLLING_PROD';
        startPolling(bot);
      }
    } else if (isProduction && !webhookUrl) {
      // 3. Mode Production TANPA TELEGRAM_WEBHOOK_URL -> jalankan Long Polling agar bot TIDAK MATI!
      logger.telegram.warn('Production mode active but TELEGRAM_WEBHOOK_URL is not set');
      logger.telegram.info('Running Telegram bot via Long Polling automatically...');
      await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
      botActiveMode = 'POLLING_PROD';
      startPolling(bot);
    } else {
      // 4. Mode Development -> Long Polling
      await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
      botActiveMode = 'POLLING_DEV';
      startPolling(bot);
    }
  } catch (err) {
    logger.telegram.warn(`Telegram bot init failed: ${err.message}`);
  }
}
