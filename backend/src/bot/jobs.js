import cron from 'node-cron';
import { notifier } from './notifier.js';
import { orderService } from '../services/order.service.js';
import { stockService } from '../services/stock.service.js';
import { workspaceService } from '../services/workspace.service.js';
import { approvalService } from '../services/approval.service.js';
import { rupiah, esc } from './utils/format.js';

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
• Tunai (Cash): ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Terlaris:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
<i>Laporan otomatis harian Komazi POS @ 22:00 WIB</i>
    `.trim();

    await notifier.toRoles(['OWNER'], text);
  } catch (err) {
    console.warn('[Jobs] Error sending daily report:', err.message);
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
      `.trim();

      await notifier.toRoles(['MANAGER', 'OWNER'], text);
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
        `.trim();

        await notifier.toRoles(['CASHIER', 'MANAGER'], text);
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
      console.log(`[Jobs] Kadaluwarsa otomatis ${expiredCount} permintaan approval yang melebihi 30 menit`);
    }
  } catch (err) {
    console.warn('[Jobs] Error expiring approvals:', err.message);
  }
}

export function startJobs() {
  // 1) Laporan harian ke Owner — 22:00 WIB
  cron.schedule('0 22 * * *', sendDailyReport, { timezone: 'Asia/Jakarta' });

  // 2) Stok menipis — tiap jam pada jam operasional (08:00 - 22:00 WIB)
  cron.schedule('0 8-22 * * *', checkLowStock, { timezone: 'Asia/Jakarta' });

  // 3) Workspace hampir habis — tiap menit
  cron.schedule('* * * * *', checkExpiringSessions, { timezone: 'Asia/Jakarta' });

  // 4) Approval kedaluwarsa — tiap 5 menit
  cron.schedule('*/5 * * * *', expireApprovals, { timezone: 'Asia/Jakarta' });

  console.log('⏰ [Cron Jobs] Telegram automated background jobs scheduled (Asia/Jakarta)');
}
