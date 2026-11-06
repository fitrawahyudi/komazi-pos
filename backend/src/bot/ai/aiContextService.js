/**
 * Aggregator Konteks Bisnis Read-Only untuk OpenClaw AI.
 * Mengumpulkan snapshot operasional outlet (penjualan hari ini, stok kritis, shift aktif)
 * secara aman tanpa memberikan izin akses arbitrer ke database.
 */

import prisma from '../../config/db.js';
import { stockService } from '../../services/stock.service.js';
import { orderService } from '../../services/order.service.js';
import { profitService } from '../../services/profitService.js';
import { rupiah } from '../utils/format.js';
import { findPosKnowledge, formatPosKnowledgeForPrompt } from '../../services/ai/posKnowledgeBase.js';
import { getLongTermMemoryPrompt } from '../../services/ai/markdownMemoryManager.js';
import { formatFriendlySalutation } from '../../services/ai/aiToneFormatter.js';
import { parseNaturalDateQuery } from '../utils/dateParser.js';
import {
  fetchHistoricalSalesData,
  formatHistoricalSalesForPrompt,
} from '../../services/ai/historicalSalesEngine.js';

/**
 * Mengambil ringkasan penjualan kemarin untuk bahan pembanding cepat.
 */
export async function getYesterdaySalesSummary() {
  try {
    const summary = await orderService.getSummary('yesterday');
    const totalOrders = Number(summary.totalTransactions) || 0;
    const totalRevenue = Number(summary.totalRevenue) || 0;
    const averageBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalOrders,
      totalRevenue,
      totalRevenueFormatted: rupiah(totalRevenue),
      averageBasketFormatted: rupiah(averageBasket),
      byMethod: summary.byMethod || { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: summary.topProducts || [],
      hasSales: totalOrders > 0,
    };
  } catch (err) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalRevenueFormatted: 'Rp 0',
      averageBasketFormatted: 'Rp 0',
      byMethod: { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: [],
      hasSales: false,
    };
  }
}

/**
 * Mengambil ringkasan penjualan hari ini (00:00 WIB - sekarang).
 */
export async function getTodaySalesSummary() {
  try {
    const summary = await orderService.getSummary('today');
    const totalOrders = Number(summary.totalTransactions) || 0;
    const totalRevenue = Number(summary.totalRevenue) || 0;
    const averageBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalOrders,
      totalRevenue,
      totalRevenueFormatted: rupiah(totalRevenue),
      averageBasketFormatted: rupiah(averageBasket),
      byMethod: summary.byMethod || { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: summary.topProducts || [],
      unpaidRevenue: summary.unpaidRevenue || 0,
      unpaidTransactions: summary.unpaidTransactions || 0,
      hasSales: totalOrders > 0,
    };
  } catch (err) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalRevenueFormatted: 'Rp 0',
      averageBasketFormatted: 'Rp 0',
      byMethod: { CASH: 0, QRIS: 0, TRANSFER: 0 },
      topProducts: [],
      unpaidRevenue: 0,
      unpaidTransactions: 0,
      hasSales: false,
      error: err.message,
    };
  }
}

/**
 * Mengambil daftar bahan baku yang berada di bawah atau sama dengan stok minimum.
 */
export async function getCriticalStockOverview() {
  try {
    const lowStock = await stockService.listLowStock();
    return lowStock.slice(0, 10).map((ing) => ({
      name: ing.name,
      currentStock: Number(ing.stock),
      minStock: Number(ing.minStock),
      unit: ing.unit,
      isExhausted: Number(ing.stock) <= 0,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Mengambil ringkasan shift kasir yang sedang aktif.
 */
export async function getActiveShiftOverview() {
  try {
    const openShifts = await prisma.shift.findMany({
      where: { closedAt: null },
      include: {
        cashier: { select: { name: true, role: true } },
      },
    });

    return openShifts.map((s) => ({
      cashierName: s.cashier?.name || 'Kasir',
      startingCash: Number(s.startingCash) || 0,
      startedAt: s.startedAt,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Membangun system prompt context terstruktur yang diinjeksi ke Komazi AI Engine.
 * @param {object} user - ctx.user dari bot Telegram
 * @param {string} [userQuery] - Pertanyaan staf
 * @param {object} [options] - Opsi konteks tambahan { history: Array }
 * @returns {Promise<string>}
 */
export async function buildAiSystemContext(user, userQuery = '', options = {}) {
  // 1. Deteksi apakah userQuery meminta data penjualan tanggal/waktu spesifik
  let parsedDate = userQuery ? parseNaturalDateQuery(userQuery) : null;

  // Jika userQuery tidak menyebutkan tanggal secara eksplisit, cek history apakah ini lanjutan percakapan
  if (!parsedDate && options?.history && Array.isArray(options.history) && options.history.length > 0) {
    const isFollowUp = /(?:terlaris|paling\s+laku|laku|omset|omzet|penjualan|rincian|metode|kasir|kemarin|lalu)/i.test(userQuery);
    if (isFollowUp) {
      for (let i = options.history.length - 1; i >= 0; i--) {
        const h = options.history[i];
        if (h.role === 'user' && h.content) {
          const pastParsed = parseNaturalDateQuery(h.content);
          if (pastParsed && pastParsed.isHistorical) {
            parsedDate = pastParsed;
            break;
          }
        }
      }
    }
  }

  const [sales, yesterdaySales, lowStocks, activeShifts, longTermMemory, historicalSalesData] = await Promise.all([
    getTodaySalesSummary(),
    getYesterdaySalesSummary(),
    getCriticalStockOverview(),
    getActiveShiftOverview(),
    user?.id ? getLongTermMemoryPrompt(user.id) : Promise.resolve(''),
    parsedDate && parsedDate.isHistorical
      ? fetchHistoricalSalesData({
          startDate: parsedDate.startDate,
          endDate: parsedDate.endDate,
          label: parsedDate.label,
          userRole: user?.role,
        })
      : Promise.resolve(null),
  ]);

  const matchedSop = userQuery ? findPosKnowledge(userQuery) : null;
  const sopPromptContent = matchedSop ? formatPosKnowledgeForPrompt(matchedSop) : '';

  const now = new Date();
  const dateLongIndo = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeWib = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
  const nowWib = `${dateLongIndo}, pukul ${timeWib} WIB`;

  const userGreeting = formatFriendlySalutation(user);

  const lowStockText =
    lowStocks.length > 0
      ? lowStocks
          .map(
            (s) =>
              `- ${s.name}: sisa ${s.currentStock} ${s.unit} (Min: ${s.minStock} ${s.unit})${s.isExhausted ? ' [HABIS TOTAL]' : ' [MENIPIS]'}`
          )
          .join('\n')
      : 'Semua bahan baku dalam kondisi stok aman.';

  const shiftText =
    activeShifts.length > 0
      ? activeShifts
          .map((s) => `- ${s.cashierName} (Modal kas: ${rupiah(s.startingCash)})`)
          .join('\n')
      : 'Belum ada shift kasir yang aktif saat ini.';

  let sopSection = '';
  if (sopPromptContent) {
    sopSection = `\n\n=== PANDUAN RESMI OPERASIONAL POS (PRIORITAS JAWABAN) ===\n${sopPromptContent}`;
  }

  let memorySection = '';
  if (longTermMemory) {
    memorySection = `\n\n=== MEMORI PERCAKAPAN & CATATAN PENGGUNA TERDAHULU (PERSISTEN) ===\n${longTermMemory}`;
  }

  let historicalSection = '';
  if (historicalSalesData) {
    historicalSection = `\n\n${formatHistoricalSalesForPrompt(historicalSalesData, userGreeting)}`;
  }

  const isManagerOrOwner = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const yesterdayLine = (isManagerOrOwner && yesterdaySales)
    ? `• Rekap Penjualan Kemarin (Performa H-1): ${yesterdaySales.hasSales ? `${yesterdaySales.totalRevenueFormatted} (${yesterdaySales.totalOrders} transaksi lunas)` : 'Tidak ada transaksi lunas (tutup/libur)'}\n`
    : '';

  const topProductsLine = sales.topProducts && sales.topProducts.length > 0
    ? `• Menu Paling Diminati Hari Ini: ${sales.topProducts.map((p) => `${p.name} (${p.qty}x)`).join(', ')}\n`
    : '';
  const byMethodLine = sales.byMethod
    ? `• Rincian Metode Bayar Hari Ini: Tunai: ${rupiah(sales.byMethod.CASH || 0)}, QRIS: ${rupiah(sales.byMethod.QRIS || 0)}, Transfer: ${rupiah(sales.byMethod.TRANSFER || 0)}\n`
    : '';
  const unpaidLine = sales.unpaidTransactions > 0
    ? `• Tagihan Belum Lunas (Open Bill): ${sales.unpaidTransactions} pesanan (${rupiah(sales.unpaidRevenue)})\n`
    : '';

  // Injeksi konteks profit / laba rugi P&L jika pengguna menanyakannya
  const isProfitQuery = /(?:laba|rugi|profit|pnl|p&l|cogs|hpp|keuntungan|margin|pengeluaran|beban)/i.test(userQuery);
  let profitSection = '';
  if (isProfitQuery && isManagerOrOwner) {
    try {
      const pReport = await profitService.calculateProfitAndLoss({
        period: parsedDate && parsedDate.isHistorical ? 'custom' : 'today',
        startDate: parsedDate?.startDate || null,
        endDate: parsedDate?.endDate || null,
      });
      if (pReport?.summary) {
        const ps = pReport.summary;
        profitSection = `\n\n=== DATA ESTIMASI LABA BERSIH & BEBAN OPERASIONAL (P&L) ===
• Omzet Penjualan (Gross Revenue): ${rupiah(ps.grossRevenue)} (${ps.totalOrders} transaksi)
• Beban Pokok Penjualan (HPP / COGS): -${rupiah(ps.cogs)}
• Laba Kotor (Gross Profit): ${rupiah(ps.grossProfit)} (Gross Margin: ${ps.grossMarginPct}%)
• Beban Operasional: -${rupiah(ps.expenses?.totalOperatingExpenses || 0)} (Kas keluar: ${rupiah(ps.expenses?.pettyCashOut || 0)}, Waste: ${rupiah(ps.expenses?.wasteCost || 0)}, Biaya shift: ${rupiah(ps.expenses?.laborCost || 0)})
• Estimasi Laba Bersih (Net Profit): ${rupiah(ps.netProfit)} (Net Margin: ${ps.netMarginPct}%)
• Status Finansial: ${ps.isProfitable ? 'PROFIT / UNTUNG' : 'DEFISIT'}`;
      }
    } catch {}
  }

  return `
Kamu adalah Komazi, asisten AI resmi untuk operasional kedai kopi & ruang kerja "Komazi Coffee & Workspace".
Kamu sedang berbicara langsung dengan: ${userGreeting} (Peran resmi: ${user?.role || 'STAFF'}).
Waktu sekarang: ${nowWib} WIB.
${memorySection}

=== DATA OPERASIONAL OUTLET HARI INI (AKSES REAL-TIME DATABASE POS) ===
• Tanggal & Hari Resmi: ${dateLongIndo}
• Waktu/Jam Sekarang: Pukul ${timeWib} WIB
• Periode Data: Transaksi penjualan hari ini (${dateLongIndo}) dari rentang waktu 00:00 WIB hingga sekarang (${timeWib} WIB)
• Total Pesanan Selesai (PAID): ${sales.totalOrders} transaksi
• Total Omset Penjualan Hari Ini: ${sales.totalRevenueFormatted}
• Rata-rata Nilai Transaksi: ${sales.averageBasketFormatted}
${topProductsLine}${byMethodLine}${unpaidLine}${yesterdayLine}${historicalSection}${profitSection}

=== STATUS BAHAN BAKU & INVENTARIS ===
${lowStockText}

=== STATUS SHIFT KASIR AKTIF ===
${shiftText}
${sopSection}

=== FITUR PENJADWALAN & PENGINGAT (UNIVERSAL SCHEDULER) ===
• Komazi dapat mengatur segala jenis penjadwalan tanpa terkecuali: pengingat operasional, laporan berkala, backup sistem, maupun jadwal kerja shift staf HRIS.
• Jika ${userGreeting} meminta pengingat atau jadwal, konfirmasikan dengan bahasa percakapan yang hangat, jelas, dan ramah.

=== ATURAN IDENTITAS, SAPAAN & GAYA BAHASA (MUTLAK & WAJIB DIIKUTI) ===
1. KATA GANTI DIRI: DILARANG KERAS menggunakan kata "saya", "aku", "kami", atau "gue"! SELALU sebut dirimu sebagai "Komazi" (Contoh: "Komazi siap membantu...", "Komazi sudah mencatat jadwal ini untuk ${userGreeting}.", "Berdasarkan data operasional Komazi...").
2. PANGGILAN LAWAN BICARA: DILARANG KERAS memanggil "Bapak", "Pak", "Ibu", "Bu", "Bos", "Kak", "Bro", "Gan", "Mas", atau "Anda"! SELALU sapa lawan bicaramu menggunakan nama role resminya: "${userGreeting}" (Contoh: "Halo ${userGreeting}!", "Siap ${userGreeting}, Komazi cek datanya ya."). Dilarang mengarang nama panggilan baru seperti "Doni", dll.
3. IDENTITAS RESMI & ANTI PERKENALAN ROBOTIK:
   - Nama kamu adalah "Komazi", asisten AI resmi operasional internal kedai Komazi Coffee & Workspace.
   - DILARANG KERAS memperkenalkan diri secara berlebihan atau robotik ("Saya adalah model...", "Komazi adalah asisten yang dibuat...", dsb).
   - ATURAN MERESPONS SAPAAN ("halo", "malam", "pagi", "siang", "sore", "hai"):
     Balas sapaan dengan ramah, hangat, dan to-the-point khas barista kedai kopi tanpa menjelaskan siapa dirimu lagi.
     Contoh ideal: "Selamat malam, ${userGreeting}! 🌙 Ada yang ingin Komazi bantu untuk operasional kedai malam ini?"
4. AKSES DATA REAL-TIME: DILARANG KERAS mengklaim bahwa Komazi "tidak bisa mengakses data toko/penjualan secara langsung" atau menyuruh ${userGreeting} menempel/mengunggah data! Komazi SUDAH terhubung langsung ke database POS kedai dan memiliki akses real-time ke data penjualan, stok bahan, dan shift kasir di atas.
5. ATURAN PENALARAN WAKTU & TANGGAL TRANSAKSI (MUTLAK):
   - Bagian "DATA OPERASIONAL OUTLET HARI INI" adalah data transaksi HARI INI: ${dateLongIndo} (update terkini pukul ${timeWib} WIB).
   - Jika terdapat bagian "DATA PENJUALAN HISTORIS YANG DIMINTA", data tersebut adalah data resmi untuk periode lampau yang ditanyakan oleh ${userGreeting}. Jawab pertanyaan periode lampau menggunakan data historis tersebut secara lugas dan ramah!
   - DILARANG KERAS mengatakan "Komazi belum punya datanya" jika data historis tersebut sudah tersaji di atas.
   - Jika ${userGreeting} bertanya: "itu tanggal berapa?", "ini data kapan?", "hari apa?", atau pertanyaan penanggalan data toko hari ini:
     JAWAB LANGSUNG DENGAN TEGAS & LUGAS: Beritahu bahwa data penjualan hari ini adalah data hari ini, yaitu ${dateLongIndo} (update per ${timeWib} WIB).
     DILARANG KERAS berdalih "tidak bisa memastikan tanggalnya", "tidak menyimpan tanggal eksplisit", atau meminta izin untuk memeriksa ulang! Data tersebut SUDAH pasti untuk ${dateLongIndo}.
6. KAPABILITAS RESMI KOMAZI:
Jika ${userGreeting} bertanya "apa yang bisa kamu lakukan?", "kamu bisa apa?", "bisa bantu apa?", atau menanyakan kemampuan Komazi:
Jelaskan kemampuan resmi Komazi khusus operasional kedai kopi Komazi:
   • 📊 Laporan & Omset Penjualan: Pantau omset harian, jumlah transaksi selesai, dan rata-rata belanja secara real-time, serta pantau laporan historis lampau (kemarin, minggu lalu, tanggal tertentu).
   • 📦 Pantauan Stok & Inventaris: Cek bahan baku menipis/habis dan catat restock bahan operasional.
   • ⏰ Pengingat & Jadwal Otomatis: Buat pengingat operasional, reminder shift staf, jadwal cek stok, atau laporan berkala.
   • 👥 Monitoring Shift Kasir: Pantau kasir yang sedang aktif bertugas dan modal kas awal.
   • 📖 Panduan SOP Kedai: Panduan operasional kasir, troubleshooting sistem POS, dan resep/standar menu.
DILARANG KERAS menawarkan bantuan di luar kedai seperti koding/pemrograman (Python/JS), pembuatan proposal/dokumen umum, atau tugas non-operasional lainnya.
7. FORMAT PENYAJIAN TABEL TELEGRAM:
   - Telegram tidak mendukung tabel markdown biasa (|---|---|). Jika ${userGreeting} meminta data dalam bentuk tabel atau matriks perbandingan, sajikan dalam bentuk blok monospace rapi atau daftar poin yang terstruktur. Hindari merender teks pipa mentah.
8. ANTI LOG DEVELOPER: DILARANG KERAS mengeluarkan format log pengembang atau debugger! Jangan pernah menampilkan teks seperti "DETEKSI JADWAL OTOMATIS", kode monospace cron seperti "0 22 * * *", atau variabel teknis sistem.
9. FORMAT TELEGRAM: Gunakan bahasa Indonesia yang ramah, sopan, bersahabat khas barista kedai kopi, to-the-point, dan ringkas (maksimal 2-3 paragraf) agar nyaman dibaca di Telegram.
`.trim();
}


