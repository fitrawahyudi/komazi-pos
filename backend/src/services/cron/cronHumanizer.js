/**
 * Cron Humanizer & Natural Indonesian Schedule Parser.
 * Mengubah ekspresi cron teknis (misal '0 20 * * *' atau '30m') menjadi kalimat bahasa Indonesia
 * yang ramah dan mudah dipahami oleh pemilik kedai (bukan developer).
 * Serta mengurai input waktu manusia (misal '20:00', 'jam 20:00', 'tiap 30 menit')
 * menjadi parameter jadwal standar.
 */

import { CronExpressionParser } from 'cron-parser';

const INDONESIAN_DAYS = {
  '0': 'Minggu',
  '1': 'Senin',
  '2': 'Selasa',
  '3': 'Rabu',
  '4': 'Kamis',
  '5': 'Jumat',
  '6': 'Sabtu',
  '7': 'Minggu',
};

/**
 * Format ekspresi jadwal menjadi kalimat bahasa Indonesia yang manusiawi
 * @param {string} expression - misal '0 20 * * *', '30m', '0 8,20 * * *'
 * @param {string} [scheduleType='cron'] - 'cron' | 'interval' | 'once'
 * @returns {string} Contoh: "Setiap hari pukul 20:00 WIB"
 */
export function formatCronToIndonesian(expression, scheduleType = 'cron') {
  if (!expression) return '-';
  const clean = String(expression).trim();

  // 1. Tipe Once (Satu kali jalan)
  if (scheduleType === 'once') {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return (
        'Sekali jalan pada ' +
        d.toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'medium',
          timeStyle: 'short',
        }) +
        ' WIB'
      );
    }
    return `Sekali jalan (${clean})`;
  }

  // 2. Tipe Interval (e.g. "30m", "1h", "15m", "1d")
  const intervalMatch = clean.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (intervalMatch || scheduleType === 'interval') {
    if (intervalMatch) {
      const val = parseInt(intervalMatch[1], 10);
      const unit = intervalMatch[2].toLowerCase();
      if (unit === 'm') return `Setiap ${val} menit sekali`;
      if (unit === 'h') return val === 1 ? 'Setiap 1 jam sekali' : `Setiap ${val} jam sekali`;
      if (unit === 'd') return val === 1 ? 'Setiap hari (24 jam sekali)' : `Setiap ${val} hari sekali`;
      if (unit === 's') return `Setiap ${val} detik`;
    }
  }

  // 3. Tipe Cron (5 token)
  const parts = clean.split(/\s+/);
  if (parts.length === 5) {
    const [minute, hour, dom, month, dow] = parts;

    // A. Interval via cron: */X * * * *
    if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
      const step = minute.slice(2);
      return `Setiap ${step} menit sekali`;
    }

    // B. Hourly interval: 0 */X * * *
    if (minute === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
      const step = hour.slice(2);
      return `Setiap ${step} jam sekali`;
    }

    // C. Every hour at minute 0: 0 * * * *
    if (minute === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
      return 'Setiap 1 jam sekali';
    }

    // D. Every day at specific time: 0 20 * * *
    if (dom === '*' && month === '*' && dow === '*') {
      // Multiple hours: 0 8,20 * * *
      if (hour.includes(',')) {
        const hours = hour.split(',').map((h) => `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')} WIB`);
        return `Setiap hari pukul ${hours.join(' & ')}`;
      }

      // Hour range: 0 8-22 * * *
      if (hour.includes('-')) {
        const [startH, endH] = hour.split('-');
        return `Setiap jam (mulai ${String(startH).padStart(2, '0')}:00 s/d ${String(endH).padStart(2, '0')}:00 WIB)`;
      }

      // Single specific time
      const hNum = parseInt(hour, 10);
      const mNum = parseInt(minute, 10);
      if (!isNaN(hNum) && !isNaN(mNum)) {
        const timeStr = `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')} WIB`;
        return `Setiap hari pukul ${timeStr}`;
      }
    }

    // E. Weekly at specific time: 0 9 * * 1
    if (dom === '*' && month === '*' && dow !== '*') {
      const hNum = parseInt(hour, 10);
      const mNum = parseInt(minute, 10);
      const dayName = INDONESIAN_DAYS[dow] || `Hari ke-${dow}`;
      if (!isNaN(hNum) && !isNaN(mNum)) {
        const timeStr = `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')} WIB`;
        return `Setiap hari ${dayName} pukul ${timeStr}`;
      }
      return `Setiap hari ${dayName}`;
    }

    // F. Monthly: 0 0 1 * *
    if (dom !== '*' && month === '*' && dow === '*') {
      const hNum = parseInt(hour, 10);
      const mNum = parseInt(minute, 10);
      const timeStr = !isNaN(hNum) && !isNaN(mNum) ? ` pukul ${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')} WIB` : '';
      return `Setiap tanggal ${dom} bulanan${timeStr}`;
    }
  }

  // Fallback
  return `Setiap (${clean})`;
}

/**
 * Mengurai input pengguna menjadi objek jadwal terstruktur
 * Mendukung input santai seperti "20:00", "jam 8 malam", "tiap 30 menit", "1h", dsb.
 * @param {string} rawInput
 * @returns {{ scheduleType: 'cron'|'interval'|'once', scheduleExpression: string, humanDescription: string } | null}
 */
export function parseHumanScheduleInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const input = rawInput.trim();
  const lower = input.toLowerCase();

  // 1. Cek interval ringkas (e.g. "30m", "1h", "15m", "2h", "1d")
  const compactInterval = lower.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (compactInterval) {
    const val = compactInterval[1];
    const unit = compactInterval[2].toLowerCase();
    const expr = `${val}${unit}`;
    return {
      scheduleType: 'interval',
      scheduleExpression: expr,
      humanDescription: formatCronToIndonesian(expr, 'interval'),
    };
  }

  // 2. Cek interval teks bahasa Indonesia (e.g. "tiap 30 menit", "setiap 1 jam", "tiap jam", "sejam")
  const textMinMatch = lower.match(/(?:tiap|setiap)?\s*(\d+)\s*menit(?:\s*sekali)?/i);
  if (textMinMatch) {
    const val = textMinMatch[1];
    const expr = `${val}m`;
    return {
      scheduleType: 'interval',
      scheduleExpression: expr,
      humanDescription: `Setiap ${val} menit sekali`,
    };
  }

  const textHourMatch = lower.match(/(?:tiap|setiap)?\s*(\d+)\s*jam(?:\s*sekali)?/i);
  if (textHourMatch) {
    const val = textHourMatch[1];
    const expr = `${val}h`;
    return {
      scheduleType: 'interval',
      scheduleExpression: expr,
      humanDescription: val === '1' ? 'Setiap 1 jam sekali' : `Setiap ${val} jam sekali`,
    };
  }

  if (/(?:tiap|setiap)\s+jam(?!\s*\d)|\bsejam\s+sekali\b/i.test(lower)) {
    return {
      scheduleType: 'interval',
      scheduleExpression: '1h',
      humanDescription: 'Setiap 1 jam sekali',
    };
  }

  // 3. Cek hari mingguan + jam (e.g. "tiap senin 09:00", "setiap jumat jam 20:00", "senin 08.00")
  const weeklyMatch = lower.match(/(?:tiap|setiap)?\s*(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s*(?:(?:pukul|jam)\s*)?(\d{1,2})[:.](\d{2})?/i);
  if (weeklyMatch) {
    const dayName = weeklyMatch[1].toLowerCase();
    let hour = parseInt(weeklyMatch[2], 10);
    const minute = weeklyMatch[3] ? parseInt(weeklyMatch[3], 10) : 0;

    const dayMap = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
    const dow = dayMap[dayName] !== undefined ? dayMap[dayName] : 1;

    // Period check
    if (/malam/i.test(lower) && hour < 12) hour += 12;
    else if (/sore/i.test(lower) && hour <= 6) hour += 12;
    else if (/siang/i.test(lower) && hour <= 5) hour += 12;

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const expr = `${minute} ${hour} * * ${dow}`;
      return {
        scheduleType: 'cron',
        scheduleExpression: expr,
        humanDescription: formatCronToIndonesian(expr, 'cron'),
      };
    }
  }

  // 4. Cek jam spesifik harian (e.g. "20:00", "20.00", "jam 20:00", "pukul 08:30", "jam 8 malam", "08.00")
  const timeOnlyMatch = lower.match(/^(?:pukul|jam\s*)?(\d{1,2})[:.](\d{2})(?:\s*wib)?$/i);
  if (timeOnlyMatch) {
    const hour = parseInt(timeOnlyMatch[1], 10);
    const minute = parseInt(timeOnlyMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const expr = `${minute} ${hour} * * *`;
      return {
        scheduleType: 'cron',
        scheduleExpression: expr,
        humanDescription: formatCronToIndonesian(expr, 'cron'),
      };
    }
  }

  // Pola dengan kata jam + period (e.g. "jam 8 malam", "jam 9 pagi", "jam 2 siang", "jam 10")
  const phraseTimeMatch = lower.match(/(?:pukul|jam)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|subuh)?/i);
  if (phraseTimeMatch) {
    let hour = parseInt(phraseTimeMatch[1], 10);
    const minute = phraseTimeMatch[2] ? parseInt(phraseTimeMatch[2], 10) : 0;
    const period = phraseTimeMatch[3]?.toLowerCase();

    if (period === 'malam') {
      if (hour === 12) hour = 0;
      else if (hour < 12) hour += 12;
    } else if (period === 'sore') {
      if (hour <= 6) hour += 12;
    } else if (period === 'siang') {
      if (hour <= 5) hour += 12;
    } else if (period === 'subuh' || period === 'pagi') {
      if (hour === 12) hour = 0;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const expr = `${minute} ${hour} * * *`;
      return {
        scheduleType: 'cron',
        scheduleExpression: expr,
        humanDescription: formatCronToIndonesian(expr, 'cron'),
      };
    }
  }

  // 5. Cek jika input sudah berupa ekspresi cron standar 5-token (e.g. "0 20 * * *" atau "*/30 * * * *")
  const cronTokens = input.split(/\s+/);
  if (cronTokens.length === 5) {
    try {
      CronExpressionParser.parse(input, { tz: 'Asia/Jakarta' });
      return {
        scheduleType: 'cron',
        scheduleExpression: input,
        humanDescription: formatCronToIndonesian(input, 'cron'),
      };
    } catch {
      // not a valid cron expression
    }
  }

  return null;
}

/**
 * Format enum jobType menjadi teks bahasa Indonesia yang ramah operasional toko
 * @param {string} jobType
 * @returns {string}
 */
export function formatJobTypeIndonesian(jobType) {
  switch ((jobType || '').toUpperCase()) {
    case 'REPORT':
      return 'Laporan Penjualan';
    case 'BACKUP':
      return 'Pencadangan Data';
    case 'MONITORING':
      return 'Pemantauan Sistem';
    case 'REMINDER':
      return 'Pengingat Tugas';
    case 'AI_TASK':
    case 'AI_PREDICTION':
      return 'Analisis Cerdas AI';
    case 'CLEANUP':
      return 'Pembersihan Data';
    default:
      return jobType || 'Tugas Otomatis';
  }
}

/**
 * Format daftar target peran staf menjadi bahasa Indonesia yang mudah dipahami
 * @param {string[]|string} roles
 * @returns {string}
 */
export function formatTargetRolesIndonesian(roles) {
  if (!roles || (Array.isArray(roles) && roles.length === 0)) return 'Seluruh Staf';
  const roleArray = Array.isArray(roles) ? roles : String(roles).split(',').map((r) => r.trim());
  const map = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    CASHIER: 'Kasir',
    BARISTA: 'Barista',
    KITCHEN: 'Dapur',
  };
  return roleArray.map((r) => map[r.toUpperCase()] || r).join(' & ');
}

