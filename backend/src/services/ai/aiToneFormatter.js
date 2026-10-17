/**
 * Conversational Tone & Anti-Developer Log Formatter untuk Komazi AI.
 * Mengubah data jadwal, pengingat, dan status sistem menjadi narasi
 * bahasa Indonesia yang santai, ramah, dan manusiawi layaknya asisten kedai kopi.
 *
 * Menghilangkan:
 * - Monospace kode cron (misal: `<code>0 22 * * *</code>`)
 * - Badge status variabel mentah (misal: `Tipe: REMINDER (cron)`)
 * - Header kartu log pengembang (misal: `✨ DETEKSI JADWAL OTOMATIS`)
 */

import { esc } from '../../bot/utils/format.js';

/**
 * Format nama panggilan sopan dan akrab
 */
export function formatFriendlySalutation(user) {
  if (!user) return 'Kak';
  const rawName = user.name || user.first_name || '';
  const firstName = rawName.split(' ')[0] || '';

  if (user.role === 'OWNER' || user.role === 'MANAGER') {
    return firstName ? `Mas ${firstName}` : 'Bos';
  }
  return firstName ? `Kak ${firstName}` : 'Kak';
}

/**
 * Mengubah data jadwal terdeteksi menjadi balasan chatbot yang hangat dan natural.
 * @param {object} schedule
 * @param {object} [options]
 * @param {object} [options.user]
 * @param {boolean} [options.isSaved=false]
 * @returns {string}
 */
export function formatScheduleNaturalReply(schedule, options = {}) {
  const salutation = formatFriendlySalutation(options.user);
  const taskName = schedule.payload?.message || schedule.name || 'tugas operasional';
  const timeDesc = schedule.timeDescription || 'waktu yang ditentukan';

  // 1. Skenario: Pengingat tugas personal atau dapur
  if (schedule.jobType === 'REMINDER') {
    if (options.isSaved) {
      return (
        `Siap, ${salutation}! Pengingat untuk <b>"${esc(taskName)}"</b> sudah aktif ya.\n\n` +
        `Nanti pada <b>${esc(timeDesc)}</b> saya akan langsung ingatkan di chat ini. ` +
        `Ada tugas atau jadwal lain yang perlu dicatat?`
      );
    }

    return (
      `Siap, ${salutation}! Saya sudah siapkan pengingat untuk <b>"${esc(taskName)}"</b> pada <b>${esc(timeDesc)}</b>.\n\n` +
      `Mau langsung saya aktifkan pengingat ini?`
    );
  }

  // 2. Skenario: Laporan Penjualan / Omset Terjadwal
  if (schedule.jobType === 'REPORT') {
    if (options.isSaved) {
      return (
        `Baik, ${salutation}! Laporan penjualan otomatis sudah berhasil dijadwalkan.\n\n` +
        `Rekap omset akan dikirimkan secara berkala pada <b>${esc(timeDesc)}</b>. ` +
        `Semoga operasional outlet makin lancar!`
      );
    }

    return (
      `Baik, ${salutation}! Saya siap mengirimkan laporan penjualan berkala pada <b>${esc(timeDesc)}</b>.\n\n` +
      `Aktifkan jadwal pengiriman laporan ini sekarang?`
    );
  }

  // 3. Skenario: Pencadangan Database / Backup
  if (schedule.jobType === 'BACKUP') {
    if (options.isSaved) {
      return (
        `Beres, ${salutation}! Jadwal backup database sudah aktif.\n\n` +
        `Sistem akan melakukan pencadangan otomatis pada <b>${esc(timeDesc)}</b>.`
      );
    }

    return (
      `Beres, ${salutation}! Jadwal pencadangan data sudah disiapkan untuk <b>${esc(timeDesc)}</b>.\n\n` +
      `Aktifkan jadwal backup ini sekarang?`
    );
  }

  // 4. Skenario: Monitoring / Kesehatan Sistem
  if (schedule.jobType === 'MONITORING') {
    if (options.isSaved) {
      return (
        `Siap, ${salutation}! Pemantauan kesehatan sistem sudah aktif berjalan setiap <b>${esc(timeDesc)}</b>.`
      );
    }

    return (
      `Siap, ${salutation}! Jadwal pemantauan sistem sudah disiapkan untuk <b>${esc(timeDesc)}</b>.\n\n` +
      `Aktifkan jadwal monitoring ini sekarang?`
    );
  }

  // 5. Skenario Umum
  if (options.isSaved) {
    return (
      `Siap, ${salutation}! Jadwal <b>"${esc(schedule.name)}"</b> sudah berhasil diaktifkan.\n\n` +
      `Waktu eksekusi: <b>${esc(timeDesc)}</b>.`
    );
  }

  return (
    `Siap, ${salutation}! Jadwal <b>"${esc(schedule.name)}"</b> untuk <b>${esc(timeDesc)}</b> sudah siap.\n\n` +
    `Mau langsung saya aktifkan sekarang?`
  );
}

/**
 * Format konfirmasi penambahan jadwal shift kerja staf HRIS
 */
export function formatStaffShiftSuccessReply(staffName, shiftName, dateText, hoursText, salutation = 'Bos') {
  return (
    `Siap, ${salutation}! Jadwal kerja untuk <b>${esc(staffName)}</b> sudah berhasil dicatat ke sistem HRIS.\n\n` +
    `📋 <b>Shift:</b> ${esc(shiftName)} (${esc(hoursText)})\n` +
    `📅 <b>Tanggal:</b> ${esc(dateText)}\n\n` +
    `Staf terkait sudah terdaftar dan diizinkan presensi serta membuka sesi kasir pada jadwal tersebut.`
  );
}

/**
 * Format kesalahan jadwal dengan nada santai dan solutif
 */
export function formatScheduleErrorReply(message, salutation = 'Kak') {
  return (
    `Waduh maaf, ${salutation}. Penjadwalan belum bisa disimpan:\n` +
    `<i>${esc(message)}</i>\n\n` +
    `Bisa coba beri tahu saya dengan format waktu yang lebih jelas ya?`
  );
}
