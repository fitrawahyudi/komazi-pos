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

  // Section 1: Data Finansial (Hanya untuk OWNER dan MANAGER)
  if (role === 'OWNER' || role === 'MANAGER') {
    const revToday = sales.totalRevenueFormatted || rupiah(sales.totalRevenue || 0);
    const revYest = yesterday.totalRevenueFormatted || rupiah(yesterday.totalRevenue || 0);
    const orderCount = sales.totalOrders || 0;
    const peakHour = sales.peakHour ? `${sales.peakHour}:00 WIB` : 'Sedang dianalisis';

    sections.push(`
=== DATA PENJUALAN & OMZET HARI INI ===
• Total Omzet Hari Ini: ${revToday} (${orderCount} transaksi selesai)
• Total Omzet Kemarin: ${revYest}
• Jam Tersibuk (Peak Hour): ${peakHour}
• Rata-rata Nilai Transaksi: ${sales.averageBasketFormatted || '-'}
    `.trim());
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

