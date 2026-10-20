/**
 * Cron Job Handler: Auto Monthly Asset Depreciation (DEPRECIATION).
 */

import { depreciationService } from '../../depreciationService.js';
import { notifier } from '../../../bot/notifier.js';
import { rupiah, esc } from '../../../bot/utils/format.js';
import logger from '../../../utils/logger.js';

export async function executeDepreciationJob(job = {}) {
  const now = new Date();
  // Tangani timezone Asia/Jakarta
  const jakartaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = jakartaDate.getFullYear();
  const month = jakartaDate.getMonth() + 1;

  logger.scheduler.info(`[DepreciationJob] Processing monthly depreciation for ${month}/${year}`);

  try {
    const result = await depreciationService.processDepreciation(
      {
        year,
        month,
        notes: `Penyusutan aset otomatis terjadwal (Scheduler Job #${job.id || 'CRON'})`,
      },
      null // System process
    );

    const captionHtml = `
🏢 <b>PENYUSUTAN ASET BULANAN (${month}/${year})</b>
━━━━━━━━━━━━━━━━━━
<b>Status:</b> Selesai diproses
<b>Aset Diproses:</b> ${result.processedCount} Aset
<b>Total Beban Penyusutan:</b> <b>${rupiah(result.totalAmount)}</b>
━━━━━━━━━━━━━━━━━━
<i>Dihasilkan otomatis oleh Komazi Asset Engine</i>
    `.trim();

    if (result.processedCount > 0) {
      await notifier.toRoles(['OWNER'], captionHtml).catch((err) => {
        logger.scheduler.warn(`[DepreciationJob] Failed sending Telegram notice: ${err.message}`);
      });
    }

    return {
      success: true,
      year,
      month,
      processedCount: result.processedCount,
      totalAmount: result.totalAmount,
    };
  } catch (err) {
    logger.scheduler.error(`[DepreciationJob] Failed: ${err.message}`);
    throw err;
  }
}
