/**
 * Historical Sales Intelligence Engine for Komazi AI
 * Mengintegrasikan pencarian penjualan historis/lampau (tanggal spesifik, kemarin, rentang waktu)
 * langsung dari database POS dengan penegakan batasan hak akses (RBAC).
 */

import { orderService } from '../order.service.js';
import { rupiah } from '../../bot/utils/format.js';

const ALLOWED_ROLES = ['OWNER', 'MANAGER'];

/**
 * Mengambil data penjualan historis berdasarkan rentang waktu dan peran pengguna.
 * @param {object} params
 * @param {Date} params.startDate - Waktu awal rentang
 * @param {Date} params.endDate - Waktu akhir rentang
 * @param {string} params.label - Label periode ramah manusia (misal: "Selasa, 27 Oktober 2026")
 * @param {string} [params.userRole] - Role pengguna (OWNER, MANAGER, CASHIER, BARISTA)
 * @returns {Promise<object>}
 */
export async function fetchHistoricalSalesData({ startDate, endDate, label, userRole = 'CASHIER' }) {
  const role = String(userRole || 'CASHIER').toUpperCase();

  // 1. Penegakan Hak Akses: Hanya OWNER dan MANAGER yang boleh melihat laporan omset historis
  if (!ALLOWED_ROLES.includes(role)) {
    return {
      isAllowed: false,
      role,
      label,
      reason: 'ROLE_RESTRICTED',
    };
  }

  try {
    const summary = await orderService.getSummary({
      startDate,
      endDate,
      label,
    });

    const totalRevenue = Number(summary.totalRevenue) || 0;
    const totalTransactions = Number(summary.totalTransactions) || 0;
    const avgBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    return {
      isAllowed: true,
      label,
      startDate,
      endDate,
      totalRevenue,
      totalRevenueFormatted: rupiah(totalRevenue),
      totalTransactions,
      averageBasketFormatted: rupiah(avgBasket),
      byMethod: summary.byMethod || { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: summary.topProducts || [],
      hasSales: totalTransactions > 0,
    };
  } catch (err) {
    return {
      isAllowed: true,
      label,
      startDate,
      endDate,
      totalRevenue: 0,
      totalRevenueFormatted: 'Rp 0',
      totalTransactions: 0,
      averageBasketFormatted: 'Rp 0',
      byMethod: { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: [],
      hasSales: false,
      error: err.message,
    };
  }
}

/**
 * Memformat hasil penjualan historis menjadi system prompt section yang diinjeksi ke Komazi AI.
 * @param {object} histData - Hasil dari fetchHistoricalSalesData
 * @param {string} userGreeting - Sapaan resmi pengguna (misal: "Owner Doni")
 * @returns {string}
 */
export function formatHistoricalSalesForPrompt(histData, userGreeting = 'Rekan Komazi') {
  if (!histData) return '';

  if (!histData.isAllowed) {
    return `
=== KEBIJAKAN AKSES DATA LAPORAN HISTORIS (RESTRIKSI KEAMANAN) ===
• Pengguna yang bertanya saat ini memiliki hak akses: "${histData.role || 'STAFF'}".
• ATURAN MUTLAK: Informasi finansial, omset penjualan, dan rekap historis masa lalu kedai adalah data rahasia yang HANYA BOLEH diakses oleh OWNER dan MANAGER.
• PANDUAN MENJAWAB: Sampaikan secara ramah dan sopan kepada ${userGreeting} bahwa sebagai staf kedai, data omset periode tersebut tidak dapat ditampilkan, dan sarankan untuk menghubungi Owner atau Store Manager jika memerlukan data laporan tersebut.
`.trim();
  }

  const labelUpper = String(histData.label || 'PERIODE HISTORIS').toUpperCase();

  if (histData.hasSales) {
    const topMenuList = (histData.topProducts || []).slice(0, 5).map((p, idx) =>
      `  ${idx + 1}. ${p.name}: ${p.qty} terjual`
    ).join('\n') || '  - Rincian item tidak tersedia';

    const byMethod = histData.byMethod || {};
    const qrisVal = rupiah(byMethod.QRIS || 0);
    const cashVal = rupiah(byMethod.CASH || 0);
    const trfVal = rupiah(byMethod.TRANSFER || 0);

    return `
=== DATA PENJUALAN HISTORIS YANG DIMINTA (${labelUpper}) ===
• Periode Laporan: ${histData.label}
• Status: Terverifikasi dari database transaksi POS Komazi
• Total Omset Penjualan: ${histData.totalRevenueFormatted}
• Total Pesanan Selesai (PAID): ${histData.totalTransactions} transaksi
• Rata-rata Nilai Transaksi: ${histData.averageBasketFormatted}
• Menu Terlaris:
${topMenuList}
• Rincian Metode Pembayaran:
  - QRIS: ${qrisVal}
  - Tunai (Cash): ${cashVal}
  - Transfer Bank: ${trfVal}

• PANDUAN MUTLAK KOMAZI DALAM MENJAWAB:
  Data transaksi dan omset resmi untuk periode "${histData.label}" di atas SUDAH LENGKAP dan VALID dari database POS.
  Jawab langsung angka omset dan transaksinya kepada ${userGreeting} dengan bahasa yang hangat, percaya diri, dan to-the-point!
  DILARANG KERAS berdalih "Komazi belum punya datanya", "belum bisa menampilkan", atau menyuruh ${userGreeting} mengirim struk!
`.trim();
  }

  return `
=== DATA PENJUALAN HISTORIS YANG DIMINTA (${labelUpper}) ===
• Periode Laporan: ${histData.label}
• Status: Tidak ada transaksi penjualan lunas yang tercatat di database POS pada periode ini (kedai libur/tutup atau belum ada penjualan).
• Total Omset: Rp 0
• Total Pesanan Selesai (PAID): 0 transaksi

• PANDUAN MUTLAK KOMAZI DALAM MENJAWAB:
  Beritahu ${userGreeting} dengan ramah bahwa pada periode "${histData.label}", sistem mencatat belum ada transaksi lunas (kedai libur atau belum beroperasi).
  DILARANG menyuruh ${userGreeting} mengirim foto struk atau mengunggah data manual.
`.trim();
}
