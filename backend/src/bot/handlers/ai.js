/**
 * Handler Perintah /ai dan Mode Chat Langsung untuk Bot Telegram Komazi POS.
 * Mengintegrasikan Komazi AI Engine dengan feedback loading visual,
 * memori multi-turn in-memory, serta toggle Mode Chat Bebas (tanpa prefix /ai).
 */

import { InlineKeyboard } from 'grammy';
import { withLoadingAnimation } from '../utils/loading.js';
import { aiLimiter } from '../middlewares/aiLimiter.js';
import { getOpenclawConfig } from '../ai/openclawConfig.js';
import { sendOpenClawChat, OpenClawError } from '../ai/openclawClient.js';
import { buildAiSystemContext } from '../ai/aiContextService.js';
import { formatScheduleNaturalReply } from '../../services/ai/aiToneFormatter.js';
import {
  getHistory,
  getHistoryAsync,
  appendTurn,
  clearSession,
  isAiDirectChatMode,
  setAiDirectChatMode,
  toggleAiDirectChatMode,
} from '../ai/aiSessionManager.js';
import { esc } from '../utils/format.js';
import logger from '../../utils/logger.js';
import { parseNaturalScheduleText } from '../../services/cron/naturalScheduleParser.js';
import { storeQuickJobDraft } from './jobs.js';
import { findPosKnowledge } from '../../services/ai/posKnowledgeBase.js';
import prisma from '../../config/db.js';
import { checkSystemHealth, formatSentinelStatusHtml } from '../../services/cron/handlers/monitoringHandler.js';

/**
 * Memformat teks output AI agar aman untuk parser HTML Telegram.
 * Mengonversi markdown sederhana (**bold**, `code`) menjadi tag HTML Telegram.
 */
function formatAiTextForTelegram(raw) {
  if (!raw) return '';

  let formatted = esc(raw);
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  return formatted;
}

/**
 * Membangun InlineKeyboard tombol toggle mode chat AI langsung
 */
export function buildAiControlKeyboard(userId) {
  const isDirect = isAiDirectChatMode(userId);
  const kb = new InlineKeyboard();

  if (isDirect) {
    kb.text('🔴 Matikan Mode Chat Bebas', 'ai_toggle:off');
  } else {
    kb.text('🟢 Aktifkan Mode Chat Bebas (Tanpa /ai)', 'ai_toggle:on');
  }

  kb.row().text('🧹 Reset Memori Percakapan', 'ai_action:reset');
  return kb;
}

import { universalSchedulerAgent } from '../../services/ai/universalSchedulerAgent.js';

/**
 * Fungsi inti pemrosesan query AI (dapat dipanggil dari /ai maupun pesan teks bebas)
 * @param {object} ctx - Grammy context
 * @param {string} rawQuery - Pertanyaan user
 * @param {object} options - Opsi eksekusi { fromDirectChat: boolean }
 */
export async function executeAiQuery(ctx, rawQuery, options = { fromDirectChat: false }) {
  const config = getOpenclawConfig();
  const lowerQuery = rawQuery.toLowerCase().trim();

  // 1. Kueri status jadwal aktif secara alami jika diminta
  const isManagerOrOwner = ctx.user?.role === 'OWNER' || ctx.user?.role === 'MANAGER';
  if (isManagerOrOwner && /^(?:lihat|cek|ada|daftar|list)\s+(?:semua\s+)?(?:jadwal|pengingat)/i.test(lowerQuery)) {
    const listText = await universalSchedulerAgent.listActiveSchedulesNatural(ctx.user);
    appendTurn(ctx.user.id, rawQuery, listText, ctx.user);
    return ctx.reply(listText, { parse_mode: 'HTML' });
  }

  // 1b. Kueri status sentinel / kesehatan sistem secara alami
  if (isManagerOrOwner && /^(?:status|cek|kesehatan|health|sentinel)\s*(?:sistem|server|bot|sentinel|database)?$/i.test(lowerQuery)) {
    const status = await checkSystemHealth({ checkAi: true });
    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });
    const replyHtml = formatSentinelStatusHtml(status, { isManual: true, jobConfig: sentinelJob });
    const kb = new InlineKeyboard()
      .text('🔄 Refresh Status', 'sentinel_action:refresh')
      .text('⏰ Atur Jadwal', 'sentinel_action:schedule_menu')
      .row()
      .text('📋 Kelola Semua Jadwal Cron', 'go:jobs');
    appendTurn(ctx.user.id, rawQuery, replyHtml, ctx.user);
    return ctx.reply(replyHtml, { parse_mode: 'HTML', reply_markup: kb });
  }

  // 2. Deteksi intensi jadwal / pengingat jika pengguna adalah Owner atau Manager
  const parsedSchedule = isManagerOrOwner ? parseNaturalScheduleText(rawQuery, ctx.from?.id) : null;
  let scheduleDraftId = null;

  // Jika ini adalah jadwal shift kerja staf HRIS, eksekusi langsung ke sistem HRIS & Schedule Guard
  if (parsedSchedule && parsedSchedule.jobCategory === 'STAFF_SHIFT') {
    const shiftResult = await universalSchedulerAgent.executeSchedule(parsedSchedule, ctx.user);
    appendTurn(ctx.user.id, rawQuery, shiftResult.message, ctx.user);
    return ctx.reply(shiftResult.message, { parse_mode: 'HTML' });
  }

  if (parsedSchedule) {
    scheduleDraftId = storeQuickJobDraft({
      name: parsedSchedule.name,
      jobType: parsedSchedule.jobType,
      scheduleType: parsedSchedule.scheduleType,
      scheduleExpression: parsedSchedule.scheduleExpression,
      timezone: parsedSchedule.timezone || 'Asia/Jakarta',
      payload: parsedSchedule.payload || {},
      targetRoles: parsedSchedule.targetRoles || ['OWNER', 'MANAGER'],
    });
  }

  // 2. Pemeriksaan Status AI di .env
  if (!config.enabled) {
    // Jika AI nonaktif tetapi pengguna meminta jadwal/pengingat, tangani langsung melalui scheduler dengan bahasa alami
    if (parsedSchedule && scheduleDraftId) {
      const naturalReply = formatScheduleNaturalReply(parsedSchedule, { user: ctx.user, isSaved: false });
      const quickKb = new InlineKeyboard()
        .text('✅ Ya, Aktifkan Sekarang', `qjs:${scheduleDraftId}`)
        .text('❌ Batal', 'job_action:cancel');

      return ctx.reply(naturalReply, { parse_mode: 'HTML', reply_markup: quickKb });
    }

    return ctx.reply(
      'Maaf, layanan asisten cerdas Komazi AI saat ini sedang dinonaktifkan di pengaturan server.\n' +
      'Silakan gunakan menu laporan reguler melalui /menu atau /ringkasan.',
      { parse_mode: 'HTML' }
    );
  }

  // 3. Pembatasan Panjang Pertanyaan Pengguna
  let userQuery = rawQuery.trim();
  let queryNotice = '';
  if (userQuery.length > config.maxInputChars) {
    userQuery = userQuery.slice(0, config.maxInputChars);
    queryNotice = '\n<i>[Pertanyaan disesuaikan dengan batas 500 karakter]</i>';
  }

  // 4. Eksekusi dengan Animasi Loading Bar
  return withLoadingAnimation(
    ctx,
    { chatAction: 'typing' },
    async () => {
      try {
        const [systemPrompt, history] = await Promise.all([
          buildAiSystemContext(ctx.user, userQuery),
          getHistoryAsync(ctx.user.id),
        ]);

        let effectiveSystemPrompt = systemPrompt;
        if (parsedSchedule) {
          effectiveSystemPrompt +=
            `\n\n[PEMBERITAHUAN SISTEM JADWAL/PENGINGAT]:\n` +
            `Staf meminta membuat jadwal atau pengingat: "${parsedSchedule.name}" pada "${parsedSchedule.timeDescription}". ` +
            `Konfirmasikan pengingat ini secara ramah, santai, dan bersahabat seperti chatbot asisten pribadi. Jangan gunakan format log developer! Beritahu bahwa tombol konfirmasi sudah tersedia di bawah pesan ini jika mereka ingin mengaktifkannya.`;
        }

        const messages = [
          { role: 'system', content: effectiveSystemPrompt },
          ...history,
          { role: 'user', content: userQuery },
        ];

        const response = await sendOpenClawChat({
          messages,
          userId: ctx.user.id,
        });

        // Simpan giliran percakapan ke riwayat multi-turn & berkas Markdown
        appendTurn(ctx.user.id, userQuery, response.text, ctx.user);

        const formattedReply = formatAiTextForTelegram(response.text);

        let finalCaption = `${formattedReply}${queryNotice}`;

        const replyOptions = {
          parse_mode: 'HTML',
        };

        // Jika terdeteksi permintaan pengingat/jadwal, sertakan tombol aksi langsung
        if (scheduleDraftId) {
          const buttonLabel =
            parsedSchedule.jobType === 'REMINDER'
              ? `⏰ Pasang Pengingat: ${parsedSchedule.payload?.message || parsedSchedule.name}`
              : `✅ Aktifkan Jadwal: ${parsedSchedule.name}`;

          replyOptions.reply_markup = new InlineKeyboard()
            .text(buttonLabel.slice(0, 50), `qjs:${scheduleDraftId}`)
            .row()
            .text('❌ Batal', 'job_action:cancel');
        }

        if (!finalCaption.includes('@komazi-assistant')) {
          finalCaption += '\n\n🤖 <i>@komazi-assistant</i>';
        }

        if (finalCaption.length > 4000) {
          finalCaption = finalCaption.slice(0, 3950) + '\n\n<i>[Pesan dipotong]</i>\n\n🤖 <i>@komazi-assistant</i>';
        }

        return ctx.reply(finalCaption, replyOptions);
      } catch (err) {
        logger.telegram.warn(`[Komazi AI Handler Error] ${err.message}`);

        // Fallback anggun: Jika AI Gateway bermasalah tetapi pengguna ingin membuat jadwal/pengingat,
        // tetap tampilkan kartu konfirmasi scheduler ramah sehingga user tidak gagal membuat pengingat!
        if (parsedSchedule && scheduleDraftId) {
          const naturalReply = formatScheduleNaturalReply(parsedSchedule, { user: ctx.user, isSaved: false });
          const quickKb = new InlineKeyboard()
            .text('✅ Ya, Aktifkan Sekarang', `qjs:${scheduleDraftId}`)
            .text('❌ Batal', 'job_action:cancel');

          return ctx.reply(naturalReply, { parse_mode: 'HTML', reply_markup: quickKb });
        }

        // Fallback anggun: Jika AI Gateway bermasalah tetapi pertanyaan berkaitan dengan SOP POS,
        // berikan panduan SOP resmi dari basis pengetahuan internal
        const sop = findPosKnowledge(userQuery);
        if (sop) {
          let sopMsg = `💡 <b>PANDUAN POS: ${esc(sop.title.toUpperCase())}</b>\n━━━━━━━━━━━━━━━━━━\n`;
          sopMsg += `${esc(sop.summary)}\n\n<b>Langkah-langkah Eksekusi:</b>\n`;
          sop.steps.forEach((s, idx) => {
            sopMsg += `<b>${idx + 1}.</b> ${esc(s)}\n`;
          });
          if (sop.troubleshooting) {
            sopMsg += `\n📌 <b>Tips:</b> <i>${esc(sop.troubleshooting)}</i>\n`;
          }
          sopMsg += `━━━━━━━━━━━━━━━━━━`;
          return ctx.reply(sopMsg, { parse_mode: 'HTML' });
        }

        let userFriendlyError =
          'Layanan asisten AI sedang tidak dapat dijangkau atau mengalami batas kuota.';
        if (err instanceof OpenClawError) {
          userFriendlyError = err.message;
        }

        return ctx.reply(
          `⚠️ <b>Asisten AI Mengalami Kendala</b>\n\n` +
          `${esc(userFriendlyError)}\n\n` +
          `<i>💡 Fitur utama POS, kasir, dan laporan reguler (/ringkasan, /stok) tetap beroperasi normal.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }
  );
}

export function registerAiHandler(bot) {
  // 1) Handler Command /ai
  bot.command('ai', aiLimiter, async (ctx) => {
    const rawQuery = (ctx.match || '').trim();
    const arg = rawQuery.toLowerCase();

    // A. Subcommand: Aktifkan mode chat bebas
    if (arg === 'on' || arg === 'aktif' || arg === 'start') {
      setAiDirectChatMode(ctx.user.id, true);
      return ctx.reply(
        `🟢 <b>Mode Chat AI Langsung DIAKTIFKAN</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Mulai sekarang Anda dapat langsung mengetik pertanyaan <b>tanpa perlu mengetik /ai</b> di depan pesan!\n\n` +
        `Contoh: cukup ketik <i>"berapa omset hari ini?"</i> atau <i>"ada stok yang menipis?"</i>\n\n` +
        `Untuk mematikan mode ini kapan saja:\n` +
        `• Ketik <code>/ai off</code>\n` +
        `• Atau tekan tombol merah di bawah:`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔴 Matikan Mode Chat Bebas', 'ai_toggle:off'),
        }
      );
    }

    // B. Subcommand: Matikan mode chat bebas
    if (arg === 'off' || arg === 'mati' || arg === 'stop') {
      setAiDirectChatMode(ctx.user.id, false);
      return ctx.reply(
        `⚪ <b>Mode Chat AI Langsung DINONAKTIFKAN</b>\n\n` +
        `Bot telah kembali ke mode normal. Anda tetap dapat menggunakan perintah <code>/ai [pertanyaan]</code> seperti biasa.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🟢 Aktifkan Kembali', 'ai_toggle:on'),
        }
      );
    }

    // C. Subcommand: Reset riwayat percakapan
    if (arg === 'reset' || arg === 'clear') {
      clearSession(ctx.user.id);
      return ctx.reply(
        '🧹 <b>Riwayat Sesi Direset</b>\n\n' +
        'Memori percakapan sebelumnya telah dibersihkan. Anda sekarang dapat memulai topik percakapan baru.',
        { parse_mode: 'HTML' }
      );
    }

    // D. Tanpa argumen -> Tampilkan panduan penggunaan & tombol toggle
    if (!rawQuery) {
      const isDirect = isAiDirectChatMode(ctx.user.id);
      return ctx.reply(
        `🤖 <b>KOMAZI AI ASSISTANT</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Status Mode Chat Bebas: <b>${isDirect ? '🟢 AKTIF' : '⚪ NONAKTIF'}</b>\n\n` +
        `<b>Pilihan Penggunaan:</b>\n` +
        `1. Ketik perintah: <code>/ai [pertanyaan Anda]</code>\n` +
        `2. Atau aktifkan <b>Mode Chat Bebas</b> agar bisa langsung mengobrol seperti chat biasa!\n\n` +
        `<b>Contoh Pertanyaan:</b>\n` +
        `• <code>/ai bagaimana ringkasan omset penjualan hari ini?</code>\n` +
        `• <code>/ai apakah ada bahan baku yang perlu segera dibeli?</code>\n\n` +
        `<b>Perintah Cepat:</b>\n` +
        `• <code>/ai on</code> — Aktifkan mode chat bebas\n` +
        `• <code>/ai off</code> — Matikan mode chat bebas\n` +
        `• <code>/ai reset</code> — Bersihkan memori percakapan\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🤖 <i>@komazi-assistant</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: buildAiControlKeyboard(ctx.user.id),
        }
      );
    }

    // E. Ada pertanyaan eksplisit -> Eksekusi langsung
    return executeAiQuery(ctx, rawQuery, { fromDirectChat: false });
  });

  // 2) Handler Command /ai_mode (Toggle Cepat)
  bot.command(['ai_mode', 'aimode'], aiLimiter, async (ctx) => {
    const newStatus = toggleAiDirectChatMode(ctx.user.id);
    if (newStatus) {
      return ctx.reply(
        `🟢 <b>Mode Chat AI Langsung DIAKTIFKAN</b>\n\n` +
        `Anda dapat langsung mengetik pesan/pertanyaan apa saja tanpa perlu mengetik /ai.\n` +
        `Ketik <code>/ai_mode</code> atau tekan tombol di bawah untuk mematikan.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔴 Matikan Mode Chat Bebas', 'ai_toggle:off'),
        }
      );
    } else {
      return ctx.reply(
        `⚪ <b>Mode Chat AI Langsung DINONAKTIFKAN</b>\n\n` +
        `Kembali ke mode bot reguler. Gunakan <code>/ai [pertanyaan]</code> jika ingin bertanya ke asisten AI.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🟢 Aktifkan Mode Chat Bebas', 'ai_toggle:on'),
        }
      );
    }
  });

  // 3) Callback Query untuk tombol Toggle AI
  bot.callbackQuery(/^ai_toggle:(on|off|toggle)$/, aiLimiter, async (ctx) => {
    await ctx.answerCallbackQuery();
    const action = ctx.match[1];

    let newStatus = false;
    if (action === 'on') {
      setAiDirectChatMode(ctx.user.id, true);
      newStatus = true;
    } else if (action === 'off') {
      setAiDirectChatMode(ctx.user.id, false);
      newStatus = false;
    } else {
      newStatus = toggleAiDirectChatMode(ctx.user.id);
    }

    const text = newStatus
      ? `🟢 <b>Mode Chat AI Langsung AKTIF!</b>\n\nSilakan langsung kirim pertanyaan atau instruksi tanpa perlu mengetik /ai.`
      : `⚪ <b>Mode Chat AI Langsung NONAKTIF</b>\n\nKembali ke mode perintah standar. Gunakan /ai [pertanyaan] saat dibutuhkan.`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: buildAiControlKeyboard(ctx.user.id),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: buildAiControlKeyboard(ctx.user.id),
      });
    }
  });

  // 4) Callback Query untuk Reset Memori Sesi
  bot.callbackQuery('ai_action:reset', aiLimiter, async (ctx) => {
    await ctx.answerCallbackQuery('Memori AI direset');
    clearSession(ctx.user.id);
    return ctx.reply('🧹 <b>Memori percakapan AI telah dibersihkan.</b>', { parse_mode: 'HTML' });
  });

  // 5) Callback Query dari menu utama ("go:ai_menu")
  bot.callbackQuery('go:ai_menu', aiLimiter, async (ctx) => {
    await ctx.answerCallbackQuery();
    const isDirect = isAiDirectChatMode(ctx.user.id);
    return ctx.reply(
      `🤖 <b>KOMAZI AI ASSISTANT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Status Mode Chat Bebas: <b>${isDirect ? '🟢 AKTIF' : '⚪ NONAKTIF'}</b>\n\n` +
      `Pilih opsi di bawah untuk mengaktifkan obrolan langsung atau reset sesi:`,
      {
        parse_mode: 'HTML',
        reply_markup: buildAiControlKeyboard(ctx.user.id),
      }
    );
  });
}
