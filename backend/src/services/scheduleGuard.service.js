import prisma from '../config/db.js';
import { getSettingsMap } from './settingsCache.service.js';

/**
 * Menghasilkan varian representasi tanggal YYYY-MM-DD hari ini
 * (Mencakup zona waktu Asia/Jakarta WIB, UTC server, dan tanggal lokal)
 * agar pencocokan jadwal tidak terpengaruh perbedaan zona waktu server.
 */
export function getTodayDateStrings(date = new Date()) {
  const dates = new Set();

  // 1. UTC date
  try {
    dates.add(date.toISOString().split('T')[0]);
  } catch (e) {}

  // 2. Asia/Jakarta (WIB - UTC+7) date
  try {
    const wib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
    dates.add(wib);
  } catch (e) {}

  // 3. Local server date
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.add(`${year}-${month}-${day}`);
  } catch (e) {}

  return Array.from(dates);
}

/**
 * Memeriksa apakah staf memiliki jadwal kerja aktif pada hari ini.
 * - OWNER dibebaskan (selalu diizinkan tanpa perlu membuat jadwal kerja untuk dirinya sendiri).
 * - Jika setting enforceScheduleGuard NONAKTIF (false / default): Seluruh staf aktif diizinkan transaksi & presensi.
 * - Jika setting enforceScheduleGuard AKTIF (true): Seluruh staf lainnya WAJIB memiliki jadwal kerja terdaftar.
 *
 * @param {number|string} userId
 * @param {string} userRole
 * @returns {Promise<{ isScheduled: boolean, isOwner: boolean, schedule: object|null, isEnforced: boolean }>}
 */
export async function checkStaffScheduleToday(userId, userRole) {
  if (userRole === 'OWNER') {
    return {
      isScheduled: true,
      isOwner: true,
      schedule: null,
      isEnforced: false,
    };
  }

  // Ambil konfigurasi enforceScheduleGuard dari in-memory cache
  const settingsMap = await getSettingsMap().catch(() => ({}));
  const isEnforced = settingsMap['enforceScheduleGuard'] === 'true' || settingsMap['enforceScheduleGuard'] === true;

  const todayDates = getTodayDateStrings();
  const schedule = await prisma.staffSchedule.findFirst({
    where: {
      userId: Number(userId),
      date: { in: todayDates },
    },
  });

  // Jika pembatasan jadwal tidak diaktifkan oleh Owner, transaksi & presensi selalu diizinkan
  if (!isEnforced) {
    return {
      isScheduled: true,
      isOwner: false,
      schedule: schedule || null,
      isEnforced: false,
    };
  }

  // Jika pembatasan jadwal diaktifkan oleh Owner, wajib ada jadwal terdaftar hari ini
  return {
    isScheduled: Boolean(schedule),
    isOwner: false,
    schedule: schedule || null,
    isEnforced: true,
  };
}

export const SCHEDULE_BLOCKED_MESSAGE =
  'Jadwal kerja Anda belum diatur untuk hari ini. Silakan hubungi Owner atau Manajer untuk mengatur jadwal kerja sebelum Anda dapat melakukan presensi, membuka sesi kasir, ataupun memproses transaksi.';

export const ATTENDANCE_REQUIRED_MESSAGE =
  'Presensi Wajib: Anda belum melakukan presensi hari ini. Silakan lakukan presensi terlebih dahulu sebelum dapat membuka shift kasir atau melakukan transaksi.';

export const ATTENDANCE_CLOCKED_OUT_MESSAGE =
  'Sesi kerja Anda telah selesai karena sudah melakukan Clock-Out hari ini. Anda tidak dapat membuka shift kasir atau melakukan transaksi lagi hari ini.';

/**
 * Memeriksa apakah staf telah melakukan presensi pada hari ini.
 * - OWNER dibebaskan (selalu diizinkan).
 * - Staf non-OWNER (CASHIER, BARISTA, dll) WAJIB presensi sebelum bertransaksi.
 *
 * @param {number|string} userId
 * @param {string} userRole
 * @returns {Promise<{ hasClockedIn: boolean, isOwner: boolean, attendance: object|null, isClockedOut: boolean }>}
 */
export async function checkStaffAttendanceToday(userId, userRole) {
  if (userRole === 'OWNER') {
    return {
      hasClockedIn: true,
      isOwner: true,
      attendance: null,
      isClockedOut: false,
      isEnforced: false,
    };
  }

  // Ambil konfigurasi enforceAttendanceGuard dari in-memory cache settings
  const settingsMap = await getSettingsMap().catch(() => ({}));
  const isEnforced =
    settingsMap['enforceAttendanceGuard'] === undefined
      ? true // default wajib presensi
      : settingsMap['enforceAttendanceGuard'] === 'true' || settingsMap['enforceAttendanceGuard'] === true;

  const todayDates = getTodayDateStrings();
  const attendance = await prisma.staffAttendance.findFirst({
    where: {
      userId: Number(userId),
      date: { in: todayDates },
    },
    orderBy: { id: 'desc' },
  });

  // Jika Owner menonaktifkan aturan wajib presensi, staf bebas membuka kasir & bertransaksi
  if (!isEnforced) {
    return {
      hasClockedIn: true,
      isOwner: false,
      attendance: attendance || null,
      isClockedOut: false,
      isEnforced: false,
    };
  }

  if (!attendance || !attendance.clockIn) {
    return {
      hasClockedIn: false,
      isOwner: false,
      attendance: null,
      isClockedOut: false,
      isEnforced: true,
    };
  }

  const isClockedOut = Boolean(attendance.clockOut);

  return {
    hasClockedIn: !isClockedOut,
    isOwner: false,
    attendance,
    isClockedOut,
    isEnforced: true,
  };
}

/**
 * Memeriksa kelayakan staf untuk membuka shift kasir atau bertransaksi:
 * 1. Jadwal kerja (jika enforceScheduleGuard aktif)
 * 2. Presensi (wajib Clock-In hari ini sebelum membuka kasir atau transaksi)
 *
 * @param {number|string} userId
 * @param {string} userRole
 * @returns {Promise<{ eligible: boolean, isOwner: boolean, reason: string|null, message: string|null, schedule: object|null, attendance: object|null }>}
 */
export async function checkStaffShiftEligibility(userId, userRole) {
  if (userRole === 'OWNER') {
    return { eligible: true, isOwner: true, reason: null, message: null, schedule: null, attendance: null };
  }

  // 1. Cek jadwal kerja (hanya jika enforceScheduleGuard aktif)
  const scheduleCheck = await checkStaffScheduleToday(userId, userRole);
  if (!scheduleCheck.isScheduled) {
    return {
      eligible: false,
      isOwner: false,
      reason: 'SCHEDULE_REQUIRED',
      message: SCHEDULE_BLOCKED_MESSAGE,
      schedule: null,
      attendance: null,
    };
  }

  // 2. Cek presensi (wajib presensi hari ini sebelum transaksi)
  const attendanceCheck = await checkStaffAttendanceToday(userId, userRole);
  if (!attendanceCheck.hasClockedIn) {
    const message = attendanceCheck.isClockedOut
      ? ATTENDANCE_CLOCKED_OUT_MESSAGE
      : ATTENDANCE_REQUIRED_MESSAGE;
    return {
      eligible: false,
      isOwner: false,
      reason: attendanceCheck.isClockedOut ? 'CLOCKED_OUT' : 'ATTENDANCE_REQUIRED',
      message,
      schedule: scheduleCheck.schedule,
      attendance: attendanceCheck.attendance,
    };
  }

  return {
    eligible: true,
    isOwner: false,
    reason: null,
    message: null,
    schedule: scheduleCheck.schedule,
    attendance: attendanceCheck.attendance,
  };
}

