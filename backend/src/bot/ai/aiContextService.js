/**
 * Aggregator Konteks Bisnis Read-Only untuk OpenClaw AI.
 * Mengumpulkan snapshot operasional outlet (penjualan hari ini, stok kritis, shift aktif)
 * secara aman tanpa memberikan izin akses arbitrer ke database.
 */

import prisma from '../../config/db.js';
import { stockService } from '../../services/stock.service.js';
import { rupiah } from '../utils/format.js';
import { findPosKnowledge, formatPosKnowledgeForPrompt } from '../../services/ai/posKnowledgeBase.js';
import { getLongTermMemoryPrompt } from '../../services/ai/markdownMemoryManager.js';

/**
 * Mengambil ringkasan penjualan hari ini (00:00 WIB - sekarang).
 */
export async function getTodaySalesSummary() {
  try {
    const now = new Date();
    // Gunakan rentang waktu hari ini berdasarkan UTC/lokal
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const paidOrders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        total: true,
        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
        createdAt: true,
      },
    });

    const totalOrders = paidOrders.length;
    let totalRevenue = 0;
    const paymentMethods = {};

    for (const order of paidOrders) {
      const amount = Number(order.total) || 0;
      totalRevenue += amount;
      if (order.payments && order.payments.length > 0) {
        for (const p of order.payments) {
          const method = p.method || 'LAINNYA';
          paymentMethods[method] = (paymentMethods[method] || 0) + (Number(p.amount) || 0);
        }
      }
    }

    const averageBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalOrders,
      totalRevenue,
      totalRevenueFormatted: rupiah(totalRevenue),
      averageBasketFormatted: rupiah(averageBasket),
      paymentMethods,
    };
  } catch (err) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalRevenueFormatted: 'Rp 0',
      averageBasketFormatted: 'Rp 0',
      paymentMethods: {},
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
 * @returns {Promise<string>}
 */
export async function buildAiSystemContext(user, userQuery = '') {
  const [sales, lowStocks, activeShifts, longTermMemory] = await Promise.all([
    getTodaySalesSummary(),
    getCriticalStockOverview(),
    getActiveShiftOverview(),
    user?.id ? getLongTermMemoryPrompt(user.id) : Promise.resolve(''),
  ]);

  const matchedSop = userQuery ? findPosKnowledge(userQuery) : null;
  const sopPromptContent = matchedSop ? formatPosKnowledgeForPrompt(matchedSop) : '';

  const nowWib = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

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

  return `
Kamu adalah Komazi POS AI Assistant, asisten percakapan cerdas untuk kedai kopi & ruang kerja "Komazi Coffee & Workspace".
Kamu berbicara dengan staf internal: ${user?.name || 'Staf'} (Peran: ${user?.role || 'STAFF'}).
Waktu sekarang: ${nowWib} WIB.
${memorySection}

=== DATA OPERASIONAL OUTLET HARI INI ===
• Total Pesanan Selesai (PAID): ${sales.totalOrders} transaksi
• Total Omset Penjualan Hari Ini: ${sales.totalRevenueFormatted}
• Rata-rata Nilai Transaksi: ${sales.averageBasketFormatted}

=== STATUS BAHAN BAKU & INVENTARIS ===
${lowStockText}

=== STATUS SHIFT KASIR AKTIF ===
${shiftText}
${sopSection}

=== FITUR PENJADWALAN & PENGINGAT (UNIVERSAL SCHEDULER) ===
• Kamu dapat mengatur segala jenis penjadwalan tanpa terkecuali: pengingat operasional, laporan berkala, backup sistem, maupun jadwal kerja shift staf HRIS.
• Jika staf meminta pengingat atau jadwal, konfirmasikan dengan bahasa percakapan yang hangat, jelas, dan ramah seperti asisten pribadi kedai kopi.

=== ATURAN DAN PEDOMAN MENJAWAB & GAYA BAHASA (SANGAT PENTING) ===
1. Gunakan bahasa Indonesia yang ramah, sopan, natural, dan bersahabat seperti chatbot pada umumnya (semi-formal, hangat, khas barista/asisten coffee shop).
2. DILARANG KERAS mengeluarkan format log pengembang atau debugger! Jangan pernah menampilkan teks seperti "DETEKSI JADWAL OTOMATIS", kode monospace cron seperti "0 22 * * *", atau variabel teknis sistem.
3. Selalu gunakan kalimat percakapan biasa (contoh: "Siap, Bos! Pengingat untuk periksa oven jam 3 sore sudah saya catat ya.").
4. Jawab pertanyaan faktual mengenai operasional toko berdasarkan data resmi di atas.
5. Jika pengguna menanyakan hal yang pernah dibahas sebelumnya, manfaatkan bagian Memori Percakapan Terdahulu untuk menjawab secara berkesinambungan.
6. Buat jawaban tetap ringkas dan padat (maksimal 2-3 paragraf) agar nyaman dibaca di Telegram.
`.trim();
}

