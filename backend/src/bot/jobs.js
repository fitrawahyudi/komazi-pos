import cron from 'node-cron';
import { notifier } from './notifier.js';
import { orderService } from '../services/order.service.js';
import { stockService } from '../services/stock.service.js';
import { workspaceService } from '../services/workspace.service.js';
import { approvalService } from '../services/approval.service.js';
import { rupiah, esc } from './utils/format.js';
import { generateBotImage } from '../services/botImage/index.js';
import { notifierVisual } from './utils/sendVisual.js';
import {
  dispatchMorningBriefing,
  dispatchEveningWrapup,
  dispatchStockoutAlert,
} from '../services/aiProactiveScheduler.js';
import { startCronWorker } from '../services/cron/cronWorker.js';
import logger from '../utils/logger.js';

// Cache untuk mencegah notifikasi ganda
const notifiedExpiringSessions = new Set();
let notifiedLowStockSet = new Set();

async function sendDailyReport() {
  try {
    const summary = await orderService.getSummary('today');

    const topLines = (summary.topProducts || [])
      .map((p, i) => `${i + 1}. ${esc(p.name)} (${p.qty} item)`)
      .join('\n') || '-';

    const text = `
🌙 <b>LAPORAN PENJUALAN HARIAN (TUTUP BUKU)</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet Hari Ini:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Metode Pembayaran:</b>
• Tunai: ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Terlaris:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
<i>Laporan otomatis harian @ 22:00 WIB • @komazi-assistant</i>
    `.trim();

    const imagePromise = generateBotImage('daily_close_book', {
      grossSales: summary.totalRevenue,
      discounts: 0,
      tax: Math.round(summary.totalRevenue * 0.1),
      netRevenue: summary.totalRevenue,
      totalTransactions: summary.totalTransactions,
      topProducts: summary.topProducts,
    });

    await notifierVisual.toRoles(['OWNER'], {
      imageBufferPromise: imagePromise,
      captionHtml: text,
    });
    logger.scheduler.info('Daily sales report (close book) dispatched to Owner');
  } catch (err) {
    logger.scheduler.warn(`Error sending daily report: ${err.message}`);
  }
}

async function checkLowStock() {
  try {
    const lowItems = await stockService.listLowStock();
    const currentLowKeys = new Set(lowItems.map((i) => `${i.id}_${i.stock}`));

    // Hanya kirim jika ada item yang baru menipis atau berubah
    const hasNew = [...currentLowKeys].some((k) => !notifiedLowStockSet.has(k));
    if (hasNew && lowItems.length > 0) {
      notifiedLowStockSet = currentLowKeys;

      const lines = lowItems
        .map((i) => `• <b>${esc(i.name)}</b>: Sisa ${i.stock} ${i.unit} (Min: ${i.minStock})`)
        .join('\n');

      const text = `
⚠️ <b>PERINGATAN RUTIN: STOK MENIPIS</b>
━━━━━━━━━━━━━━━━━━
${lines}
━━━━━━━━━━━━━━━━━━
<i>Gunakan /stok_masuk untuk mencatat restock.</i>

🤖 <i>@komazi-assistant</i>
      `.trim();

      const imagePromise = generateBotImage('inventory_critical', {
        items: lowItems,
      });

      await notifierVisual.toRoles(['MANAGER', 'OWNER'], {
        imageBufferPromise: imagePromise,
        captionHtml: text,
      });
    }
  } catch (err) {
    console.warn('[Jobs] Error checking low stock:', err.message);
  }
}

async function checkExpiringSessions() {
  try {
    const expiring = await workspaceService.listExpiringSessions(10);

    for (const session of expiring) {
      if (!notifiedExpiringSessions.has(session.id)) {
        notifiedExpiringSessions.add(session.id);

        const text = `
⏰ <b>PERINGATAN WAKTU WORKSPACE</b>
━━━━━━━━━━━━━━━━━━
Area: <b>${esc(session.area?.name)}</b>
Pelanggan: <b>${esc(session.customerName)}</b>
Sisa Waktu: <b>${session.remainingMinutes} Menit</b> lagi
━━━━━━━━━━━━━━━━━━
<i>Harap informasikan ke tamu untuk persiapan check-out atau perpanjangan.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();

        const imagePromise = generateBotImage('workspace_expiry', {
          customerName: session.customerName,
          areaName: session.area?.name,
          remainingMinutes: session.remainingMinutes,
        });

        await notifierVisual.toRoles(['CASHIER', 'MANAGER'], {
          imageBufferPromise: imagePromise,
          captionHtml: text,
        });
      }
    }

    // Bersihkan sesi yang sudah tidak aktif dari Set
    if (notifiedExpiringSessions.size > 100) {
      notifiedExpiringSessions.clear();
    }
  } catch (err) {
    console.warn('[Jobs] Error checking expiring sessions:', err.message);
  }
}

async function expireApprovals() {
  try {
    const expiredCount = await approvalService.expireOldApprovals(30);
    if (expiredCount > 0) {
      logger.scheduler.info(`Expired ${expiredCount} approval requests (>30m)`, { count: expiredCount });
    }
  } catch (err) {
    logger.scheduler.warn(`Error expiring approvals: ${err.message}`);
  }
}

export function startJobs() {
  // 1) Pemeliharaan internal server runtime (non-bisnis / in-memory tracking)
  // Workspace hampir habis — tiap menit
  cron.schedule('* * * * *', checkExpiringSessions, { timezone: 'Asia/Jakarta' });

  // Approval kedaluwarsa — tiap 5 menit
  cron.schedule('*/5 * * * *', expireApprovals, { timezone: 'Asia/Jakarta' });

  // 2) Mulai Mesin Penjadwal Terpusat (Central Dynamic CronWorker)
  // Seluruh tugas bisnis terjadwal (Laporan Penjualan Harian 22:00 WIB, Peringatan Stok Menipis,
  // System Health Sentinel, Database Backup, serta AI Executive Briefing) dikelola secara terpusat
  // oleh CronWorker berbasis tabel ScheduledJob dengan kontrol konkurensi atomik dan idempotency.
  // Ini mengeliminasi eksekusi ganda (duplicate run) yang sebelumnya terjadi akibat adanya cron statis ganda.
  startCronWorker().catch((err) => {
    logger.scheduler.error(`Failed to start dynamic cron worker: ${err.message}`);
  });

  logger.scheduler.info('Telegram automated background jobs & Central Dynamic Cron Engine started (Asia/Jakarta)');
}
