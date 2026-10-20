/**
 * Unified Context Aggregator for Komazi AI Engine.
 * Menghubungkan seluruh sumber data operasional kedai (Penjualan, Shift, Stok, Resep, Workspace)
 * dan menyatukannya dengan basis pengetahuan SOP POS (posKnowledgeBase.js).
 * Dipakai secara bersama oleh Web Dashboard Chatbot maupun Bot Telegram.
 */

import { getRoleScopedBusinessContext } from '../salesAnalyticsEngine.js';
import { findPosKnowledge, formatPosKnowledgeForPrompt } from './posKnowledgeBase.js';
import { rupiah } from '../../bot/utils/format.js';

/**
 * Mengambil konteks bisnis dan teknis operasional terpadu secara aman (Role-Scoped).
 * @param {object} options
 * @param {object} [options.user] - Objek user { id, name, role }
 * @param {string} [options.userQuery] - Pertanyaan user (opsional, untuk mendeteksi SOP spesifik)
 * @returns {Promise<object>}
 */
export async function getUnifiedAiContext({ user = {}, userQuery = '' } = {}) {
  const role = (user?.role || 'CASHIER').toUpperCase();
  const userName = user?.name || user?.username || 'Rekan Komazi';
  const userId = user?.id || null;

  // 1. Ambil data operasional terkini dari database yang telah difilter ketat per role
  const businessContext = await getRoleScopedBusinessContext({ role, userId, userName });

  // 2. Deteksi apakah ada kecocokan dengan SOP Teknis POS
  const matchedSop = userQuery ? findPosKnowledge(userQuery) : null;
  const sopPromptContent = matchedSop ? formatPosKnowledgeForPrompt(matchedSop) : null;

  // 3. Waktu operasional saat ini (Asia/Jakarta WIB)
  const nowWib = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  return {
    role,
    userName,
    userId,
    userQuery,
    nowWib,
    businessContext,
    matchedSop,
    sopPromptContent,
  };
}

/**
 * Menyusun ringkasan teks terstruktur dari data operasional untuk diinjeksikan ke prompt LLM.
 * @param {object} unifiedContext - Objek hasil getUnifiedAiContext
 * @returns {string}
 */
export function formatOperationalSummary(unifiedContext) {
  const { role, userName, nowWib, businessContext, sopPromptContent } = unifiedContext;
  const sales = businessContext?.salesSummary?.today || {};
  const yesterday = businessContext?.salesSummary?.yesterday || {};
  const currentShift = businessContext?.currentShift;
  const inventory = businessContext?.inventory || {};
  const workspace = businessContext?.workspace;

  let sections = [];

  // Header Identitas
  sections.push(`Waktu Sekarang: ${nowWib} WIB`);
  sections.push(`Lawan Bicara: ${userName} (Hak Akses: ${role})`);

  // Section 1: Data Finansial Hari Ini (Hanya untuk OWNER dan MANAGER)
  if (role === 'OWNER' || role === 'MANAGER') {
    const revToday = sales.totalRevenueFormatted || rupiah(sales.totalRevenue || 0);
    const orderCount = sales.totalOrders || 0;
    const peakHour = sales.peakHour
      ? (sales.peakHour.includes('(') ? `${sales.peakHour} WIB` : `${sales.peakHour}:00 WIB`)
      : 'Sedang dianalisis';
    const avgBasket = sales.averageBasketFormatted || (orderCount > 0 ? rupiah(Math.round((sales.totalRevenue || 0) / orderCount)) : '-');

    sections.push(`
=== DATA PENJUALAN & OMZET HARI INI ===
• Total Omzet Hari Ini: ${revToday} (${orderCount} transaksi selesai)
• Jam Tersibuk (Peak Hour): ${peakHour}
• Rata-rata Nilai Transaksi: ${avgBasket}
    `.trim());

    // Section 1b: Data Lengkap Penjualan & Operasional Kemarin
    if (yesterday && yesterday.hasSales) {
      const topList = (yesterday.topProducts || []).slice(0, 5).map((p, idx) =>
        `  ${idx + 1}. ${p.productName}: ${p.qtySold} terjual (${p.revenueFormatted || rupiah(p.revenue)})`
      ).join('\n');
      const payList = (yesterday.paymentMethods || []).map((m) =>
        `  - ${m.method}: ${m.totalAmountFormatted || rupiah(m.totalAmount)} (${m.transactionCount} transaksi)`
      ).join('\n');

      sections.push(`
=== DATA PENJUALAN & OPERASIONAL KEMARIN (${yesterday.dateFormatted || 'Kemarin'}) ===
• Total Omzet Kemarin: ${yesterday.totalRevenueFormatted || rupiah(yesterday.totalRevenue || 0)} (${yesterday.totalOrders || 0} transaksi lunas)
• Rata-rata Nilai Transaksi Kemarin: ${yesterday.averageBasketFormatted || '-'}
• Jam Tersibuk Kemarin (Peak Hour): ${yesterday.peakHour || '-'}
• Menu Terlaris Kemarin:
${topList || '  - Tidak ada data produk'}
• Metode Pembayaran Kemarin:
${payList || '  - Tidak ada data pembayaran'}
• Pertumbuhan vs Kemarin: ${yesterday.growthText || '-'}
      `.trim());
    } else {
      const prev = yesterday?.previousActiveDay;
      let prevText = '';
      if (prev) {
        const prevTop = (prev.topProducts || []).slice(0, 3).map((p, idx) =>
          `  ${idx + 1}. ${p.productName}: ${p.qtySold} terjual (${p.revenueFormatted || rupiah(p.revenue)})`
        ).join('\n');
        prevText = `\n• Referensi Hari Operasional Aktif Terakhir Sebelum Hari Ini (${prev.dateFormatted}, ${prev.daysAgo} hari lalu):
  - Total Omzet: ${prev.totalRevenueFormatted} (${prev.totalOrders} transaksi)
  - Menu Terlaris:
${prevTop || '  - Tidak ada data produk'}
  - Jam Tersibuk: ${prev.peakHour || '-'}`;
      }
      sections.push(`
=== DATA PENJUALAN & OPERASIONAL KEMARIN (${yesterday?.dateFormatted || 'Kemarin'}) ===
• Status: Tidak ada transaksi lunas tercatat pada hari kalender kemarin (kedai tutup/libur atau belum ada penjualan).${prevText}
      `.trim());
    }
  } else if (role === 'CASHIER') {
    if (yesterday?.hasSales) {
      const yTop = yesterday?.topProducts || yesterday?.topProductsForUpsell || [];
      const yTopList = yTop.slice(0, 4).map((p, idx) => `  ${idx + 1}. ${p.productName}: ${p.qtySold} porsi/cup`).join('\n');
      sections.push(`
=== DATA MENU TERLARIS KEMARIN (${yesterday.dateFormatted || 'Kemarin'}) ===
• Menu Terlaris Kemarin:
${yTopList || '  - Tidak ada data'}
      `.trim());
    } else {
      const prev = yesterday?.previousActiveDay;
      const prevTop = (prev?.topProductsForUpsell || prev?.topProducts || []).slice(0, 4).map((p, idx) => `  ${idx + 1}. ${p.productName}: ${p.qtySold} porsi/cup`).join('\n');
      sections.push(`
=== DATA MENU TERLARIS KEMARIN (${yesterday?.dateFormatted || 'Kemarin'}) ===
• Status: Tidak ada transaksi pada hari kalender kemarin (kedai tutup/libur).
${prev ? `• Menu Terlaris Hari Operasional Terakhir (${prev.dateFormatted}):\n${prevTop || '  - Tidak ada data'}` : ''}
      `.trim());
    }
  } else if (role === 'BARISTA') {
    if (yesterday?.hasSales) {
      const yBev = yesterday?.topBeverages || [];
      const yBevList = yBev.slice(0, 4).map((p, idx) => `  - ${p.productName}: ${p.qtySold} cup`).join('\n');
      sections.push(`
=== DATA MINUMAN TERLARIS KEMARIN (${yesterday.dateFormatted || 'Kemarin'}) ===
${yBevList || '  - Tidak ada data'}
      `.trim());
    } else {
      const prev = yesterday?.previousActiveDay;
      const prevBev = (prev?.topBeverages || []).slice(0, 4).map((p, idx) => `  - ${p.productName}: ${p.qtySold} cup`).join('\n');
      sections.push(`
=== DATA MINUMAN TERLARIS KEMARIN (${yesterday?.dateFormatted || 'Kemarin'}) ===
• Status: Tidak ada transaksi pada hari kalender kemarin (kedai tutup/libur).
${prev ? `• Minuman Terlaris Hari Operasional Terakhir (${prev.dateFormatted}):\n${prevBev || '  - Tidak ada data'}` : ''}
      `.trim());
    }
  } else if (role === 'KITCHEN') {
    if (yesterday?.hasSales) {
      const yFood = yesterday?.topFood || [];
      const yFoodList = yFood.slice(0, 4).map((p, idx) => `  - ${p.productName}: ${p.qtySold} porsi`).join('\n');
      sections.push(`
=== DATA MAKANAN TERLARIS KEMARIN (${yesterday.dateFormatted || 'Kemarin'}) ===
${yFoodList || '  - Tidak ada data'}
      `.trim());
    } else {
      const prev = yesterday?.previousActiveDay;
      const prevFood = (prev?.topFood || []).slice(0, 4).map((p, idx) => `  - ${p.productName}: ${p.qtySold} porsi`).join('\n');
      sections.push(`
=== DATA MAKANAN TERLARIS KEMARIN (${yesterday?.dateFormatted || 'Kemarin'}) ===
• Status: Tidak ada transaksi pada hari kalender kemarin (kedai tutup/libur).
${prev ? `• Makanan Terlaris Hari Operasional Terakhir (${prev.dateFormatted}):\n${prevFood || '  - Tidak ada data'}` : ''}
      `.trim());
    }
  }

  // Section 2: Shift Kasir Aktif
  if (currentShift && currentShift.isOpen) {
    sections.push(`
=== STATUS SHIFT KASIR AKTIF ===
• Kasir Bertugas: ${currentShift.cashierName || 'Kasir'}
• Waktu Mulai: ${currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'} WIB
• Modal Kas Awal: ${currentShift.startingCashFormatted || rupiah(currentShift.startingCash || 0)}
• Estimasi Uang Kas Laci: ${currentShift.expectedCashInDrawerFormatted || rupiah(currentShift.expectedCashInDrawer || 0)}
    `.trim());
  } else {
    sections.push(`=== STATUS SHIFT KASIR AKTIF ===\n• Belum ada shift kasir yang aktif saat ini.`);
  }

  // Section 3: Inventaris & Stok Kritis
  const lowStockItems = inventory.criticalLowStockItems || [];
  if (lowStockItems.length > 0) {
    const lowStockList = lowStockItems.slice(0, 8).map((i) =>
      `- ${i.name || i.ingredientName}: sisa ${i.currentStock} ${i.unit} (Min: ${i.minStock} ${i.unit})`
    ).join('\n');
    sections.push(`
=== STATUS BAHAN BAKU KRITIS (PERLU RESTOCK) ===
${lowStockList}
    `.trim());
  } else {
    sections.push(`=== STATUS BAHAN BAKU ===\n• Seluruh bahan baku berada dalam batas stok aman.`);
  }

  // Section 4: Workspace Coworking
  if (workspace && (role === 'OWNER' || role === 'MANAGER' || role === 'CASHIER')) {
    sections.push(`
=== STATUS WORKSPACE COWORKING ===
• Sesi Aktif: ${workspace.totalActiveSessions || 0} tamu
    `.trim());
  }

  // Section 5: Injeksi SOP POS Teknis (jika query mencocokkan SOP)
  if (sopPromptContent) {
    sections.push(`
=== PANDUAN RESMI OPERASIONAL POS (PRIORITAS UNTUK DIJAWABKAN KE USER) ===
${sopPromptContent}
    `.trim());
  }

  // Section 6: Injeksi Resep & Komposisi Menu (jika ditanyakan resep/bahan/takaran)
  const menuCatalog = businessContext?.menuCatalog || [];
  const queryLower = (unifiedContext.userQuery || '').toLowerCase();
  const isRecipeQuery =
    queryLower.includes('resep') ||
    queryLower.includes('takaran') ||
    queryLower.includes('komposisi') ||
    queryLower.includes('bahan') ||
    queryLower.includes('gram') ||
    queryLower.includes('ml');

  if (menuCatalog.length > 0 && isRecipeQuery) {
    const matchedProducts = [];
    for (const cat of menuCatalog) {
      for (const p of cat.products || []) {
        if (
          p.name &&
          (queryLower.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().split(' ').some((w) => w.length > 3 && queryLower.includes(w)))
        ) {
          matchedProducts.push(p);
        }
      }
    }

    const productsToDisplay =
      matchedProducts.length > 0
        ? matchedProducts.slice(0, 5)
        : menuCatalog.flatMap((c) => c.products || []).slice(0, 4);

    if (productsToDisplay.length > 0) {
      const recipeLines = productsToDisplay
        .map((p) => {
          const ingredients =
            p.ingredientsUsed && p.ingredientsUsed.length > 0
              ? p.ingredientsUsed.map((ing) => `    - ${ing}`).join('\n')
              : '    - (Resep belum terdaftar di sistem)';
          return `• ${p.name} (${p.priceFormatted || ''}):\n${ingredients}`;
        })
        .join('\n\n');

      sections.push(`
=== DATA RESEP & KOMPOSISI MENU ===
${recipeLines}
      `.trim());
    }
  }

  return sections.join('\n\n');
}

