/**
 * Cron Job Handler: Pengingat Tugas & Reminder (REMINDER).
 * Mengirimkan pesan pengingat terjadwal (one-time atau recurring)
 * ke user atau role tertentu pada waktu Asia/Jakarta yang ditentukan.
 */

import { notifier } from '../../../bot/notifier.js';
import { bot } from '../../../bot/index.js';
import { esc } from '../../../bot/utils/format.js';
import logger from '../../../utils/logger.js';

export async function executeReminderJob(job) {
  const payload = job.payload || {};
  const message = payload.message || payload.text || 'Pengingat otomatis dari sistem Komazi POS.';
  const recipientRole = payload.recipientRole || null;
  const recipientTelegramId = payload.recipientTelegramId || null;

  logger.scheduler.info(`Executing REMINDER job #${job.id}: ${job.name}`);

  const formattedTime = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const reminderHtml = `
⏰ <b>PENGINGAT TERJADWAL</b>
━━━━━━━━━━━━━━━━━━
<b>Judul:</b> ${esc(job.name)}
<b>Waktu:</b> ${formattedTime} WIB

<b>Pesan:</b>
${esc(message)}
━━━━━━━━━━━━━━━━━━
<i>Diset melalui Komazi Job Scheduler</i>
  `.trim();

  let deliveredCount = 0;

  // 1. Kirim ke Telegram ID spesifik jika ada
  if (recipientTelegramId) {
    try {
      await bot.api.sendMessage(recipientTelegramId, reminderHtml, { parse_mode: 'HTML' });
      deliveredCount++;
    } catch (sendErr) {
      logger.scheduler.warn(`[ReminderJob] Failed to send to tgId ${recipientTelegramId}: ${sendErr.message}`);
    }
  }

  // 2. Kirim ke Roles tertentu jika ditentukan
  if (recipientRole) {
    try {
      await notifier.toRoles([recipientRole], reminderHtml);
      deliveredCount++;
    } catch (roleErr) {
      logger.scheduler.warn(`[ReminderJob] Failed to send to role ${recipientRole}: ${roleErr.message}`);
    }
  }

  // Jika tidak ada target spesifik, kirim ke Owner sebagai default
  if (!recipientTelegramId && !recipientRole) {
    await notifier.toRoles(['OWNER'], reminderHtml);
    deliveredCount++;
  }

  return {
    success: true,
    message,
    deliveredCount,
  };
}
