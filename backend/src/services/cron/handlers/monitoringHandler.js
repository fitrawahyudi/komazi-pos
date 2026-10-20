/**
 * Cron Job Handler: System Health & Monitoring (MONITORING).
 * Memeriksa kesehatan database MySQL, runtime bot Telegram,
 * konektivitas Komazi AI (Local Gateway atau Cloud AI: Groq/Gemini),
 * dan mengirim alert hanya jika ada anomali.
 */

import prisma from '../../../config/db.js';
import { getBotMode } from '../../../bot/index.js';
import { pingOpenClawGateway } from '../../../bot/ai/openclawClient.js';
import { stockService } from '../../stock.service.js';
import { notifier } from '../../../bot/notifier.js';
import logger from '../../../utils/logger.js';
import { formatCronToIndonesian } from '../cronHumanizer.js';

/**
 * Pengecekan kesehatan sistem komprehensif (dapat dipanggil on-demand atau via scheduler).
 * @param {object} [options]
 * @param {boolean} [options.checkAi=true]
 * @returns {Promise<object>} Status kesehatan terstruktur
 */
export async function checkSystemHealth({ checkAi = true } = {}) {
  const results = {
    timestamp: new Date().toISOString(),
    database: 'UNKNOWN',
    dbLatencyMs: 0,
    botMode: getBotMode() || 'UNKNOWN',
    openclaw: 'SKIPPED',
    memoryHeapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    criticalStockCount: 0,
    hasIssues: false,
    issues: [],
  };

  // 1. Healthcheck Database MySQL
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    results.database = 'ONLINE';
    results.dbLatencyMs = dbLatency;
    if (dbLatency > 3000) {
      results.hasIssues = true;
      results.issues.push(`Latensi database tinggi: ${dbLatency}ms`);
    }
  } catch (dbErr) {
    results.database = `OFFLINE (${dbErr.message})`;
    results.hasIssues = true;
    results.issues.push(`Database MySQL tidak merespons: ${dbErr.message}`);
  }

  // 2. Healthcheck Bot Telegram
  if (results.botMode === 'OFFLINE' || results.botMode === 'DISABLED') {
    results.hasIssues = true;
    results.issues.push(`Bot Telegram dalam status: ${results.botMode}`);
  }

  // 3. Healthcheck Komazi AI Engine (Local Gateway / Cloud Fallback)
  if (checkAi) {
    try {
      const pingRes = await pingOpenClawGateway();
      if (pingRes.ok) {
        results.openclaw = `ONLINE (${pingRes.detail || pingRes.provider || 'Active'})`;
      } else if (pingRes.reason === 'AI_DISABLED' || pingRes.isStandby) {
        results.openclaw = 'STANDBY (Tidak Aktif)';
      } else {
        results.openclaw = `OFFLINE (${pingRes.error || 'unreachable'})`;
        results.hasIssues = true;
        results.issues.push(`Komazi AI Engine tidak dapat dijangkau: ${results.openclaw}`);
      }
    } catch (aiErr) {
      results.openclaw = `ERROR (${aiErr.message})`;
      results.hasIssues = true;
      results.issues.push(`Komazi AI Error: ${aiErr.message}`);
    }
  }

  // 4. Periksa apakah ada bahan kritis
  try {
    const lowStock = await stockService.listLowStock();
    results.criticalStockCount = lowStock.length;
    if (lowStock.length >= 5) {
      results.hasIssues = true;
      results.issues.push(`Terdapat ${lowStock.length} bahan baku di bawah stok minimum.`);
    }
  } catch {}

  return results;
}

/**
 * Format string pesan HTML status Sentinel untuk tampilan bot Telegram
 */
export function formatSentinelStatusHtml(statusObj, { isManual = false, jobConfig = null } = {}) {
  const statusEmoji = statusObj.hasIssues ? '⚠️' : '✅';
  const statusSummary = statusObj.hasIssues
    ? '<b>Perhatian:</b> Ditemukan isu operasional'
    : '<b>Normal:</b> Seluruh sistem berjalan optimal';

  const timeWib = new Date(statusObj.timestamp).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }) + ' WIB';

  let scheduleInfo = '';
  if (jobConfig) {
    const statusText = jobConfig.deletedAt ? '🛑 Dibatalkan' : jobConfig.enabled ? '🟢 Aktif' : '⏸ Dijeda';
    const humanSched = formatCronToIndonesian(jobConfig.scheduleExpression, jobConfig.scheduleType);
    scheduleInfo = `\n\n<b>⚙️ Pengaturan Sentinel:</b>\n• Status: ${statusText}\n• Waktu Pemeriksaan: <b>${humanSched}</b>\n• Eksekusi Berikutnya: <b>${jobConfig.nextRunAt ? new Date(jobConfig.nextRunAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-'}</b>`;
  }

  let issuesSection = '';
  if (statusObj.hasIssues && statusObj.issues?.length > 0) {
    issuesSection = `\n\n<b>Catatan Operasional:</b>\n${statusObj.issues.map((i) => `• ⚠️ ${i}`).join('\n')}`;
  }

  const header = isManual ? '🛡️ <b>STATUS KESEHATAN SISTEM (SENTINEL)</b>' : '🚨 <b>PERINGATAN SISTEM SENTINEL</b>';

  const dbStatusText = statusObj.database === 'ONLINE' ? '🟢 Terhubung Normal' : statusObj.database;
  const botStatusText = statusObj.botMode === 'POLLING' || statusObj.botMode === 'WEBHOOK' ? '🟢 Aktif' : statusObj.botMode;
  const aiStatusText = statusObj.openclaw.includes('ONLINE') ? '🟢 Aktif' : statusObj.openclaw;

  return `
${header}
━━━━━━━━━━━━━━━━━━
<b>Status Operasional:</b>
• Server Database: <b>${dbStatusText}</b>
• Bot Telegram: <b>${botStatusText}</b>
• Asisten Pintar AI: <b>${aiStatusText}</b>
• Bahan Baku Kritis: <b>${statusObj.criticalStockCount} item</b>
• Beban Memori: <b>${statusObj.memoryHeapUsedMb} MB</b>
━━━━━━━━━━━━━━━━━━
${statusEmoji} ${statusSummary}${issuesSection}
<i>Diperiksa pada: ${timeWib}</i>${scheduleInfo}
  `.trim();
}

export async function executeMonitoringJob(job) {
  const payload = job.payload || {};
  const alertRole = payload.alertRole || 'OWNER';
  // Hanya cek AI jika eksplisit diminta (misal sentinel job), job stok tidak perlu cek AI
  const checkAiGateway = payload.checkAiGateway === true;

  logger.scheduler.info(`Executing MONITORING job #${job.id}: Health check & sentinel scan`);

  const results = await checkSystemHealth({ checkAi: checkAiGateway });

  // Kirim alert ke Telegram HANYA saat ada isu/anomali terdeteksi (mencegah spam)
  if (results.hasIssues) {
    const issueLines = results.issues.map((i) => `• ⚠️ ${i}`).join('\n');
    const alertHtml = `
🚨 <b>ALERT</b>
━━━━━━━━━━━━━━━━━━
<b>Status Terkini:</b>
• Database: <b>${results.database}</b>
• Bot Telegram: <b>${results.botMode}</b>
• Komazi AI: <b>${results.openclaw}</b>
• Bahan Kritis: <b>${results.criticalStockCount} item</b>

<b>Isu yang Terdeteksi:</b>
${issueLines}
━━━━━━━━━━━━━━━━━━
<i>Peringatan otomatis oleh Sentinel Scheduler</i>
    `.trim();

    await notifier.toRoles([alertRole], alertHtml);
    logger.scheduler.warn(`[MonitoringJob] Anomaly alert dispatched to ${alertRole}`, { issues: results.issues });
  }

  return {
    success: true,
    hasIssues: results.hasIssues,
    status: results,
  };
}
