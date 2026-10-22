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
