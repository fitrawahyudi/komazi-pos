/**
 * Date Parser Utility for Telegram Bot Reports
 * Mendukung format tanggal tunggal dan rentang tanggal bahasa Indonesia:
 * - YYYY-MM-DD (2026-10-15)
 * - DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (15-10-2026, 15/10/2026)
 * - DD-MM / DD/MM (15-10, 15/10 -> tahun berjalan)
 * - Nama Bulan (15 Oktober 2026, 15 Okt, 10 - 15 Oktober 2026)
 * - Rentang tanggal dengan pemisah: s/d, sd, sampai, hingga, to, atau strip (-)
 */

const INDONESIAN_MONTHS = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, agt: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12,
};

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DAY_NAMES_INDONESIAN = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

/**
 * Format Date ke teks hari & tanggal Indonesia lengkap (WIB)
 * Contoh: "Selasa, 27 Oktober 2026"
 */
export function formatIndonesianFullDate(date) {
  if (!date || isNaN(new Date(date).getTime())) return '';
  const d = new Date(date);
  const dayName = DAY_NAMES_INDONESIAN[d.getDay()];
  const day = d.getDate();
  const monthName = MONTH_NAMES_FULL[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Format Date ke teks tanggal Indonesia (WIB)
 */
export function formatIndonesianDate(date, { fullMonth = true } = {}) {
  if (!date || isNaN(new Date(date).getTime())) return '';
  const d = new Date(date);
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();
  const monthName = fullMonth ? MONTH_NAMES_FULL[monthIdx] : MONTH_NAMES_SHORT[monthIdx];
  return `${day} ${monthName} ${year}`;
}

/**
 * Parsing 1 token tanggal
 */
export function parseSingleDateToken(raw = '') {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const now = new Date();
  let y, m, d;

  // 1. ISO format: YYYY-MM-DD
  const mIso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (mIso) {
    y = parseInt(mIso[1], 10);
    m = parseInt(mIso[2], 10);
    d = parseInt(mIso[3], 10);
  } else {
    // 2. Format umum Indonesia: DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
    const mDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (mDmy) {
      d = parseInt(mDmy[1], 10);
      m = parseInt(mDmy[2], 10);
      y = parseInt(mDmy[3], 10);
    } else {
      // 3. Tanggal pendek tanpa tahun: DD-MM / DD/MM (pakai tahun berjalan)
      const mDm = str.match(/^(\d{1,2})[-/.](\d{1,2})$/);
      if (mDm) {
        d = parseInt(mDm[1], 10);
        m = parseInt(mDm[2], 10);
        y = now.getFullYear();
      } else {
        // 4. Nama Bulan teks: "15 Oktober 2026" atau "15 Okt"
        const mText = str.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
        if (mText && INDONESIAN_MONTHS[mText[2]]) {
          d = parseInt(mText[1], 10);
          m = INDONESIAN_MONTHS[mText[2]];
          y = mText[3] ? parseInt(mText[3], 10) : now.getFullYear();
        }
      }
    }
  }

  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;

  // Validasi keabsahan kalender (menolak 30 Februari, dll)
  const dateObj = new Date(y, m - 1, d);
  if (
    dateObj.getFullYear() !== y ||
    dateObj.getMonth() !== m - 1 ||
    dateObj.getDate() !== d
  ) {
    return null;
  }

  return { year: y, month: m, day: d, dateObj };
}

/**
 * Parsing string input laporan tanggal menjadi rentang Date (startDate 00:00:00 s/d endDate 23:59:59)
 * @param {string} input - Teks input dari chat bot (contoh: '15-10-2026', '10-10-2026 s/d 15-10-2026')
 * @returns {{ startDate: Date, endDate: Date, label: string, isSingleDay: boolean } | null}
 */
export function parseReportDateInput(input = '') {
  if (!input || typeof input !== 'string') return null;
  let clean = input.trim();

  // Bersihkan awalan perintah jika ada (contoh: "/laporan 15-10-2026")
  clean = clean.replace(/^\/laporan(?:\s+|$)/i, '').trim();
  if (!clean) return null;

  // Cek pemisah rentang tanggal
  const rangeRegex = /\s+(?:s\/d|sd|sampai|hingga|to|-)\s+/i;
  if (rangeRegex.test(clean)) {
    const parts = clean.split(rangeRegex).map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Kasus khusus: "10 - 15 Oktober 2026"
      if (/^\d{1,2}$/.test(parts[0])) {
        const p2 = parseSingleDateToken(parts[1]);
        if (p2) {
          const d1 = parseInt(parts[0], 10);
          const p1 = parseSingleDateToken(`${d1} ${MONTH_NAMES_FULL[p2.month - 1]} ${p2.year}`);
          if (p1) {
            return buildRangeResult(p1, p2);
          }
        }
      }

      const p1 = parseSingleDateToken(parts[0]);
      const p2 = parseSingleDateToken(parts[1]);
      if (p1 && p2) {
        return buildRangeResult(p1, p2);
      }
    }
  }

  // Cek apakah tanggal tunggal
  const single = parseSingleDateToken(clean);
  if (single) {
    const startDate = new Date(single.year, single.month - 1, single.day, 0, 0, 0, 0);
    const endDate = new Date(single.year, single.month - 1, single.day, 23, 59, 59, 999);
    const label = formatIndonesianDate(startDate, { fullMonth: true });
    return {
      startDate,
      endDate,
      label,
      isSingleDay: true,
      formattedPeriod: label,
    };
  }

  return null;
}

function buildRangeResult(p1, p2) {
  let startDate = new Date(p1.year, p1.month - 1, p1.day, 0, 0, 0, 0);
  let endDate = new Date(p2.year, p2.month - 1, p2.day, 23, 59, 59, 999);

  // Pastikan startDate selalu sebelum endDate
  if (startDate > endDate) {
    const tempStart = startDate;
    startDate = new Date(p2.year, p2.month - 1, p2.day, 0, 0, 0, 0);
    endDate = new Date(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate(), 23, 59, 59, 999);
  }

  const isSameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const label = isSameDay
    ? formatIndonesianDate(startDate, { fullMonth: true })
    : `${formatIndonesianDate(startDate, { fullMonth: false })} - ${formatIndonesianDate(endDate, { fullMonth: false })}`;

  return {
    startDate,
    endDate,
    label,
    isSingleDay: isSameDay,
    formattedPeriod: label,
  };
}

/**
 * Universal Natural Date & Period Parser untuk kueri percakapan bahasa Indonesia.
 * Mendeteksi pertanyaan waktu lampau seperti:
 * - "tgl 27 oktober kemarin", "27 oktober", "27-10-2026"
 * - "kemarin", "kemarin lusa", "3 hari lalu"
 * - "selasa kemarin", "senin lalu"
 * - "minggu lalu", "pekan lalu", "7 hari terakhir"
 * - "bulan ini", "bulan lalu", "bulan september"
 * - "20 sampai 25 oktober"
 *
 * @param {string} text - Teks pertanyaan pengguna
 * @param {Date} [now] - Waktu acuan (default waktu saat ini)
 * @returns {{ isHistorical: boolean, isToday: boolean, startDate: Date, endDate: Date, label: string, periodType: string } | null}
 */
export function parseNaturalDateQuery(text = '', now = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim().toLowerCase();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentDate = now.getDate();
  const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin, ...

  // Helper untuk membuat rentang 1 hari penuh (00:00:00 - 23:59:59.999)
  const makeDayRange = (dObj, customLabel = '') => {
    const startDate = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0, 0);
    const endDate = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 23, 59, 59, 999);
    const isToday =
      startDate.getFullYear() === now.getFullYear() &&
      startDate.getMonth() === now.getMonth() &&
      startDate.getDate() === now.getDate();
    return {
      isHistorical: !isToday,
      isToday,
      startDate,
      endDate,
      label: customLabel || formatIndonesianFullDate(startDate),
      periodType: 'SINGLE_DAY',
    };
  };

  // Helper untuk membuat rentang beberapa hari
  const makeRange = (startObj, endObj, label, periodType = 'DATE_RANGE') => {
    let startDate = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate(), 0, 0, 0, 0);
    let endDate = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999);
    if (startDate > endDate) {
      const temp = startDate;
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
      endDate = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), 23, 59, 59, 999);
    }
    return {
      isHistorical: true,
      isToday: false,
      startDate,
      endDate,
      label,
      periodType,
    };
  };

  // 1. Rentang Tanggal Teks: "20 sampai 25 oktober 2026" atau "10 - 15 okt"
  const mTextRange = str.match(/(?:dari\s+)?(?:tgl|tanggal\s+)?(\d{1,2})\s*(?:s\/d|sd|sampai|hingga|to|-)\s*(?:tgl|tanggal\s+)?(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (mTextRange && INDONESIAN_MONTHS[mTextRange[3]]) {
    const d1 = parseInt(mTextRange[1], 10);
    const d2 = parseInt(mTextRange[2], 10);
    const mIdx = INDONESIAN_MONTHS[mTextRange[3]];
    const y = mTextRange[4] ? parseInt(mTextRange[4], 10) : currentYear;
    return makeRange(
      new Date(y, mIdx - 1, d1),
      new Date(y, mIdx - 1, d2),
      `${d1} - ${d2} ${MONTH_NAMES_FULL[mIdx - 1]} ${y}`
    );
  }

  // 2. Rentang Tanggal Numerik: "01/10/2026 s/d 07/10/2026"
  const mNumRange = str.match(/(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{4})?)\s*(?:s\/d|sd|sampai|hingga|to|-)\s*(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{4})?)/i);
  if (mNumRange) {
    const p1 = parseSingleDateToken(mNumRange[1]);
    const p2 = parseSingleDateToken(mNumRange[2]);
    if (p1 && p2) {
      return makeRange(
        p1.dateObj,
        p2.dateObj,
        `${formatIndonesianDate(p1.dateObj, { fullMonth: false })} - ${formatIndonesianDate(p2.dateObj, { fullMonth: false })}`
      );
    }
  }

  // 3. Periode Khusus: "7 hari terakhir" / "seminggu terakhir"
  if (/\b(?:7\s*hari|seminggu)\s+terakhir\b/i.test(str)) {
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 6);
    return makeRange(
      past7,
      now,
      `7 Hari Terakhir (${formatIndonesianDate(past7, { fullMonth: false })} - ${formatIndonesianDate(now, { fullMonth: false })})`,
      '7_DAYS'
    );
  }

  // 4. Periode Khusus: "minggu lalu" / "pekan lalu" / "1 minggu lalu" / "seminggu lalu"
  if (/\b(?:minggu|pekan|1\s*minggu|seminggu)\s+lalu\b/i.test(str)) {
    const dayOffset = currentDay === 0 ? 7 : currentDay;
    const lastMon = new Date(now);
    lastMon.setDate(now.getDate() - dayOffset - 6);
    const lastSun = new Date(now);
    lastSun.setDate(now.getDate() - dayOffset);
    return makeRange(
      lastMon,
      lastSun,
      `Minggu Lalu (${formatIndonesianDate(lastMon, { fullMonth: false })} - ${formatIndonesianDate(lastSun, { fullMonth: false })})`,
      'LAST_WEEK'
    );
  }

  // 5. Periode Khusus: "minggu ini" / "pekan ini"
  if (/\b(?:minggu|pekan)\s+ini\b/i.test(str)) {
    const dayOffset = currentDay === 0 ? 7 : currentDay;
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate() - (dayOffset - 1));
    return makeRange(
      thisMon,
      now,
      `Minggu Ini (${formatIndonesianDate(thisMon, { fullMonth: false })} - ${formatIndonesianDate(now, { fullMonth: false })})`,
      'THIS_WEEK'
    );
  }

  // 6. Periode Khusus: "bulan lalu" / "1 bulan lalu"
  if (/\b(?:bulan|1\s*bulan)\s+lalu\b/i.test(str)) {
    const firstDayPrevMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayPrevMonth = new Date(currentYear, currentMonth, 0);
    return makeRange(
      firstDayPrevMonth,
      lastDayPrevMonth,
      `Bulan Lalu (${MONTH_NAMES_FULL[firstDayPrevMonth.getMonth()]} ${firstDayPrevMonth.getFullYear()})`,
      'LAST_MONTH'
    );
  }

  // 7. Periode Khusus: "bulan ini"
  if (/\bbulan\s+ini\b/i.test(str)) {
    const firstDayThisMonth = new Date(currentYear, currentMonth, 1);
    return makeRange(
      firstDayThisMonth,
      now,
      `Bulan Ini (${MONTH_NAMES_FULL[currentMonth]} ${currentYear})`,
      'THIS_MONTH'
    );
  }

  // 8. Nama Bulan Spesifik: "bulan september" / "bulan agustus 2026"
  const mMonthOnly = str.match(/\bbulan\s+([a-z]+)(?:\s+(\d{4}))?\b/i);
  if (mMonthOnly && INDONESIAN_MONTHS[mMonthOnly[1]]) {
    const mIdx = INDONESIAN_MONTHS[mMonthOnly[1]];
    const y = mMonthOnly[2] ? parseInt(mMonthOnly[2], 10) : currentYear;
    const firstDay = new Date(y, mIdx - 1, 1);
    const lastDay = new Date(y, mIdx, 0);
    return makeRange(firstDay, lastDay, `Bulan ${MONTH_NAMES_FULL[mIdx - 1]} ${y}`, 'MONTH');
  }

  // 9. Tanggal Spesifik dengan Nama Bulan: "tgl 27 oktober kemarin", "27 oktober", "15 okt 2026"
  const mDateMonth = str.match(/(?:(?:tgl|tanggal)\s+)?(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (mDateMonth && INDONESIAN_MONTHS[mDateMonth[2]]) {
    const d = parseInt(mDateMonth[1], 10);
    const mIdx = INDONESIAN_MONTHS[mDateMonth[2]];
    const y = mDateMonth[3] ? parseInt(mDateMonth[3], 10) : currentYear;
    if (d >= 1 && d <= 31) {
      const targetDate = new Date(y, mIdx - 1, d);
      if (
        targetDate.getFullYear() === y &&
        targetDate.getMonth() === mIdx - 1 &&
        targetDate.getDate() === d
      ) {
        return makeDayRange(targetDate);
      }
    }
  }

  // 10. Tanggal Spesifik Format Angka Lengkap: "2026-10-27", "27-10-2026", "27/10/2026"
  const mIso = str.match(/(?:(?:tgl|tanggal)\s+)?(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/i);
  if (mIso) {
    const y = parseInt(mIso[1], 10);
    const m = parseInt(mIso[2], 10);
    const d = parseInt(mIso[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(y, m - 1, d);
      return makeDayRange(dt);
    }
  }

  const mDmy = str.match(/(?:(?:tgl|tanggal)\s+)?(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/i);
  if (mDmy) {
    const d = parseInt(mDmy[1], 10);
    const m = parseInt(mDmy[2], 10);
    const y = parseInt(mDmy[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(y, m - 1, d);
      return makeDayRange(dt);
    }
  }

  // 11. Tanggal Pendek: "tgl 27-10" atau "tanggal 27/10"
  const mShortDate = str.match(/(?:tgl|tanggal)\s+(\d{1,2})[-/.](\d{1,2})\b/i);
  if (mShortDate) {
    const d = parseInt(mShortDate[1], 10);
    const m = parseInt(mShortDate[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(currentYear, m - 1, d);
      return makeDayRange(dt);
    }
  }

  // 12. Tanggal Hanya Angka: "tgl 27" atau "tanggal 25"
  const mDayOnly = str.match(/(?:tgl|tanggal)\s+(\d{1,2})\b/i);
  if (mDayOnly) {
    const d = parseInt(mDayOnly[1], 10);
    if (d >= 1 && d <= 31) {
      // Jika angka tanggal lebih besar dari hari ini, kemungkinan merujuk ke bulan lalu
      const targetMonth = d > currentDate ? currentMonth - 1 : currentMonth;
      const dt = new Date(currentYear, targetMonth, d);
      return makeDayRange(dt);
    }
  }

  // 13. Hari Lampau Relatif: "kemarin lusa" / "lusa kemarin" / "2 hari lalu"
  if (/\b(?:kemarin\s+lusa|lusa\s+kemarin|2\s+hari\s+(?:yang\s+)?lalu)\b/i.test(str)) {
    const target = new Date(now);
    target.setDate(now.getDate() - 2);
    return makeDayRange(target, `Kemarin Lusa (${formatIndonesianFullDate(target)})`);
  }

  // 14. Hari Lampau Relatif: "N hari lalu" / "N hari yang lalu"
  const mNDaysAgo = str.match(/\b(\d+)\s+hari\s+(?:yang\s+)?lalu\b/i);
  if (mNDaysAgo) {
    const n = parseInt(mNDaysAgo[1], 10);
    const target = new Date(now);
    target.setDate(now.getDate() - n);
    return makeDayRange(target, `${n} Hari Lalu (${formatIndonesianFullDate(target)})`);
  }

  // 15. Hari Kalender Relatif: "selasa kemarin", "senin lalu", "hari rabu kemarin"
  const mDayName = str.match(/\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+(?:kemarin|lalu)\b/i);
  if (mDayName) {
    const dayMap = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
    const targetDayIdx = dayMap[mDayName[1].toLowerCase()];
    let diff = currentDay - targetDayIdx;
    if (diff <= 0) diff += 7;
    const target = new Date(now);
    target.setDate(now.getDate() - diff);
    return makeDayRange(target, formatIndonesianFullDate(target));
  }

  // 16. Kata "kemarin" (Standalone)
  if (/\bkemarin\b/i.test(str)) {
    const target = new Date(now);
    target.setDate(now.getDate() - 1);
    return makeDayRange(target, `Kemarin (${formatIndonesianFullDate(target)})`);
  }

  // 17. Kata "hari ini"
  if (/\bhari\s+ini\b/i.test(str)) {
    return makeDayRange(now, 'Hari Ini');
  }

  return null;
}

