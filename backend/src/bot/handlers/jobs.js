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
import {
  formatCronToIndonesian,
  parseHumanScheduleInput,
  formatJobTypeIndonesian,
  formatTargetRolesIndonesian,
} from '../../services/cron/cronHumanizer.js';

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
            '⚠️ Format: <code>/cron ubah &lt;id&gt; &lt;waktu_baru&gt;</code>\nContoh:\n• <code>/cron ubah 1 20:00</code> (tiap 20:00 WIB)\n• <code>/cron ubah 1 30m</code> (tiap 30 menit)',
            { parse_mode: 'HTML' }
          );
        }

        const rawTimeInput = restArgs ? `${parts[2]} ${parts.slice(3).join(' ')}`.trim() : '';
        if (!rawTimeInput) {
          return renderJobEditPrompt(ctx, id);
        }

        try {
          const parsed = parseHumanScheduleInput(rawTimeInput);
          if (!parsed) {
            return ctx.reply(
              `⚠️ Format waktu <i>"${esc(rawTimeInput)}"</i> tidak dikenali.\n\n` +
              `<b>Contoh Format Mudah:</b>\n` +
              `• <code>/cron ubah ${id} 20:00</code> (Setiap hari jam 20:00 WIB)\n` +
              `• <code>/cron ubah ${id} 22:00</code> (Setiap hari jam 22:00 WIB)\n` +
              `• <code>/cron ubah ${id} 08:30</code> (Setiap hari jam 08:30 WIB)\n` +
              `• <code>/cron ubah ${id} tiap 30 menit</code> (atau <code>30m</code>)\n` +
              `• <code>/cron ubah ${id} tiap 1 jam</code> (atau <code>1h</code>)\n` +
              `• <code>/cron ubah ${id} tiap senin 09:00</code>`,
              { parse_mode: 'HTML' }
            );
          }

          const updated = await jobRegistryService.updateJob(
            id,
            { scheduleType: parsed.scheduleType, scheduleExpression: parsed.scheduleExpression },
            { type: 'USER', id: String(ctx.user.id), name: ctx.user.name }
          );

          const humanSchedule = formatCronToIndonesian(updated.scheduleExpression, updated.scheduleType);

          return ctx.reply(
            `✅ <b>Jadwal #${updated.id} Berhasil Diubah!</b>\n━━━━━━━━━━━━━━━━━━\n• Waktu Baru: <b>${esc(humanSchedule)}</b>\n• Eksekusi Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
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
          `⚠️ <b>Konfirmasi Penghapusan Jadwal #${id}</b>\n━━━━━━━━━━━━━━━━━━\nNama: <b>${esc(job.name)}</b>\nJenis Tugas: <b>${esc(formatJobTypeIndonesian(job.jobType))}</b>\nWaktu: <b>${esc(formatCronToIndonesian(job.scheduleExpression, job.scheduleType))}</b>\n\nApakah Anda yakin ingin menonaktifkan & menghapus jadwal ini?`,
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
            `⏭️ <b>Jadwal Pengiriman #${id} Berhasil Dilewati!</b>\n━━━━━━━━━━━━━━━━━━\n• Jadwal yang Dilewati: <i>${formatWib(result.skippedRunAt)}</i>\n• Jadwal Pengiriman Berikutnya: <b>${formatWib(result.nextRunAt)}</b>`,
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
        `✅ <b>Jadwal Berhasil Dibuat!</b>\n━━━━━━━━━━━━━━━━━━\n<b>ID:</b> #${created.id}\n<b>Nama:</b> ${esc(created.name)}\n<b>Jenis Tugas:</b> <b>${esc(formatJobTypeIndonesian(created.jobType))}</b>\n<b>Waktu:</b> <b>${esc(formatCronToIndonesian(created.scheduleExpression, created.scheduleType))}</b>\n<b>Jadwal Berikutnya:</b> ${formatWib(created.nextRunAt)}\n\nKetik <code>/job_show ${created.id}</code> untuk memeriksa konfigurasi lengkap.`,
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
      return ctx.reply(`⏸ <b>Jadwal #${updated.id} Berhasil Dijeda.</b>\nNama: <b>${esc(updated.name)}</b>`, {
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
⚙️ <b>PANDUAN JADWAL OTOMATIS KOMAZI</b>
━━━━━━━━━━━━━━━━━━
<b>📋 Format Perintah Cepat:</b>
• <code>/jobs [halaman]</code> — Daftar seluruh jadwal tugas aktif & status
• <code>/job_show &lt;id&gt;</code> — Detail konfigurasi & waktu tugas
• <code>/job_create</code> — Panduan interaktif buat jadwal baru
• <code>/job_pause &lt;id&gt;</code> — Jeda jadwal tugas sementara
• <code>/job_resume &lt;id&gt;</code> — Aktifkan kembali jadwal tugas
• <code>/job_cancel &lt;id&gt;</code> — Hapus/batalkan jadwal
• <code>/job_run &lt;id&gt;</code> — Jalankan tugas sekarang juga
• <code>/job_runs &lt;id&gt; [halaman]</code> — Riwayat pengiriman tugas
• <code>/job_help</code> — Panduan ini

<b>🎯 Jenis Tugas yang Didukung:</b>
1. <b>Laporan Penjualan (REPORT)</b> — Pengiriman otomatis ringkasan penjualan & omzet
2. <b>Pencadangan Data (BACKUP)</b> — Salinan cadangan aman data transaksi & inventaris POS
3. <b>Pemantauan Sistem (MONITORING)</b> — Cek koneksi server, database & kesiapan kasir
4. <b>Pengingat Tugas (REMINDER)</b> — Pengingat tugas operasional ke tim staf kedai
5. <b>Analisis Cerdas AI (AI_TASK)</b> — Proyeksi jam sibuk & rekomendasi stok dari Komazi AI
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
        `⏭️ <b>Jadwal Pengiriman #${id} Berhasil Dilewati!</b>\n━━━━━━━━━━━━━━━━━━\n• Dilewati: <i>${formatWib(result.skippedRunAt)}</i>\n• Eksekusi Berikutnya: <b>${formatWib(result.nextRunAt)}</b>`,
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
    const rawExpr = ctx.match[2].trim();

    try {
      const parsed = parseHumanScheduleInput(rawExpr);
      if (!parsed) {
        throw new Error(`Pilihan jadwal '${rawExpr}' tidak dikenali.`);
      }

      const updated = await jobRegistryService.updateJob(
        id,
        { scheduleType: parsed.scheduleType, scheduleExpression: parsed.scheduleExpression },
        { type: 'USER', id: String(ctx.user?.id || 'telegram'), name: ctx.user?.name || 'User' }
      );

      const humanSchedule = formatCronToIndonesian(updated.scheduleExpression, updated.scheduleType);

      await ctx.editMessageText(
        `✅ <b>Jadwal #${updated.id} Berhasil Diperbarui!</b>\n━━━━━━━━━━━━━━━━━━\n• Waktu Baru: <b>${esc(humanSchedule)}</b>\n• Eksekusi Berikutnya: <b>${formatWib(updated.nextRunAt)}</b>`,
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
      `⚠️ <b>Konfirmasi Penghapusan Jadwal #${id}</b>\n━━━━━━━━━━━━━━━━━━\nNama: <b>${esc(job.name)}</b>\nJenis Tugas: <b>${esc(formatJobTypeIndonesian(job.jobType))}</b>\nWaktu: <b>${esc(formatCronToIndonesian(job.scheduleExpression, job.scheduleType))}</b>\n\nApakah Anda yakin ingin menonaktifkan & menghapus jadwal ini?`,
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
    const text = '📭 <b>Belum ada jadwal tugas otomatis yang terdaftar.</b>\nKlik tombol di bawah untuk membuat jadwal baru:';
    const emptyKb = new InlineKeyboard().text('➕ Buat Jadwal Baru', 'job:create_wizard');
    if (isEdit) return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: emptyKb });
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: emptyKb });
  }

  let text = `⏰ <b>DAFTAR JADWAL TUGAS OTOMATIS</b> (Hal ${pagination.page}/${pagination.totalPages})\n━━━━━━━━━━━━━━━━━━\n`;

  const keyboard = new InlineKeyboard();

  items.forEach((j) => {
    const badge = getStatusBadge(j);
    const humanSchedule = formatCronToIndonesian(j.scheduleExpression, j.scheduleType);
    const typeLabel = formatJobTypeIndonesian(j.jobType);
    text += `<b>#${j.id} [${typeLabel}] ${esc(j.name)}</b>\n`;
    text += `• Status: ${badge}\n`;
    text += `• Waktu: <b>${esc(humanSchedule)}</b>\n`;
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

  text += `<i>Total: ${pagination.total} jadwal terdaftar. Klik tombol di bawah untuk detail atau tambah jadwal.</i>\n\n🤖 <i>@komazi-assistant</i>`;

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
    const humanSchedule = formatCronToIndonesian(job.scheduleExpression, job.scheduleType);

    let text = `
🔍 <b>DETAIL JADWAL #${job.id}</b>
━━━━━━━━━━━━━━━━━━
<b>Nama:</b> ${esc(job.name)}
<b>Jenis Tugas:</b> <b>${esc(formatJobTypeIndonesian(job.jobType))}</b>
<b>Status:</b> ${badge}
<b>Deskripsi:</b> ${esc(job.description || '-')}

<b>Pengaturan Waktu:</b>
• Waktu Pelaksanaan: <b>${esc(humanSchedule)}</b>
• Zona Waktu: <code>${job.timezone}</code>
• Terakhir Jalan: ${formatWib(job.lastRunAt)}
• Jadwal Berikutnya: <b>${formatWib(job.nextRunAt)}</b>

<b>Pengaturan Pelaksanaan:</b>
• Penerima Notifikasi: <b>${esc(formatTargetRolesIndonesian(job.targetRoles))}</b>
• Waktu Tunggu Maksimal: ${job.timeoutSeconds} detik
• Percobaan Ulang: ${job.retryLimit > 0 ? `${job.retryLimit} kali jika gagal` : 'Tidak ada'}
━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
    `.trim();

    if (recentRuns.length > 0) {
      text += `\n\n<b>3 Pengiriman Terakhir:</b>\n`;
      recentRuns.slice(0, 3).forEach((r) => {
        const runBadge = getRunStatusBadge(r.status);
        text += `• Riwayat #${r.id}: ${runBadge} (${formatWib(r.startedAt)})\n`;
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
      const text = `📋 <b>Belum ada riwayat pengiriman untuk Jadwal #${jobId}.</b>`;
      const kb = new InlineKeyboard().text('⬅️ Kembali', `job_detail:${jobId}`);
      if (isEdit) return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }

    let text = `📋 <b>RIWAYAT PENGIRIMAN JADWAL #${jobId}</b> (Hal ${pagination.page}/${pagination.totalPages})\n━━━━━━━━━━━━━━━━━━\n`;

    items.forEach((r) => {
      const statusBadge = getRunStatusBadge(r.status);
      text += `<b>Riwayat #${r.id}</b> — ${statusBadge}\n`;
      text += `• Waktu: ${formatWib(r.startedAt)}\n`;
      text += `• Percobaan: Ke-${r.attempt}\n`;
      if (r.errorMessageRedacted) {
        text += `• Catatan: <i>${esc(r.errorMessageRedacted.slice(0, 80))}</i>\n`;
      }
      text += `\n`;
    });
    text += `🤖 <i>@komazi-assistant</i>\n`;

    const keyboard = new InlineKeyboard();
    if (pagination.page > 1) {
      keyboard.text('⬅️ Sebelumnya', `job_runs:${jobId}:${pagination.page - 1}`);
    }
    if (pagination.page < pagination.totalPages) {
      keyboard.text('Berikutnya ➡️', `job_runs:${jobId}:${pagination.page + 1}`);
    }
    keyboard.row();
    keyboard.text('⬅️ Kembali ke Detail', `job_detail:${jobId}`);

    if (isEdit) {
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    const errText = `❌ Gagal mengambil riwayat pengiriman: ${esc(err.message)}`;
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
        `⚠️ <b>Tugas Sedang Berjalan</b>\nJadwal #${id} saat ini sedang aktif diproses oleh sistem.`,
        { parse_mode: 'HTML' }
      );
    }

    if (result.success) {
      return ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `✅ <b>Tugas Berhasil Dijalankan!</b>\n━━━━━━━━━━━━━━━━━━\n<b>Jadwal:</b> #${id}\n<b>Status:</b> Selesai ✅\n\nLaporan / pengingat telah diteruskan ke penerima terkait.`,
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
        `🔄 <b>Tugas Mengalami Kendala</b>\nPercobaan ke-${result.attempt} belum berhasil. Sistem akan mencoba kembali secara otomatis.`,
        { parse_mode: 'HTML' }
      );
    }

    return ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      `❌ <b>Tugas Gagal Dijalankan:</b>\n${esc(result.error || 'Terjadi kesalahan sistem.')}`,
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
⏰ <b>PENGATURAN JADWAL OTOMATIS & PENGINGAT (/cron)</b>
━━━━━━━━━━━━━━━━━━
Kelola seluruh tugas terjadwal, pengingat operasional, cadangan data, dan laporan otomatis.

<b>📋 Perintah Cepat:</b>
• <code>/cron buat</code> — Buat jadwal tugas baru dengan panduan interaktif
• <code>/cron saya</code> — Daftar seluruh jadwal aktif kedai
• <code>/cron detail &lt;id&gt;</code> — Detail konfigurasi & riwayat pengiriman
• <code>/cron jeda &lt;id&gt;</code> — Nonaktifkan jadwal sementara
• <code>/cron aktifkan &lt;id&gt;</code> — Aktifkan kembali jadwal yang dijeda
• <code>/cron ubah &lt;id&gt; &lt;waktu&gt;</code> — Ubah waktu/jam pelaksanaan (cth: 20:00, 30m, 1h)
• <code>/cron hapus &lt;id&gt;</code> — Hapus jadwal tugas
• <code>/cron jalankan &lt;id&gt;</code> — Jalankan tugas sekarang juga
• <code>/cron lewati &lt;id&gt;</code> — Lewati pengiriman jadwal berikutnya
• <code>/cron riwayat &lt;id&gt;</code> — Lihat catatan pengiriman tugas
• <code>/cron batal</code> — Batalkan percakapan berjalan

<b>💡 Menjadwalkan Dengan Bahasa Sehari-hari:</b>
Anda juga dapat langsung mengetik di chat:
• <i>"Kirim ringkasan transaksi setiap hari jam 22.00"</i>
• <i>"Ingatkan aku setiap jam 7 malam untuk cek stok susu"</i>
• <i>"Cek status layanan setiap 15 menit"</i>
━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
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
✏️ <b>UBAH WAKTU JADWAL #${id}</b>
━━━━━━━━━━━━━━━━━━
Pilih preset waktu di bawah atau ketik perintah perubahan:
<code>/cron ubah ${id} &lt;jam_atau_frekuensi&gt;</code>

<b>💡 Format Yang Didukung:</b>
• <b>Jam Spesifik:</b> <code>/cron ubah ${id} 20:00</code> (atau <code>20.00</code> / <code>jam 20:00</code>)
• <b>Hari Tertentu:</b> <code>/cron ubah ${id} tiap senin 09:00</code>
• <b>Interval Menit:</b> <code>/cron ubah ${id} 30m</code> (atau <code>tiap 30 menit</code>)
• <b>Interval Jam:</b> <code>/cron ubah ${id} 1h</code> (atau <code>tiap 1 jam</code>)
  `.trim();

  const kb = new InlineKeyboard()
    .text('🕒 Tiap Jam 20:00', `job_preset_edit:${id}:20:00`)
    .text('🌙 Tiap Jam 22:00', `job_preset_edit:${id}:22:00`)
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
