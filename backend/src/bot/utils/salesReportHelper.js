import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from './sendVisual.js';
import { rupiah, esc } from './format.js';

/**
 * Membangun teks caption HTML untuk laporan penjualan
 */
export function buildSalesReportCaption(summary, periodLabel = 'Hari Ini') {
  const topLines = (summary.topProducts || [])
    .map((p, i) => `${i + 1}. ${esc(p.name)}: <b>${p.qty} terjual</b>`)
    .join('\n') || '-';

  const caption = `
📊 <b>LAPORAN PENJUALAN (${periodLabel.toUpperCase()})</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Metode Pembayaran:</b>
• Tunai: ${rupiah(summary.byMethod?.CASH || 0)}
• QRIS Dinamis: ${rupiah(summary.byMethod?.QRIS || 0)}
• Transfer Bank: ${rupiah(summary.byMethod?.TRANSFER || 0)}

<b>Top 5 Menu Paling Diminati:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
  `.trim();

  return caption;
}

/**
 * Kirim visual card + caption laporan penjualan dengan fallback aman
 */
export async function sendSalesReportResponse(ctx, summary, periodLabel = 'Hari Ini') {
  const captionHtml = buildSalesReportCaption(summary, periodLabel);

  return replyWithPhotoFallback(ctx, {
    imageBufferPromise: generateBotImage('sales_report', {
      periodLabel,
      totalRevenue: summary.totalRevenue,
      totalTransactions: summary.totalTransactions,
      byMethod: summary.byMethod,
      topProducts: summary.topProducts,
    }),
    captionHtml,
  });
}
