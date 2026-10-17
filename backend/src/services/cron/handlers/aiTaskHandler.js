/**
 * Cron Job Handler: Tugas Analitik AI & Briefing Terjadwal (AI_TASK).
 * Memanggil OpenClaw AI Gateway untuk tugas terstruktur yang aman (bounded I/O),
 * seperti Executive Briefing pagi hari atau evaluasi omset harian.
 */

import {
  dispatchMorningBriefing,
  dispatchEveningWrapup,
  dispatchStockoutAlert,
} from '../../aiProactiveScheduler.js';
import { sendOpenClawChat, OpenClawError } from '../../../bot/ai/openclawClient.js';
import { buildAiSystemContext } from '../../../bot/ai/aiContextService.js';
import { notifier } from '../../../bot/notifier.js';
import { esc } from '../../../bot/utils/format.js';
import logger from '../../../utils/logger.js';

export async function executeAiTaskJob(job) {
  const payload = job.payload || {};
  const task = payload.task || 'custom';
  const recipientRole = payload.recipientRole || 'OWNER';

  logger.scheduler.info(`Executing AI_TASK job #${job.id}: Task type '${task}'`);

  // 1. Tugas AI Native: Morning Executive Briefing
  if (task === 'morning_briefing') {
    const result = await dispatchMorningBriefing();
    return {
      success: true,
      task: 'morning_briefing',
      dispatched: result,
    };
  }

  // 2. Tugas AI Native: Evening Wrap-Up
  if (task === 'evening_wrapup') {
    const result = await dispatchEveningWrapup();
    return {
      success: true,
      task: 'evening_wrapup',
      dispatched: result,
    };
  }

  // 3. Tugas AI Native: Stockout Sentinel Scan
  if (task === 'stockout_sentinel') {
    const result = await dispatchStockoutAlert(false);
    return {
      success: true,
      task: 'stockout_sentinel',
      dispatched: result,
    };
  }

  // 4. Tugas AI Kustom Berbasis OpenClaw Gateway
  const customPrompt = payload.prompt || 'Berikan analisis performa penjualan dan rekomendasi operasional untuk hari ini.';
  const systemContext = await buildAiSystemContext({ name: 'System Scheduler', role: 'SYSTEM' });

  try {
    const response = await sendOpenClawChat({
      messages: [
        { role: 'system', content: systemContext },
        { role: 'user', content: customPrompt },
      ],
      userId: 'scheduler',
    });

    const captionHtml = `
🤖 <b>LAPORAN ANALISIS AI TERJADWAL</b>
━━━━━━━━━━━━━━━━━━
<b>Jadwal:</b> ${esc(job.name)}
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB

${esc(response.text)}
━━━━━━━━━━━━━━━━━━
<i>Analisis otomatis via Komazi AI</i>
    `.trim();

    await notifier.toRoles([recipientRole], captionHtml);

    return {
      success: true,
      task: 'custom_ai',
      aiModel: response.model,
      deliveredTo: recipientRole,
    };
  } catch (err) {
    if (err instanceof OpenClawError && err.code === 'AI_DISABLED') {
      logger.scheduler.info(`[AiTaskJob] AI_ENABLED=false, skipping AI inference gracefully.`);
      return {
        success: true,
        skipped: true,
        reason: 'AI_DISABLED',
      };
    }
    throw err;
  }
}
