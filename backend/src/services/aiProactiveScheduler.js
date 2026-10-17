import { sendTelegramPhoto, sendTelegramMessage } from './telegramService.js';
import { generateBotImage } from './botImage/index.js';
import {
  calculateStockRunoutForecast,
  calculatePeakHourAndRevenueForecast,
  generateClosingComparison,
  generateRealAiPredictionAnalysis,
  formatRupiah,
} from './aiPredictiveEngine.js';

/**
 * Cooldown tracker for stock alerts:
 * key: ingredientId, value: { lastAlertAt: number, lastStock: number }
 */
const stockAlertCooldowns = new Map();
const COOLDOWN_DURATION_MS = 3 * 60 * 60 * 1000; // 3 Jam anti-spam

let schedulerTimer = null;
let lastMorningDateString = '';
let lastEveningDateString = '';
let lastSentinelCheckMinutes = -1;

/**
 * Helper to get current Date object adjusted to Asia/Jakarta (WIB)
 */
export function getWibNow(ref = new Date()) {
  try {
    const invDate = new Date(ref.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return invDate;
  } catch {
    return new Date(ref);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. DISPATCH MORNING BRIEFING (08:00 WIB)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function dispatchMorningBriefing(targetChatId = null) {
  try {
    console.log('[AI Proactive] Menyiapkan Morning Briefing Card...');
    const forecast = await calculatePeakHourAndRevenueForecast();
    const photoBuffer = await generateBotImage('ai_morning_briefing', forecast);

    const caption = `
🌅 <b>KOMAZI AI — EXECUTIVE MORNING BRIEFING</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Hari:</b> ${forecast.dayName}
🎯 <b>Target Proyeksi Omset:</b> ${forecast.projectedRevenueFormatted}
⚡ <b>Jam Sibuk Utama:</b> ${forecast.primaryPeakWindow}
🌙 <b>Jam Sibuk Malam:</b> ${forecast.secondaryPeakWindow}
━━━━━━━━━━━━━━━━━━
💡 <b>Persiapan Hari Ini:</b>
${forecast.prepAdvice.slice(0, 3).map((a, i) => `• ${a}`).join('\n')}
━━━━━━━━━━━━━━━━━━
<i>Kartu infografis analitik prediktif Komazi AI Engine.</i>
    `.trim();

    const sendResult = await sendTelegramPhoto(photoBuffer, caption, targetChatId);
    console.log('[AI Proactive] Morning Briefing terkirim:', sendResult);

    try {
      const aiInsight = await generateRealAiPredictionAnalysis(forecast);
      if (aiInsight) {
        const detailMsg = `
🧠 <b>KOMAZI AI — ANALISIS STRATEGI & TAKTIS</b>
━━━━━━━━━━━━━━━━━━
${aiInsight}
━━━━━━━━━━━━━━━━━━
<i>Autonomous Morning Briefing oleh Komazi AI Scheduler.</i>
        `.trim();
        await sendTelegramMessage(detailMsg, targetChatId);
      }
    } catch (aiErr) {
      console.warn('[AI Proactive] Gagal mengirim detail AI analysis:', aiErr.message);
    }

    return { success: true, sendResult, forecast };
  } catch (err) {
    console.error('[AI Proactive] Gagal mengirim Morning Briefing:', err);
    return { success: false, error: err.message };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. DISPATCH EVENING WRAP-UP (22:00 WIB)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function dispatchEveningWrapup(targetChatId = null) {
  try {
    console.log('[AI Proactive] Menyiapkan Evening Wrap-up Card...');
    const closeComparison = await generateClosingComparison();
    const photoBuffer = await generateBotImage('ai_evening_wrapup', closeComparison);

    const caption = `
🌙 <b>KOMAZI AI — DAILY PERFORMANCE</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Tanggal:</b> ${closeComparison.dateFormatted}
🏆 <b>Realisasi Omset:</b> ${closeComparison.actualRevenueFormatted}
🎯 <b>Target Awal Hari:</b> ${closeComparison.projectedRevenueFormatted}
📈 <b>Pencapaian:</b> ${closeComparison.achievementRatePct}% (${closeComparison.badgeLabel})
🧾 <b>Total Struk Lunas:</b> ${closeComparison.totalTransactions} pesanan
━━━━━━━━━━━━━━━━━━
<b>Menu Terlaris Hari Ini:</b>
${closeComparison.topProducts.slice(0, 3).map((p, i) => `${i + 1}. <b>${p.name}</b> (${p.qty} terjual - ${formatRupiah(p.revenue)})`).join('\n') || '-'}
━━━━━━━━━━━━━━━━━━
<i>Laporan evaluasi tutup buku Komazi Autonomous Engine.</i>
    `.trim();

    const sendResult = await sendTelegramPhoto(photoBuffer, caption, targetChatId);
    console.log('[AI Proactive] Evening Wrap-up terkirim:', sendResult);
    return { success: true, sendResult, closeComparison };
  } catch (err) {
    console.error('[AI Proactive] Gagal mengirim Evening Wrap-up:', err);
    return { success: false, error: err.message };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. DISPATCH STOCKOUT ALERT WITH ANTI-SPAM COOLDOWN
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function dispatchStockoutAlert(force = false, targetChatId = null) {
  try {
    const stockForecast = await calculateStockRunoutForecast();
    const now = Date.now();

    // Saring item kritis yang memenuhi syarat pengiriman (belum kena cooldown atau force)
    const qualifyingItems = [];

    for (const item of stockForecast.criticalItems) {
      if (item.riskLevel === 'SAFE') continue;

      const cooldown = stockAlertCooldowns.get(item.id);

      if (force || !cooldown) {
        qualifyingItems.push(item);
      } else {
        const timeSinceLastAlert = now - cooldown.lastAlertAt;
        const isOutOfStockNow = item.riskLevel === 'OUT_OF_STOCK';
        const stockHalved = item.currentStock <= (cooldown.lastStock * 0.5);

        // Kirim jika sudah lewat 3 jam ATAU stok turun drastis 50% ATAU benar-benar habis
        if (timeSinceLastAlert >= COOLDOWN_DURATION_MS || isOutOfStockNow || stockHalved) {
          qualifyingItems.push(item);
        }
      }
    }

    if (qualifyingItems.length === 0) {
      return {
        success: true,
        sent: false,
        reason: stockForecast.criticalItems.length > 0 ? 'COOLDOWN_ACTIVE' : 'NO_CRITICAL_ITEMS',
        criticalItemsCount: stockForecast.criticalItems.length,
      };
    }

    console.log(`[AI Proactive] Mengirim Stockout Alert untuk ${qualifyingItems.length} bahan kritis...`);
    const payload = {
      ...stockForecast,
      criticalItems: qualifyingItems,
      criticalCount: qualifyingItems.length,
    };

    const photoBuffer = await generateBotImage('ai_stockout_alert', payload);

    // Update cooldown timestamp
    for (const item of qualifyingItems) {
      stockAlertCooldowns.set(item.id, {
        lastAlertAt: now,
        lastStock: item.currentStock,
      });
    }

    const itemsSummaryList = qualifyingItems
      .slice(0, 4)
      .map((it) => {
        const timeInfo = it.estimatedRunoutTime ? `(habis ~${it.hoursUntilStockout} jam / ${it.estimatedRunoutTime})` : '';
        return `• <b>${it.name}</b>: sisa ${it.currentStock} ${it.unit} ${timeInfo}`;
      })
      .join('\n');

    const caption = `
🚨 <b>PERINGATAN DARURAT: BAHAN BAKU KRITIS</b>
━━━━━━━━━━━━━━━━━━
⚠️ Ditemukan <b>${qualifyingItems.length} bahan baku</b> yang laju konsumsinya diprediksi habis sebelum jam tutup toko:

${itemsSummaryList}
━━━━━━━━━━━━━━━━━━
💡 <i>Segera lakukan pembelian restock atau koordinasikan dengan kasir untuk menonaktifkan menu terkait.</i>
    `.trim();

    const sendResult = await sendTelegramPhoto(photoBuffer, caption, targetChatId);
    console.log('[AI Proactive] Stockout Alert terkirim:', sendResult);

    return {
      success: true,
      sent: true,
      itemsCount: qualifyingItems.length,
      sendResult,
    };
  } catch (err) {
    console.error('[AI Proactive] Gagal mengirim Stockout Alert:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reset cooldown cache (useful for testing)
 */
export function clearStockAlertCooldowns() {
  stockAlertCooldowns.clear();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. INTERNAL TICK & SCHEDULER LIFECYCLE
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function onSchedulerTick() {
  const nowWib = getWibNow();
  const hour = nowWib.getHours();
  const minute = nowWib.getMinutes();
  const dateKey = `${nowWib.getFullYear()}-${String(nowWib.getMonth() + 1).padStart(2, '0')}-${String(nowWib.getDate()).padStart(2, '0')}`;

  // 1. Morning Briefing: Jam 08:00 WIB (eksekusi sekali per hari)
  if (hour === 8 && minute === 0 && lastMorningDateString !== dateKey) {
    lastMorningDateString = dateKey;
    console.log(`[AI Proactive] Pemicu Morning Briefing harian untuk ${dateKey} (08:00 WIB)`);
    dispatchMorningBriefing().catch((err) =>
      console.warn('[AI Proactive] Error in morning briefing tick:', err.message)
    );
  }

  // 2. Evening Wrap-up: Jam 22:00 WIB (eksekusi sekali per hari)
  if (hour === 22 && minute === 0 && lastEveningDateString !== dateKey) {
    lastEveningDateString = dateKey;
    console.log(`[AI Proactive] Pemicu Evening Wrap-up harian untuk ${dateKey} (22:00 WIB)`);
    dispatchEveningWrapup().catch((err) =>
      console.warn('[AI Proactive] Error in evening wrapup tick:', err.message)
    );
  }

  // 3. Stockout Sentinel Check: Setiap 30 menit (menit 15 dan 45)
  if ((minute === 15 || minute === 45) && lastSentinelCheckMinutes !== minute) {
    lastSentinelCheckMinutes = minute;
    console.log(`[AI Proactive] Pemicu Stockout Sentinel Check pada jam ${hour}:${minute} WIB`);
    dispatchStockoutAlert(false).catch((err) =>
      console.warn('[AI Proactive] Error in stockout sentinel tick:', err.message)
    );
  }
}

/**
 * Mulai scheduler mandiri
 */
export function startAiProactiveScheduler() {
  if (schedulerTimer) {
    console.log('[AI Proactive] Scheduler sudah berjalan.');
    return;
  }

  console.log('[AI Proactive] Memulai Komazi AI Autonomous Proactive Scheduler...');
  // Jalankan interval per menit (60 detik)
  schedulerTimer = setInterval(onSchedulerTick, 60 * 1000);
}

/**
 * Hentikan scheduler
 */
export function stopAiProactiveScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[AI Proactive] Scheduler dihentikan.');
  }
}
