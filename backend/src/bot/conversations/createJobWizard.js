/**
 * Conversation Wizard: Pembuatan Jadwal Cron Tanpa Perlu Mengetik Garis Miring (/).
 * Menghadirkan panduan interaktif visual berbasis tombol & teks bebas.
 */

import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { jobRegistryService } from '../../services/cron/jobRegistryService.js';
import { computeNextRunAt } from '../../services/cron/jobRegistryService.js';
import { esc } from '../utils/format.js';
import logger from '../../utils/logger.js';
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

export async function createJobWizard(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) {
    return ctx.reply('🔒 <b>Akses Terbatas:</b> Akun Telegram Anda belum ditautkan.', { parse_mode: 'HTML' });
  }

  if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
    return ctx.reply('⛔ <b>Akses Terbatas:</b> Fitur pembuatan jadwal hanya dapat diakses oleh Owner atau Manager.', {
      parse_mode: 'HTML',
    });
  }

  // ==========================================
  // LANGKAH 1: PILIH TIPE JADWAL (JOB TYPE)
  // ==========================================
  const kbType = new InlineKeyboard()
    .text('📊 Laporan Penjualan & Omzet', 'wiz_type:REPORT')
    .row()
    .text('💾 Pencadangan Data POS', 'wiz_type:BACKUP')
    .row()
    .text('🛡️ Pemantauan Kesehatan Sistem', 'wiz_type:MONITORING')
    .row()
    .text('⏰ Pengingat Operasional Staf', 'wiz_type:REMINDER')
    .row()
    .text('🤖 Analisis & Prediksi Cerdas AI', 'wiz_type:AI_TASK')
    .row()
    .text('❌ Batal', 'wiz_type:cancel');

  await ctx.reply(
    `✨ <b>PANDUAN PEMBUATAN JADWAL OTOMATIS</b>\n━━━━━━━━━━━━━━━━━━\n<b>Langkah 1 dari 4:</b>\nPilih jenis tugas yang ingin dijalankan secara otomatis:`,
    { parse_mode: 'HTML', reply_markup: kbType }
  );

  const typeCtx = await conversation.waitForCallbackQuery(/^wiz_type:(REPORT|BACKUP|MONITORING|REMINDER|AI_TASK|cancel)$/);
  await typeCtx.answerCallbackQuery().catch(() => {});
  const jobType = typeCtx.callbackQuery.data.split(':')[1];

  if (jobType === 'cancel') {
    return typeCtx.reply('🚫 Proses pembuatan jadwal dibatalkan.');
  }

  // Nama default berdasarkan tipe
  let defaultName = 'Jadwal Otomatis Baru';
  if (jobType === 'REPORT') defaultName = 'Laporan Penjualan Harian';
  if (jobType === 'BACKUP') defaultName = 'Pencadangan Data Penjualan & Inventaris';
  if (jobType === 'MONITORING') defaultName = 'Sentinel Kesehatan Sistem POS';
  if (jobType === 'REMINDER') defaultName = 'Pengingat Operasional Staf';
  if (jobType === 'AI_TASK') defaultName = 'Analisis Performa Komazi AI';

  // ==========================================
  // LANGKAH 2: BERI NAMA JADWAL
  // ==========================================
  const kbName = new InlineKeyboard()
    .text(`⏩ Pakai Nama: "${defaultName}"`, 'wiz_name:default')
    .row()
    .text('❌ Batal', 'wiz_name:cancel');

  await typeCtx.reply(
    `📝 <b>Langkah 2 dari 4: Beri Nama Jadwal</b>\n\nKetik nama jadwal yang mudah dikenali melalui pesan teks, atau klik tombol di bawah untuk menggunakan nama rekomendasi:`,
    { parse_mode: 'HTML', reply_markup: kbName }
  );

  let jobName = defaultName;
  const nameResp = await conversation.waitFor(['message:text', 'callback_query:data']);

  if (nameResp.callbackQuery) {
    await nameResp.answerCallbackQuery().catch(() => {});
    if (nameResp.callbackQuery.data === 'wiz_name:cancel') {
      return nameResp.reply('🚫 Proses pembuatan jadwal dibatalkan.');
    }
    // Menggunakan nama bawaan
    jobName = defaultName;
  } else if (nameResp.message?.text) {
    const textInput = nameResp.message.text.trim();
    if (textInput.toLowerCase() === 'batal') {
      return nameResp.reply('🚫 Proses pembuatan jadwal dibatalkan.');
    }
    jobName = textInput || defaultName;
  }

  // ==========================================
  // LANGKAH 3: PILIH FREKUENSI / WAKTU
  // ==========================================
  const kbTime = new InlineKeyboard()
    .text('🌙 Tutup Toko (22:00 WIB)', 'wiz_time:0 22 * * *')
    .row()
    .text('🌅 Buka Toko (08:00 WIB)', 'wiz_time:0 8 * * *')
    .row()
    .text('☀️ Siang Hari (14:00 WIB)', 'wiz_time:0 14 * * *')
    .row()
    .text('⏳ Setiap 1 Jam Sekali', 'wiz_time:0 * * * *')
    .row()
    .text('⏱️ Setiap 30 Menit Sekali', 'wiz_time:*/30 * * * *')
    .row()
    .text('⌨️ Masukkan Jam Bebas (cth: 19:30)', 'wiz_time:custom')
    .row()
    .text('❌ Batal', 'wiz_time:cancel');

  await ctx.reply(
    `⏰ <b>Langkah 3 dari 4: Tentukan Waktu Pelaksanaan</b>\n\nNama Jadwal: <b>${esc(jobName)}</b>\n\nPilih jadwal waktu yang diinginkan:`,
    { parse_mode: 'HTML', reply_markup: kbTime }
  );

  let cronExpression = '0 22 * * *';
  let timeLabel = 'Setiap hari jam 22:00 WIB';

  const timeCtx = await conversation.waitForCallbackQuery(/^wiz_time:(.+)$/);
  await timeCtx.answerCallbackQuery().catch(() => {});
  const timeChoice = timeCtx.callbackQuery.data.split(':')[1];

  if (timeChoice === 'cancel') {
    return timeCtx.reply('🚫 Proses pembuatan jadwal dibatalkan.');
  }

  if (timeChoice === 'custom') {
    await timeCtx.reply(
      '⌨️ <b>Ketik Waktu yang Diinginkan:</b>\nContoh: <code>19:30</code> atau <code>07:00</code> (Format 24 Jam WIB)',
      { parse_mode: 'HTML' }
    );

    const customMsg = await conversation.waitFor('message:text');
    const inputTime = customMsg.message.text.trim();

    if (inputTime.toLowerCase() === 'batal') {
      return customMsg.reply('🚫 Proses dibatalkan.');
    }

    const parsed = parseHumanScheduleInput(inputTime);
    if (parsed) {
      cronExpression = parsed.scheduleExpression;
      timeLabel = parsed.humanDescription;
    } else {
      cronExpression = '0 22 * * *';
      timeLabel = 'Setiap hari pukul 22:00 WIB (Default)';
    }
  } else {
    cronExpression = timeChoice;
    timeLabel = formatCronToIndonesian(timeChoice, 'cron');
  }

  // ==========================================
  // LANGKAH 4 (Kondisional): PESAN JIKA REMINDER
  // ==========================================
  let reminderPayload = {};
  if (jobType === 'REMINDER') {
    await ctx.reply(
      '✍️ <b>Pesan Pengingat:</b>\nKetik pesan yang ingin disampaikan saat pengingat berbunyi:',
      { parse_mode: 'HTML' }
    );
    const reminderMsg = await conversation.waitFor('message:text');
    const textMsg = reminderMsg.message.text.trim();
    if (textMsg.toLowerCase() === 'batal') {
      return reminderMsg.reply('🚫 Proses dibatalkan.');
    }
    reminderPayload = {
      title: jobName,
      message: textMsg,
    };
  }

  // ==========================================
  // LANGKAH 5: TARGET PENERIMA
  // ==========================================
  const kbRoles = new InlineKeyboard()
    .text('👑 Khusus Owner', 'wiz_role:OWNER')
    .row()
    .text('👔 Owner & Manager', 'wiz_role:OWNER,MANAGER')
    .row()
    .text('👥 Seluruh Tim Staf', 'wiz_role:OWNER,MANAGER,CASHIER')
    .row()
    .text('❌ Batal', 'wiz_role:cancel');

  await ctx.reply(
    `👥 <b>Langkah Terakhir: Target Penerima Notifikasi</b>\nPilih peran staf yang akan menerima hasil eksekusi tugas ini:`,
    { parse_mode: 'HTML', reply_markup: kbRoles }
  );

  const roleCtx = await conversation.waitForCallbackQuery(/^wiz_role:(.+)$/);
  await roleCtx.answerCallbackQuery().catch(() => {});
  const roleChoice = roleCtx.callbackQuery.data.split(':')[1];

  if (roleChoice === 'cancel') {
    return roleCtx.reply('🚫 Proses pembuatan jadwal dibatalkan.');
  }

  const targetRoles = roleChoice.split(',');

  // ==========================================
  // LANGKAH 6: KONFIRMASI RINGKASAN
  // ==========================================
  let previewNextRun;
  try {
    previewNextRun = computeNextRunAt('cron', cronExpression, 'Asia/Jakarta', new Date());
  } catch {
    previewNextRun = new Date();
  }

  const kbConfirm = new InlineKeyboard()
    .text('✅ Simpan & Aktifkan Sekarang', 'wiz_confirm:save')
    .row()
    .text('❌ Batalkan', 'wiz_confirm:cancel');

  const summaryCard = `
📋 <b>KONFIRMASI JADWAL BARU</b>
━━━━━━━━━━━━━━━━━━
<b>Nama:</b> ${esc(jobName)}
<b>Jenis Tugas:</b> <b>${esc(formatJobTypeIndonesian(jobType))}</b>
<b>Waktu Pelaksanaan:</b> <b>${esc(timeLabel)}</b>
<b>Zona Waktu:</b> Asia/Jakarta (WIB)
<b>Penerima Notifikasi:</b> <b>${esc(formatTargetRolesIndonesian(targetRoles))}</b>
<b>Jadwal Perdana:</b> <i>${formatWib(previewNextRun)}</i>
━━━━━━━━━━━━━━━━━━
<i>Simpan dan aktifkan jadwal ini sekarang?</i>
  `.trim();

  await roleCtx.reply(summaryCard, { parse_mode: 'HTML', reply_markup: kbConfirm });

  const confirmCtx = await conversation.waitForCallbackQuery(/^wiz_confirm:(save|cancel)$/);
  await confirmCtx.answerCallbackQuery().catch(() => {});

  if (confirmCtx.callbackQuery.data === 'wiz_confirm:cancel') {
    return confirmCtx.reply('🚫 Pembuatan jadwal dibatalkan.');
  }

  // ==========================================
  // SIMPAN JADWAL KE DATABASE MYSQL
  // ==========================================
  try {
    const created = await conversation.external(async () => {
      return jobRegistryService.createJob(
        {
          name: jobName,
          description: `Dibuat melalui Wizard Dinamis oleh ${user.name}`,
          jobType,
          scheduleType: 'cron',
          scheduleExpression: cronExpression,
          timezone: 'Asia/Jakarta',
          targetRoles,
          timeoutSeconds: 60,
          retryLimit: 3,
          payload: reminderPayload,
        },
        {
          type: 'USER',
          id: String(user.id),
          name: user.name,
        }
      );
    });

    const successKb = new InlineKeyboard()
      .text('🔍 Lihat Detail', `job_detail:${created.id}`)
      .row()
      .text('📋 Lihat Semua Jadwal', 'jobs_page:1');

    return confirmCtx.reply(
      `🎉 <b>JADWAL BERHASIL DIAKTIFKAN!</b>\n━━━━━━━━━━━━━━━━━━\n<b>ID:</b> #${created.id}\n<b>Nama:</b> <b>${esc(created.name)}</b>\n<b>Jadwal Berikutnya:</b> ${formatWib(created.nextRunAt)}\n\nSistem cron background akan otomatis mengeksekusi tugas ini tepat waktu.`,
      { parse_mode: 'HTML', reply_markup: successKb }
    );
  } catch (err) {
    logger.scheduler.error(`[JobWizard] Failed to save job: ${err.message}`);
    return confirmCtx.reply(`❌ <b>Gagal Menyimpan Jadwal:</b>\n${esc(err.message)}`, { parse_mode: 'HTML' });
  }
}
