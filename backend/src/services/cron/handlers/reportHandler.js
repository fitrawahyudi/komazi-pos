/**
 * Cron Job Handler: Laporan Penjualan & Operasional (REPORT).
 */

import { orderService } from '../../order.service.js';
import { notifier } from '../../../bot/notifier.js';
import { notifierVisual } from '../../../bot/utils/sendVisual.js';
import { generateBotImage } from '../../botImage/index.js';
import { rupiah, esc } from '../../../bot/utils/format.js';
import logger from '../../../utils/logger.js';

export async function executeReportJob(job) {
  const payload = job.payload || {};
  const period = payload.period || 'today';
  const recipientRole = payload.recipientRole || 'OWNER';

  logger.scheduler.info(`Executing REPORT job #${job.id} for period: ${period}`);

  const summary = await orderService.getSummary(period);

  const topLines = (summary.topProducts || [])
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${esc(p.name)} (${p.qty} item)`)
    .join('\n') || '-';

  const captionHtml = `
📊 <b>LAPORAN PENJUALAN TERJADWAL (${period.toUpperCase()})</b>
━━━━━━━━━━━━━━━━━━
<b>Jadwal:</b> ${esc(job.name)}
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Rincian Metode Pembayaran:</b>
• Tunai: ${rupiah(summary.byMethod?.CASH || 0)}
• QRIS: ${rupiah(summary.byMethod?.QRIS || 0)}
• Transfer: ${rupiah(summary.byMethod?.TRANSFER || 0)}

<b>Top 5 Menu Terlaris:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
<i>Dihasilkan otomatis oleh Komazi Scheduler</i>
  `.trim();

  try {
    const imagePromise = generateBotImage('daily_close_book', {
      grossSales: summary.totalRevenue,
      discounts: 0,
      tax: Math.round(summary.totalRevenue * 0.1),
      netRevenue: summary.totalRevenue,
      totalTransactions: summary.totalTransactions,
      topProducts: summary.topProducts,
    });

    await notifierVisual.toRoles([recipientRole], {
      imageBufferPromise: imagePromise,
      captionHtml,
    });
  } catch (imgErr) {
    // Fallback jika render kartu gambar gagal, kirim teks HTML
    logger.scheduler.warn(`[ReportJob] Visual card failed, fallback to text: ${imgErr.message}`);
    await notifier.toRoles([recipientRole], captionHtml);
  }

  return {
    success: true,
    totalRevenue: summary.totalRevenue,
    totalTransactions: summary.totalTransactions,
    deliveredTo: recipientRole,
  };
}
