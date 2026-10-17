/**
 * Telegram Bot Handler: Dynamic Cron & Scheduled Jobs Management.
 * Menyediakan perintah /jobs, /job_show, /job_create, /job_pause,
 * /job_resume, /job_cancel, /job_run, /job_runs, dan /job_help.
 */

import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { jobRegistryService } from '../../services/cron/jobRegistryService.js';
import { jobRunnerService } from '../../services/cron/jobRunnerService.js';
import { openclawAutomationAdapter } from '../../services/cron/openclawAutomationAdapter.js';
import prisma from '../../config/db.js';
import { esc } from '../utils/format.js';
import logger from '../../utils/logger.js';

function formatWib(date) {
  if (!date) return '-';
  try {
    const d = new Date(date);
    return (
      d.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB'
    );
  } catch {
    return String(date);
  }
}

function getStatusBadge(job) {
  if (job.deletedAt) return '🛑 Dibatalkan';
  if (!job.enabled) return '⏸ Dijeda';
  return '🟢 Aktif';
}

function getRunStatusBadge(status) {
  switch (status) {
    case 'succeeded':
      return '✅ Sukses';
    case 'failed':
      return '❌ Gagal';
    case 'running':
      return '⏳ Berjalan';
    case 'retrying':
      return '🔄 Mencoba Ulang';
    default:
      return status;
  }
}

// Draft cache untuk quick job save (mencegah limit 64 byte Telegram callback_data)
const quickJobDrafts = new Map();

export function storeQuickJobDraft(data) {
  const draftId = Math.random().toString(36).slice(2, 9);
  quickJobDrafts.set(draftId, {
    ...data,
    createdAt: Date.now(),
  });

  if (quickJobDrafts.size > 100) {
    const expireBefore = Date.now() - 15 * 60 * 1000;
    for (const [id, item] of quickJobDrafts.entries()) {
      if (item.createdAt < expireBefore) quickJobDrafts.delete(id);
    }
  }

  return draftId;
}

export function popQuickJobDraft(draftId) {
  const draft = quickJobDrafts.get(draftId);
  if (draft) quickJobDrafts.delete(draftId);
  return draft;
}

export function registerJobHandlers(bot) {
  // ==========================================
  // 0) /cron [subcommand] — Router Perintah Cron Lengkap (Section 5.4)
  // ==========================================
  bot.command('cron', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const rawMatch = (ctx.match || '').trim();
    if (!rawMatch) {
      return renderCronHelpMenu(ctx);
    }

    const parts = rawMatch.split(/\s+/);
    const sub = parts[0].toLowerCase();
    const arg1 = parts[1];
    const restArgs = parts.slice(2).join(' ');

    switch (sub) {
      case 'bantuan':
      case 'help':
      case 'menu':
        return renderCronHelpMenu(ctx);

      case 'buat':
      case 'create':
      case 'tambah':
        return ctx.conversation.enter('createJobWizard');

      case 'saya':
      case 'list':
      case 'daftar': {
        const page = Math.max(1, parseInt(arg1) || 1);
        return renderJobsList(ctx, page);
      }

      case 'detail':
      case 'show': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron detail &lt;id&gt;</code>\nContoh: <code>/cron detail 1</code>', { parse_mode: 'HTML' });
        }
        return renderJobDetail(ctx, id);
      }

      case 'jeda':
      case 'pause': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron jeda &lt;id&gt;</code>', { parse_mode: 'HTML' });
        }
        try {
          const updated = await jobRegistryService.pauseJob(id, {
            type: 'USER',
            id: String(ctx.user.id),
            name: ctx.user.name,
          });
          return ctx.reply(
            `⏸ <b>Jadwal #${updated.id} Ditangguhkan.</b>\nNama: <b>${esc(updated.name)}</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('▶️ Aktifkan Kembali', `job_resume:${updated.id}`),
            }
          );
        } catch (err) {
          return ctx.reply(`❌ <b>Gagal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
        }
      }

      case 'aktifkan':
      case 'resume': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron aktifkan &lt;id&gt;</code>', { parse_mode: 'HTML' });
        }
        try {
          const updated = await jobRegistryService.resumeJob(id, {
            type: 'USER',
            id: String(ctx.user.id),
            name: ctx.user.name,
          });
          return ctx.reply(
            `▶️ <b>Jadwal #${updated.id} Diaktifkan Kembali!</b>\nNama: <b>${esc(updated.name)}</b>\nJadwal Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('⏸ Jeda Lagi', `job_pause:${updated.id}`),
            }
          );
        } catch (err) {
          return ctx.reply(`❌ <b>Gagal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
        }
      }

      case 'ubah':
      case 'edit': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply(
            '⚠️ Format: <code>/cron ubah &lt;id&gt; &lt;ekspresi_baru&gt;</code>\nContoh:\n• <code>/cron ubah 1 0 21 * * *</code> (tiap 21:00 WIB)\n• <code>/cron ubah 1 30m</code> (tiap 30 menit)',
            { parse_mode: 'HTML' }
          );
        }

        const newExpression = restArgs ? `${parts[2]} ${parts.slice(3).join(' ')}`.trim() : '';
        if (!newExpression) {
          return renderJobEditPrompt(ctx, id);
        }

        try {
          const isInterval = /^(\d+)\s*(s|m|h|d)$/i.test(newExpression);
          const scheduleType = isInterval ? 'interval' : 'cron';
          const updated = await jobRegistryService.updateJob(
            id,
            { scheduleType, scheduleExpression: newExpression },
            { type: 'USER', id: String(ctx.user.id), name: ctx.user.name }
          );
          return ctx.reply(
            `✅ <b>Jadwal #${updated.id} Berhasil Diubah!</b>\n━━━━━━━━━━━━━━━━━━\n• Pola Baru: <code>${esc(updated.scheduleExpression)}</code> (${updated.scheduleType})\n• Eksekusi Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('🔍 Lihat Detail', `job_detail:${updated.id}`),
            }
          );
        } catch (err) {
          return ctx.reply(`❌ <b>Gagal Mengubah Jadwal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
        }
      }

      case 'hapus':
      case 'cancel':
      case 'delete': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron hapus &lt;id&gt;</code>', { parse_mode: 'HTML' });
        }
        const job = await prisma.scheduledJob.findFirst({ where: { id, deletedAt: null } });
        if (!job) {
          return ctx.reply(`❌ Jadwal #${id} tidak ditemukan.`);
        }
        const kb = new InlineKeyboard()
          .text(`🗑️ Ya, Hapus Jadwal #${id}`, `job_del_exec:${id}`)
          .text('❌ Batal', `job_detail:${id}`);
        return ctx.reply(
          `⚠️ <b>Konfirmasi Penghapusan Jadwal #${id}</b>\n━━━━━━━━━━━━━━━━━━\nNama: <b>${esc(job.name)}</b>\nTipe: <code>${job.jobType}</code>\nJadwal: <code>${esc(job.scheduleExpression)}</code>\n\nApakah Anda yakin ingin menonaktifkan & menghapus jadwal ini?`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      case 'jalankan':
      case 'run': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron jalankan &lt;id&gt;</code>', { parse_mode: 'HTML' });
        }
        return executeJobManualTrigger(ctx, id);
      }

      case 'lewati':
      case 'skip': {
        const id = parseInt(arg1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron lewati &lt;id&gt;</code>', { parse_mode: 'HTML' });
        }
        try {
          const result = await jobRegistryService.skipJobOccurrence(id, {
            type: 'USER',
            id: String(ctx.user.id),
            name: ctx.user.name,
          });
          return ctx.reply(
            `⏭️ <b>Occurrence Jadwal #${id} Berhasil Dilewati!</b>\n━━━━━━━━━━━━━━━━━━\n• Jadwal yang Dilewati: <i>${formatWib(result.skippedRunAt)}</i>\n• Eksekusi Berikutnya: <b>${formatWib(result.nextRunAt)}</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('🔍 Lihat Detail', `job_detail:${id}`),
            }
          );
        } catch (err) {
          return ctx.reply(`❌ <b>Gagal Melewati Jadwal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
        }
      }

      case 'riwayat':
      case 'runs': {
        const id = parseInt(arg1);
        const page = Math.max(1, parseInt(parts[2]) || 1);
        if (!id || isNaN(id)) {
          return ctx.reply('⚠️ Format: <code>/cron riwayat &lt;id&gt; [halaman]</code>', { parse_mode: 'HTML' });
        }
        return renderJobRuns(ctx, id, page);
      }

      case 'batal': {
        try {
          await ctx.conversation.exit();
        } catch {}
        return ctx.reply('✅ Alur percakapan jadwal yang sedang aktif telah dibatalkan.');
      }

      default:
        return ctx.reply(
          `⚠️ Subcommand <code>/cron ${esc(sub)}</code> tidak dikenali.\nKetik <code>/cron</code> untuk melihat daftar perintah bantuan.`,
          { parse_mode: 'HTML' }
        );
    }
  });

  // ==========================================
  // 1) /jobs — Daftar Jadwal Terdaftar
  // ==========================================
  bot.command('jobs', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const args = (ctx.match || '').trim();
    const page = Math.max(1, parseInt(args) || 1);
    await renderJobsList(ctx, page);
  });

  // ==========================================
  // 2) /job_show <id> — Detail Jadwal
  // ==========================================
  bot.command('job_show', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const id = parseInt((ctx.match || '').trim());
    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format salah. Gunakan:\n<code>/job_show &lt;id&gt;</code>\nContoh: <code>/job_show 1</code>', {
        parse_mode: 'HTML',
      });
    }
    await renderJobDetail(ctx, id);
  });

  // ==========================================
  // 3) /job_create <json_payload> — Buat Jadwal Baru (Buka Wizard jika tanpa argumen)
  // ==========================================
  bot.command('job_create', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const raw = (ctx.match || '').trim();
    if (!raw) {
      // Masuk ke wizard interaktif dinamis tanpa perlu mengetik / atau JSON
      return ctx.conversation.enter('createJobWizard');
    }

    try {
      const parsed = JSON.parse(raw);
      const created = await jobRegistryService.createJob(parsed, {
        type: 'USER',
        id: String(ctx.user.id),
        name: ctx.user.name,
      });

      return ctx.reply(
        `✅ <b>Jadwal Berhasil Dibuat!</b>\n━━━━━━━━━━━━━━━━━━\n<b>ID:</b> #${created.id}\n<b>Nama:</b> ${esc(created.name)}\n<b>Tipe:</b> <code>${created.jobType}</code>\n<b>Ekspresi:</b> <code>${esc(created.scheduleExpression)}</code>\n<b>Jadwal Berikutnya:</b> ${formatWib(created.nextRunAt)}\n\nKetik <code>/job_show ${created.id}</code> untuk memeriksa konfigurasi lengkap.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('▶️ Jalankan Sekarang', `job_run:${created.id}`)
            .text('🔍 Lihat Detail', `job_detail:${created.id}`),
        }
      );
    } catch (err) {
      return ctx.reply(`❌ <b>Gagal Membuat Jadwal:</b>\n${esc(err.message)}`, {
        parse_mode: 'HTML',
      });
    }
  });

  // ==========================================
  // 4) /job_pause <id> — Jeda Jadwal
  // ==========================================
  bot.command('job_pause', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const id = parseInt((ctx.match || '').trim());
    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format: <code>/job_pause &lt;id&gt;</code>', { parse_mode: 'HTML' });
    }
    try {
      const updated = await jobRegistryService.pauseJob(id, {
        type: 'USER',
        id: String(ctx.user.id),
        name: ctx.user.name,
      });
      return ctx.reply(`⏸ <b>Jadwal #${updated.id} Ditangguhkan (Paused).</b>\nNama: <b>${esc(updated.name)}</b>`, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('▶️ Lanjutkan Jadwal', `job_resume:${updated.id}`),
      });
    } catch (err) {
      return ctx.reply(`❌ <b>Gagal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // ==========================================
  // 5) /job_resume <id> — Lanjutkan Jadwal
  // ==========================================
  bot.command('job_resume', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const id = parseInt((ctx.match || '').trim());
    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format: <code>/job_resume &lt;id&gt;</code>', { parse_mode: 'HTML' });
    }
    try {
      const updated = await jobRegistryService.resumeJob(id, {
        type: 'USER',
        id: String(ctx.user.id),
        name: ctx.user.name,
      });
      return ctx.reply(
        `▶️ <b>Jadwal #${updated.id} Diaktifkan Kembali!</b>\nNama: <b>${esc(updated.name)}</b>\nJadwal Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('⏸ Jeda Lagi', `job_pause:${updated.id}`),
        }
      );
    } catch (err) {
      return ctx.reply(`❌ <b>Gagal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // ==========================================
  // 6) /job_cancel <id> — Batalkan/Hapus Jadwal
  // ==========================================
  bot.command('job_cancel', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const id = parseInt((ctx.match || '').trim());
    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format: <code>/job_cancel &lt;id&gt;</code>', { parse_mode: 'HTML' });
    }
    try {
      const updated = await jobRegistryService.cancelJob(id, {
        type: 'USER',
        id: String(ctx.user.id),
        name: ctx.user.name,
      });
      return ctx.reply(`🛑 <b>Jadwal #${updated.id} ('${esc(updated.name)}') Telah Dibatalkan / Dinonaktifkan.</b>`, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      return ctx.reply(`❌ <b>Gagal:</b> ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // ==========================================
  // 7) /job_run <id> — On-Demand Trigger
  // ==========================================
  bot.command('job_run', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const id = parseInt((ctx.match || '').trim());
    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format: <code>/job_run &lt;id&gt;</code>', { parse_mode: 'HTML' });
    }
    await executeJobManualTrigger(ctx, id);
  });

  // ==========================================
  // 8) /job_runs <id> — Riwayat Eksekusi
  // ==========================================
  bot.command('job_runs', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const parts = (ctx.match || '').trim().split(/\s+/);
    const id = parseInt(parts[0]);
    const page = Math.max(1, parseInt(parts[1]) || 1);

    if (!id || isNaN(id)) {
      return ctx.reply('⚠️ Format: <code>/job_runs &lt;id&gt; [halaman]</code>\nContoh: <code>/job_runs 1</code>', {
        parse_mode: 'HTML',
      });
    }
    await renderJobRuns(ctx, id, page);
  });

  // ==========================================
  // 9) /job_help — Panduan Dokumentasi Cron
  // ==========================================
  bot.command('job_help', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const text = `
⚙️ <b>DOKUMENTASI SISTEM CRON &amp; AUTOMATION KOMAZI</b>
━━━━━━━━━━━━━━━━━━
Sistem penjadwalan terintegrasi dengan runtime Node.js, Prisma ORM, dan Komazi AI.

<b>📋 Format Perintah:</b>
• <code>/jobs [page]</code> — Daftar jadwal aktif & status
• <code>/job_show &lt;id&gt;</code> — Detail konfigurasi jadwal
• <code>/job_create &lt;json&gt;</code> — Buat jadwal baru
• <code>/job_pause &lt;id&gt;</code> — Jeda jadwal sementara
• <code>/job_resume &lt;id&gt;</code> — Lanjutkan jadwal
• <code>/job_cancel &lt;id&gt;</code> — Hapus/batalkan jadwal
• <code>/job_run &lt;id&gt;</code> — Eksekusi langsung on-demand
• <code>/job_runs &lt;id&gt; [page]</code> — Riwayat eksekusi job
• <code>/job_help</code> — Panduan ini

<b>⏰ Sintaks Waktu (Cron Expression):</b>
Format: <code>Menit Jam HariBulan Bulan HariMinggu</code>
Zona Waktu: <b>Asia/Jakarta (WIB)</b>
• <code>0 8 * * *</code> = Tiap hari jam 08:00 WIB
• <code>0 22 * * *</code> = Tiap hari jam 22:00 WIB
• <code>*/30 8-22 * * *</code> = Tiap 30 menit (jam 08-22)
• <code>0 9 * * 1</code> = Tiap Senin jam 09:00 WIB

<b>🎯 Tipe Job yang Didukung:</b>
1. <b>REPORT</b> — Generate & kirim ringkasan omzet / sales card visual
2. <b>BACKUP</b> — Snapshot audit integritas data & SHA256 verification
3. <b>MONITORING</b> — Cek latensi database, memori & kesehatan sistem POS
4. <b>REMINDER</b> — Pengingat operasional ke staf / peran spesifik
5. <b>AI_TASK</b> — Tugas analitik terarah Komazi AI Engine
━━━━━━━━━━━━━━━━━━
<i>Didukung oleh Komazi POS Enterprise Automation Engine</i>
    `.trim();

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // ==========================================
  // Callback Queries untuk Tombol Interaktif
  // ==========================================
  bot.callbackQuery(/^jobs_page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[1]) || 1;
    await renderJobsList(ctx, page, true);
  });

  bot.callbackQuery(/^job_detail:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = parseInt(ctx.match[1]);
    await renderJobDetail(ctx, id, true);
  });

  bot.callbackQuery(/^job_run:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Memulai eksekusi...');
    const id = parseInt(ctx.match[1]);
    await executeJobManualTrigger(ctx, id);
  });

  bot.callbackQuery(/^job_pause:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = parseInt(ctx.match[1]);
    try {
      await jobRegistryService.pauseJob(id, {
        type: 'USER',
        id: String(ctx.user?.id || 'telegram'),
        name: ctx.user?.name || 'User',
      });
      await renderJobDetail(ctx, id, true);
    } catch (err) {
      await ctx.reply(`❌ Gagal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery(/^job_resume:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = parseInt(ctx.match[1]);
    try {
      await jobRegistryService.resumeJob(id, {
        type: 'USER',
        id: String(ctx.user?.id || 'telegram'),
        name: ctx.user?.name || 'User',
      });
      await renderJobDetail(ctx, id, true);
    } catch (err) {
      await ctx.reply(`❌ Gagal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery(/^job_skip:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Melewati eksekusi berikutnya...').catch(() => {});
    const id = parseInt(ctx.match[1]);
    try {
      const result = await jobRegistryService.skipJobOccurrence(id, {
        type: 'USER',
        id: String(ctx.user?.id || 'telegram'),
        name: ctx.user?.name || 'User',
      });
      await ctx.reply(
        `⏭️ <b>Occurrence Jadwal #${id} Berhasil Dilewati!</b>\n━━━━━━━━━━━━━━━━━━\n• Dilewati: <i>${formatWib(result.skippedRunAt)}</i>\n• Eksekusi Berikutnya: <b>${formatWib(result.nextRunAt)}</b>`,
        { parse_mode: 'HTML' }
      );
      await renderJobDetail(ctx, id, false);
    } catch (err) {
      return ctx.reply(`❌ Gagal melewati jadwal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery(/^job_edit_prompt:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = parseInt(ctx.match[1]);
    await renderJobEditPrompt(ctx, id, true);
  });

  bot.callbackQuery(/^job_preset_edit:(\d+):(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Mengubah jadwal...').catch(() => {});
    const id = parseInt(ctx.match[1]);
    const expr = ctx.match[2].trim();
    const isInterval = /^(\d+)\s*(s|m|h|d)$/i.test(expr);
    const scheduleType = isInterval ? 'interval' : 'cron';

    try {
      const updated = await jobRegistryService.updateJob(
        id,
        { scheduleType, scheduleExpression: expr },
        { type: 'USER', id: String(ctx.user?.id || 'telegram'), name: ctx.user?.name || 'User' }
      );
      await ctx.editMessageText(
        `✅ <b>Jadwal #${updated.id} Berhasil Diperbarui!</b>\n━━━━━━━━━━━━━━━━━━\n• Pola Baru: <code>${esc(updated.scheduleExpression)}</code> (${updated.scheduleType})\n• Eksekusi Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔍 Lihat Detail', `job_detail:${updated.id}`),
        }
      );
    } catch (err) {
      return ctx.reply(`❌ Gagal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery(/^job_del_confirm:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = parseInt(ctx.match[1]);
    const job = await prisma.scheduledJob.findFirst({ where: { id, deletedAt: null } });
    if (!job) {
      return ctx.reply(`❌ Jadwal #${id} tidak ditemukan.`);
    }
    const kb = new InlineKeyboard()
      .text(`🗑️ Ya, Hapus Jadwal #${id}`, `job_del_exec:${id}`)
      .text('❌ Batal', `job_detail:${id}`);

    return ctx.editMessageText(
      `⚠️ <b>Konfirmasi Penghapusan Jadwal #${id}</b>\n━━━━━━━━━━━━━━━━━━\nNama: <b>${esc(job.name)}</b>\nTipe: <code>${job.jobType}</code>\nJadwal: <code>${esc(job.scheduleExpression)}</code>\n\nApakah Anda yakin ingin menonaktifkan & menghapus jadwal ini?`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  bot.callbackQuery(/^job_del_exec:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Menghapus jadwal...').catch(() => {});
    const id = parseInt(ctx.match[1]);
    try {
      const updated = await jobRegistryService.cancelJob(id, {
        type: 'USER',
        id: String(ctx.user?.id || 'telegram'),
        name: ctx.user?.name || 'User',
      });
      return ctx.editMessageText(
        `🛑 <b>Jadwal #${updated.id} ('${esc(updated.name)}') Berhasil Dihapus / Dinonaktifkan.</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('📋 Lihat Semua Jadwal', 'go:jobs'),
        }
      );
    } catch (err) {
      return ctx.reply(`❌ Gagal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery('job:create_wizard', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.conversation.enter('createJobWizard');
  });

  bot.callbackQuery('go:jobs', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await renderJobsList(ctx, 1);
  });

  bot.callbackQuery(/^qjs:([a-z0-9]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Menyimpan jadwal...').catch(() => {});
    try {
      const data = popQuickJobDraft(ctx.match[1]);
      if (!data) {
        return ctx.reply('⚠️ Sesi konfirmasi jadwal telah kedaluwarsa. Silakan ketik perintah kembali.');
      }

      const created = await jobRegistryService.createJob(
        {
          name: data.name,
          description: `Dibuat secara otomatis melalui pesan percakapan oleh ${ctx.user?.name || 'User'}`,
          jobType: data.jobType,
          scheduleType: data.scheduleType || 'cron',
          scheduleExpression: data.scheduleExpression,
          timezone: 'Asia/Jakarta',
          targetRoles: data.targetRoles || ['OWNER', 'MANAGER'],
          timeoutSeconds: 60,
          retryLimit: 3,
          payload: data.payload || {},
        },
        {
          type: 'USER',
          id: String(ctx.user?.id || 'telegram'),
          name: ctx.user?.name || 'User',
        }
      );

      const kb = new InlineKeyboard()
        .text('🔍 Lihat Detail', `job_detail:${created.id}`);

      const reminderInfo = data.payload?.message ? `\n<b>Pesan Pengingat:</b> <i>"${esc(data.payload.message)}"</i>` : '';

      return ctx.editMessageText(
        `🎉 <b>Jadwal Berhasil Diaktifkan!</b>\n\n` +
        `Pengingat untuk <b>"${esc(created.name)}"</b> sudah aktif ya.\n` +
        `Jadwal eksekusi: <b>${formatWib(created.nextRunAt)}</b>.\n\n` +
        `Sistem akan mengingatkan Anda secara otomatis tepat pada waktu tersebut.`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (err) {
      return ctx.reply(`❌ Gagal menyimpan jadwal: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery(/^(?:job_action|ai_action):cancel$/, async (ctx) => {
    await ctx.answerCallbackQuery('Dibatalkan').catch(() => {});
    try {
      await ctx.editMessageText('❌ <i>Pembuatan jadwal/pengingat dibatalkan.</i>', { parse_mode: 'HTML' });
    } catch {
      await ctx.deleteMessage().catch(() => {});
    }
  });

  bot.callbackQuery(/^job_runs:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = parseInt(ctx.match[1]);
    const page = parseInt(ctx.match[2]) || 1;
    await renderJobRuns(ctx, id, page, true);
  });
}

/**
 * Render daftar jobs dengan pagination
 */
export async function renderJobsList(ctx, page = 1, isEdit = false) {
  const limit = 5;
  const result = await jobRegistryService.listJobs({ page, limit });
  const { items, pagination } = result;

  if (items.length === 0) {
    const text = '📭 <b>Belum ada jadwal cron yang terdaftar.</b>\nKlik tombol di bawah untuk membuat jadwal baru:';
    const emptyKb = new InlineKeyboard().text('➕ Buat Jadwal Baru', 'job:create_wizard');
    if (isEdit) return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: emptyKb });
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: emptyKb });
  }

  let text = `⏰ <b>DAFTAR JADWAL CRON KOMAZI</b> (Hal ${pagination.page}/${pagination.totalPages})\n━━━━━━━━━━━━━━━━━━\n`;

  const keyboard = new InlineKeyboard();

  items.forEach((j) => {
    const badge = getStatusBadge(j);
    text += `<b>#${j.id} [${j.jobType}] ${esc(j.name)}</b>\n`;
    text += `• Status: ${badge}\n`;
    text += `• Jadwal: <code>${esc(j.scheduleExpression)}</code> (${j.scheduleType})\n`;
    text += `• Berikutnya: <i>${formatWib(j.nextRunAt)}</i>\n\n`;

    keyboard.text(`🔍 #${j.id}`, `job_detail:${j.id}`);
  });
  keyboard.row();

  // Tombol navigasi pagination
  if (pagination.page > 1) {
    keyboard.text('⬅️ Sebelumnya', `jobs_page:${pagination.page - 1}`);
  }
  if (pagination.page < pagination.totalPages) {
    keyboard.text('Berikutnya ➡️', `jobs_page:${pagination.page + 1}`);
  }
  keyboard.row();
  keyboard.text('➕ Buat Jadwal Baru (Wizard)', 'job:create_wizard');

  text += `<i>Total: ${pagination.total} jadwal terdaftar. Klik tombol di bawah untuk detail atau tambah jadwal.</i>`;

  if (isEdit) {
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Render detail satu job
 */
async function renderJobDetail(ctx, id, isEdit = false) {
  try {
    const { job, recentRuns } = await openclawAutomationAdapter.getJobDetail(id);

    const badge = getStatusBadge(job);
    const targetRoles = Array.isArray(job.targetRoles) ? job.targetRoles.join(', ') : '-';

    let text = `
🔍 <b>DETAIL JADWAL CRON #${job.id}</b>
━━━━━━━━━━━━━━━━━━
<b>Nama:</b> ${esc(job.name)}
<b>Tipe:</b> <code>${job.jobType}</code>
<b>Status:</b> ${badge}
<b>Deskripsi:</b> ${esc(job.description || '-')}

<b>Pengaturan Waktu:</b>
• Pola: <code>${esc(job.scheduleExpression)}</code> (${job.scheduleType})
• Zona Waktu: <code>${job.timezone}</code>
• Terakhir Jalan: ${formatWib(job.lastRunAt)}
• Jadwal Berikutnya: <b>${formatWib(job.nextRunAt)}</b>

<b>Pengaturan Eksekusi:</b>
• Batas Timeout: ${job.timeoutSeconds} detik
• Batas Retry: ${job.retryLimit}x
• Target Role: <code>${targetRoles}</code>
    `.trim();

    if (recentRuns.length > 0) {
      text += `\n\n<b>3 Eksekusi Terakhir:</b>\n`;
      recentRuns.slice(0, 3).forEach((r) => {
        const runBadge = getRunStatusBadge(r.status);
        const duration = r.finishedAt && r.startedAt ? `${r.finishedAt - r.startedAt}ms` : '-';
        text += `• Run #${r.id}: ${runBadge} (${formatWib(r.startedAt)}, ${duration})\n`;
      });
    }

    const keyboard = new InlineKeyboard();

    keyboard.text('▶️ Jalankan Sekarang', `job_run:${job.id}`);
    if (job.enabled) {
      keyboard.text('⏸ Jeda', `job_pause:${job.id}`);
      keyboard.text('⏭️ Lewati', `job_skip:${job.id}`);
    } else {
      keyboard.text('▶️ Lanjutkan', `job_resume:${job.id}`);
    }
    keyboard.row();
    keyboard.text('✏️ Ubah Jadwal', `job_edit_prompt:${job.id}`);
    keyboard.text('🗑️ Hapus', `job_del_confirm:${job.id}`);
    keyboard.row();
    keyboard.text('📋 Riwayat Eksekusi', `job_runs:${job.id}:1`);
    keyboard.text('⬅️ Kembali ke List', 'jobs_page:1');

    if (isEdit) {
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    const errText = `❌ Gagal mengambil detail jadwal #${id}: ${esc(err.message)}`;
    if (isEdit) return ctx.editMessageText(errText, { parse_mode: 'HTML' });
    return ctx.reply(errText, { parse_mode: 'HTML' });
  }
}

/**
 * Render riwayat eksekusi job (JobRun)
 */
async function renderJobRuns(ctx, jobId, page = 1, isEdit = false) {
  try {
    const limit = 5;
    const { items, pagination } = await openclawAutomationAdapter.getJobRuns(jobId, { page, limit });

    if (items.length === 0) {
      const text = `📋 <b>Belum ada riwayat eksekusi untuk Jadwal #${jobId}.</b>`;
      const kb = new InlineKeyboard().text('⬅️ Kembali', `job_detail:${jobId}`);
      if (isEdit) return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }

    let text = `📋 <b>RIWAYAT EKSEKUSI JADWAL #${jobId}</b> (Hal ${pagination.page}/${pagination.totalPages})\n━━━━━━━━━━━━━━━━━━\n`;

    items.forEach((r) => {
      const statusBadge = getRunStatusBadge(r.status);
      const duration = r.finishedAt && r.startedAt ? `${r.finishedAt - r.startedAt}ms` : '-';
      text += `<b>Run #${r.id}</b> — ${statusBadge}\n`;
      text += `• Waktu: ${formatWib(r.startedAt)}\n`;
      text += `• Durasi: ${duration} (Percobaan #${r.attempt})\n`;
      if (r.errorMessageRedacted) {
        text += `• Error: <i>${esc(r.errorMessageRedacted.slice(0, 80))}</i>\n`;
      }
      text += `\n`;
    });

    const keyboard = new InlineKeyboard();
    if (pagination.page > 1) {
      keyboard.text('⬅️ Prev', `job_runs:${jobId}:${pagination.page - 1}`);
    }
    if (pagination.page < pagination.totalPages) {
      keyboard.text('Next ➡️', `job_runs:${jobId}:${pagination.page + 1}`);
    }
    keyboard.row();
    keyboard.text('⬅️ Kembali ke Detail', `job_detail:${jobId}`);

    if (isEdit) {
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    const errText = `❌ Gagal mengambil riwayat eksekusi: ${esc(err.message)}`;
    if (isEdit) return ctx.editMessageText(errText, { parse_mode: 'HTML' });
    return ctx.reply(errText, { parse_mode: 'HTML' });
  }
}

/**
 * Eksekusi job on-demand / manual
 */
async function executeJobManualTrigger(ctx, id) {
  const loadingMsg = await ctx.reply(`⏳ <b>Memicu eksekusi manual untuk Jadwal #${id}...</b>`, {
    parse_mode: 'HTML',
  });

  try {
    const startTime = Date.now();
    const result = await jobRunnerService.triggerManualRun(id, {
      type: 'USER',
      id: String(ctx.user?.id || ctx.from?.id),
      name: ctx.user?.name || ctx.from?.first_name || 'User',
    });
    const duration = Date.now() - startTime;

    if (result.skipped) {
      return ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `⚠️ <b>Eksekusi Ditangguhkan</b>\nJadwal #${id} sedang berjalan di worker lain (idempotent dedupe).`,
        { parse_mode: 'HTML' }
      );
    }

    if (result.success) {
      return ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `✅ <b>Eksekusi Manual Berhasil!</b>\n━━━━━━━━━━━━━━━━━━\n<b>Jadwal:</b> #${id}\n<b>Run ID:</b> #${result.runId}\n<b>Durasi:</b> ${duration}ms\n\nNotifikasi hasil telah diteruskan ke channel terkait.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔍 Lihat Detail', `job_detail:${id}`),
        }
      );
    }

    if (result.willRetry) {
      return ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `🔄 <b>Eksekusi Mengalami Kendala (Dalam Antrean Retry)</b>\nPercobaan #${result.attempt} gagal. Dijadwalkan coba ulang otomatis.`,
        { parse_mode: 'HTML' }
      );
    }

    return ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      `❌ <b>Eksekusi Gagal Total:</b>\n${esc(result.error || 'Terjadi kesalahan sistem.')}`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    return ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      `❌ <b>Gagal Memicu Jadwal #${id}:</b>\n${esc(err.message)}`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Render menu panduan /cron (Section 5.4)
 */
export function renderCronHelpMenu(ctx) {
  const text = `
⏰ <b>KOMAZI CRON & AUTOMATION CONTROL (/cron)</b>
━━━━━━━━━━━━━━━━━━
Kelola seluruh tugas terjadwal, pengingat, backup, dan laporan otomatis.

<b>📋 Perintah Cepat:</b>
• <code>/cron buat</code> — Mulai panduan interaktif pembuatan jadwal
• <code>/cron saya</code> — Daftar semua jadwal aktif milik kedai
• <code>/cron detail &lt;id&gt;</code> — Detail konfigurasi & riwayat eksekusi
• <code>/cron jeda &lt;id&gt;</code> — Nonaktifkan jadwal sementara
• <code>/cron aktifkan &lt;id&gt;</code> — Aktifkan kembali jadwal
• <code>/cron ubah &lt;id&gt; &lt;ekspresi&gt;</code> — Ubah waktu/frekuensi
• <code>/cron hapus &lt;id&gt;</code> — Hapus jadwal dengan konfirmasi
• <code>/cron jalankan &lt;id&gt;</code> — Eksekusi manual sekarang
• <code>/cron lewati &lt;id&gt;</code> — Lewati jadwal occurrence berikutnya
• <code>/cron riwayat &lt;id&gt;</code> — Log hasil eksekusi terakhir
• <code>/cron batal</code> — Batalkan percakapan berjalan

<b>💡 Bahasa Alami (Tanpa Garis Miring):</b>
Anda juga dapat langsung mengetik di chat:
• <i>"Kirim ringkasan transaksi setiap hari jam 22.00"</i>
• <i>"Ingatkan aku setiap jam 7 malam untuk cek stok susu"</i>
• <i>"Cek status layanan setiap 15 menit"</i>
━━━━━━━━━━━━━━━━━━
<i>Didukung oleh Komazi POS Enterprise Automation Engine</i>
  `.trim();

  const kb = new InlineKeyboard()
    .text('➕ Buat Jadwal Baru', 'job:create_wizard')
    .text('📋 Daftar Jadwal', 'go:jobs')
    .row()
    .text('🛡️ Status Sentinel', 'sentinel_action:refresh');

  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

/**
 * Render prompt pengubahan jadwal
 */
export function renderJobEditPrompt(ctx, id, isEdit = false) {
  const text = `
✏️ <b>UBAH JADWAL CRON #${id}</b>
━━━━━━━━━━━━━━━━━━
Pilih preset frekuensi di bawah atau ketik perintah perubahan:
<code>/cron ubah ${id} &lt;ekspresi_cron&gt;</code>

<b>Contoh Sintaks:</b>
• <code>/cron ubah ${id} 0 20 * * *</code> (Setiap hari jam 20:00 WIB)
• <code>/cron ubah ${id} 0 22 * * *</code> (Setiap hari jam 22:00 WIB)
• <code>/cron ubah ${id} 30m</code> (Setiap 30 menit)
• <code>/cron ubah ${id} 1h</code> (Setiap 1 jam)
  `.trim();

  const kb = new InlineKeyboard()
    .text('🕒 Tiap Jam 20:00', `job_preset_edit:${id}:0 20 * * *`)
    .text('🌙 Tiap Jam 22:00', `job_preset_edit:${id}:0 22 * * *`)
    .row()
    .text('⏱️ Tiap 30 Menit', `job_preset_edit:${id}:30m`)
    .text('⌛ Tiap 1 Jam', `job_preset_edit:${id}:1h`)
    .row()
    .text('⬅️ Batal / Kembali', `job_detail:${id}`);

  if (isEdit) {
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  }
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}
