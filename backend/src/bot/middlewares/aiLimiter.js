/**
 * Middleware Keamanan & Pembatasan Beban untuk Fitur AI OpenClaw.
 * Menegakkan:
 * 1. Autentikasi staf tertaut (ctx.user)
 * 2. Otorisasi peran (RBAC: OWNER & MANAGER)
 * 3. Kunci konkurensi (1 request aktif per pengguna)
 * 4. Batas frekuensi per menit (rate limit)
 * 5. Kuota maksimum harian per pengguna
 */

import { getOpenclawConfig } from '../ai/openclawConfig.js';
import { esc } from '../utils/format.js';

// Kunci konkurensi: Set<userId>
const activeUsers = new Set();

// Rate limit per menit: Map<userId, Array<timestamp>>
const minuteWindows = new Map();

// Kuota harian: Map<"userId:YYYY-MM-DD", count>
const dailyUsage = new Map();

function getTodayKey(userId) {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${userId}:${dateStr}`;
}

export async function aiLimiter(ctx, next) {
  // 1. Validasi Autentikasi
  if (!ctx.user) {
    return ctx.reply(
      '🔒 <b>Akses Ditolak</b>\n\n' +
        'Akun Telegram Anda belum ditautkan ke POS Komazi.\n' +
        'Silakan minta kode tautan ke Owner, lalu kirim:\n<code>/start KODE</code>',
      { parse_mode: 'HTML' }
    );
  }

  const userId = ctx.user.id;
  const config = getOpenclawConfig();

  // 2. Validasi RBAC (Role-Based Access Control)
  const isAllowedRole =
    ctx.user.role === 'OWNER' ||
    config.allowedRoles.includes(ctx.user.role?.toUpperCase());

  if (!isAllowedRole) {
    return ctx.reply(
      `⛔ <b>Akses Terbatas</b>\n\n` +
        `Fitur asisten AI Komazi saat ini dikhususkan untuk peran: <b>${config.allowedRoles.join(', ')}</b>.\n` +
        `Peran akun Anda saat ini: <b>${esc(ctx.user.role)}</b>.`,
      { parse_mode: 'HTML' }
    );
  }

  // 3. Concurrency Lock: Mencegah spam request paralel dari user yang sama
  if (activeUsers.has(userId)) {
    return ctx.reply(
      '⏳ <b>Permintaan Sedang Diproses</b>\n\n' +
        'Asisten AI sedang menyusun jawaban untuk pertanyaan Anda sebelumnya. Mohon tunggu sejenak.',
      { parse_mode: 'HTML' }
    );
  }

  const now = Date.now();

  // 4. Rate Limiting per Menit (Maksimal 5 request / 60 detik)
  const timestamps = minuteWindows.get(userId) || [];
  const recentTimestamps = timestamps.filter((t) => now - t < 60000);
  if (recentTimestamps.length >= 5) {
    minuteWindows.set(userId, recentTimestamps);
    return ctx.reply(
      '⚠️ <b>Batas Kecepatan Tercapai</b>\n\n' +
        'Anda telah mengirim terlalu banyak pertanyaan dalam 1 menit. Mohon istirahat sejenak sebelum bertanya kembali.',
      { parse_mode: 'HTML' }
    );
  }
  recentTimestamps.push(now);
  minuteWindows.set(userId, recentTimestamps);

  // 5. Kuota Harian per User
  const todayKey = getTodayKey(userId);
  const currentDailyCount = dailyUsage.get(todayKey) || 0;
  if (currentDailyCount >= config.dailyLimit) {
    return ctx.reply(
      `🛑 <b>Batas Harian AI Tercapai</b>\n\n` +
        `Anda telah menggunakan kuota <b>${config.dailyLimit}</b> pertanyaan AI hari ini.\n` +
        `Kuota akan direset otomatis esok hari pukul 00:00 WIB.`,
      { parse_mode: 'HTML' }
    );
  }

  // Set Concurrency Lock & Increment Daily Usage
  activeUsers.add(userId);
  dailyUsage.set(todayKey, currentDailyCount + 1);

  try {
    await next();
  } finally {
    activeUsers.delete(userId);
  }
}

/**
 * Helper diagnostik reset (berguna untuk testing).
 */
export function resetLimiterState() {
  activeUsers.clear();
  minuteWindows.clear();
  dailyUsage.clear();
}
