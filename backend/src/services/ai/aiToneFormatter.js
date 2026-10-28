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
/**
 * Format nama panggilan resmi berbasis role akun.
 * Mengabaikan nama placeholder seperti "User" atau "Admin" agar tidak muncul "Owner User".
 */
export function formatFriendlySalutation(user) {
  if (!user) return 'Rekan Komazi';
  const role = (user.role || '').toUpperCase();
  const rawName = user.name || user.first_name || '';
  let firstName = rawName.trim().split(' ')[0] || '';

  // Abaikan nama generik / placeholder sistem
  if (['user', 'admin', 'administrator', 'null', 'undefined'].includes(firstName.toLowerCase())) {
    firstName = '';
  }

  const roleNameMap = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    CASHIER: 'Kasir',
    BARISTA: 'Barista',
    KITCHEN: 'Kitchen',
    STAFF: 'Staf',
  };
  const roleLabel = roleNameMap[role] || (firstName ? '' : 'Rekan Komazi');
  return roleLabel ? (firstName ? `${roleLabel} ${firstName}` : roleLabel) : firstName;
}

/**
 * Mengonversi tabel markdown (| Col1 | Col2 |) menjadi tabel monospace teks rapi untuk Telegram (<pre>...</pre>)
 */
export function formatMarkdownTables(text) {
  if (!text || typeof text !== 'string') return text;

  const lines = text.split('\n');
  const result = [];
  let tableLines = [];
  let inTable = false;

  function flushTable() {
    if (tableLines.length === 0) return;

    // Pastikan validitas tabel markdown: harus ada pemisah baris (|---|---|)
    const hasSeparator = tableLines.some((l) => /^\s*\|?[\s:\-]+\|[\s:\-|]+\s*$/.test(l));
    if (!hasSeparator || tableLines.length < 2) {
      result.push(...tableLines);
      tableLines = [];
      return;
    }

    const parsedRows = [];
    for (const rawLine of tableLines) {
      if (/^\s*\|?[\s:\-]+\|[\s:\-|]+\s*$/.test(rawLine)) continue;
      const trimmed = rawLine.trim().replace(/^\|/, '').replace(/\|$/, '');
      const cells = trimmed.split('|').map((c) => c.trim());
      if (cells.length > 0) {
        parsedRows.push(cells);
      }
    }

    if (parsedRows.length === 0) {
      result.push(...tableLines);
      tableLines = [];
      return;
    }

    const numCols = Math.max(...parsedRows.map((r) => r.length));
    const colWidths = new Array(numCols).fill(0);

    for (const row of parsedRows) {
      for (let c = 0; c < numCols; c++) {
        const cellText = row[c] || '';
        colWidths[c] = Math.max(colWidths[c], cellText.length);
      }
    }

    const formattedRows = [];
    for (let r = 0; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      const paddedCells = [];
      for (let c = 0; c < numCols; c++) {
        const cell = row[c] || '';
        const isNumeric = /^(Rp\s*[\d.,]+|\d+(\s*transaksi|\s*item|\s*porsi)?|[\d.,]+)$/i.test(cell);
        const padWidth = colWidths[c];
        if (isNumeric && c > 0) {
          paddedCells.push(cell.padStart(padWidth, ' '));
        } else {
          paddedCells.push(cell.padEnd(padWidth, ' '));
        }
      }
      formattedRows.push(paddedCells.join(' │ '));

      if (r === 0 && parsedRows.length > 1) {
        const divider = colWidths.map((w) => '─'.repeat(w)).join('─┼─');
        formattedRows.push(divider);
      }
    }

    result.push('<pre>\n' + formattedRows.join('\n') + '\n</pre>');
    tableLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = /^\s*\|.*\|\s*$/.test(line);

    if (isTableLine) {
      inTable = true;
      tableLines.push(line);
    } else {
      if (inTable) {
        flushTable();
        inTable = false;
      }
      result.push(line);
    }
  }

  if (inTable) {
    flushTable();
  }

  return result.join('\n');
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
        `Nanti pada <b>${esc(timeDesc)}</b> Komazi akan langsung ingatkan di chat ini. ` +
        `Ada tugas atau jadwal lain yang perlu dicatat?`
      );
    }

    return (
      `Siap, ${salutation}! Komazi sudah siapkan pengingat untuk <b>"${esc(taskName)}"</b> pada <b>${esc(timeDesc)}</b>.\n\n` +
      `Mau langsung Komazi aktifkan pengingat ini?`
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
      `Baik, ${salutation}! Komazi siap mengirimkan laporan penjualan berkala pada <b>${esc(timeDesc)}</b>.\n\n` +
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
    `Mau langsung Komazi aktifkan sekarang?`
  );
}

/**
 * Format konfirmasi penambahan jadwal shift kerja staf HRIS
 */
export function formatStaffShiftSuccessReply(staffName, shiftName, dateText, hoursText, salutation = 'Owner') {
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
export function formatScheduleErrorReply(message, salutation = 'Rekan') {
  return (
    `Waduh maaf, ${salutation}. Penjadwalan belum bisa disimpan:\n` +
    `<i>${esc(message)}</i>\n\n` +
    `Bisa coba beri tahu Komazi dengan format waktu yang lebih jelas ya?`
  );
}
