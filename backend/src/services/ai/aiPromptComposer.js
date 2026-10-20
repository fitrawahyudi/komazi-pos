/**
 * Multi-Domain Intent Classifier & Prompt Composer for Komazi AI Engine.
 * Mendeteksi 7 kluster pertanyaan pengguna secara cerdas, mengarahkan aksi interaktif (actionHint),
 * dan merangkai system prompt yang hemat token dengan penegakan keamanan peran (RBAC).
 */

import { findPosKnowledge, formatPosKnowledgeForPrompt } from './posKnowledgeBase.js';
import { formatOperationalSummary } from './komaziAiContextAggregator.js';

export const AI_INTENT_TYPES = {
  POS_MANUAL: 'POS_MANUAL',
  INVENTORY_RECIPE: 'INVENTORY_RECIPE',
  FINANCIAL_SALES: 'FINANCIAL_SALES',
  SHIFT_OPERATIONAL: 'SHIFT_OPERATIONAL',
  WORKSPACE: 'WORKSPACE',
  REMINDER_SCHEDULER: 'REMINDER_SCHEDULER',
  CHITCHAT: 'CHITCHAT',
};

export const INTENT_META = {
  POS_MANUAL: { label: 'Panduan SOP POS', badge: '💡 Panduan POS', icon: '📖' },
  INVENTORY_RECIPE: { label: 'Inventaris & Resep', badge: '☕ Info Resep & Stok', icon: '🧪' },
  FINANCIAL_SALES: { label: 'Penjualan & Omset', badge: '📊 Analisis Finansial', icon: '💰' },
  SHIFT_OPERATIONAL: { label: 'Operasional & Kasir', badge: '💼 Operasional Shift', icon: '💵' },
  WORKSPACE: { label: 'Workspace Coworking', badge: '🏢 Workspace & Tamu', icon: '💻' },
  REMINDER_SCHEDULER: { label: 'Pengingat & Jadwal', badge: '⏰ Pengingat Otomatis', icon: '⏳' },
  CHITCHAT: { label: 'Percakapan Santai', badge: '☕ Komazi AI', icon: '💬' },
};

/**
 * Mengklasifikasikan jenis pertanyaan pengguna ke dalam salah satu dari 7 domain.
 * @param {string} rawQuery
 * @returns {{ intent: string, confidence: number, matchedSop: object|null, meta: object }}
 */
export function classifyIntent(rawQuery = '') {
  const query = (rawQuery || '').toLowerCase().trim();

  // 1. Cek apakah cocok dengan basis pengetahuan SOP POS
  const matchedSop = findPosKnowledge(query);
  if (matchedSop) {
    return {
      intent: AI_INTENT_TYPES.POS_MANUAL,
      confidence: 0.95,
      matchedSop,
      meta: INTENT_META.POS_MANUAL,
    };
  }

  // 2. Deteksi Kata Kunci SOP POS Tambahan
  const posRegex = /(split bill|pisah tagihan|bagi bill|merge bill|gabung bill|thermal|printer|bluetooth|cetak struk|print|cara buka shift|cara tutup shift|void|refund|batal pesanan|panduan|sop|tutorial|prosedur)/i;
  if (posRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.POS_MANUAL,
      confidence: 0.88,
      matchedSop: null,
      meta: INTENT_META.POS_MANUAL,
    };
  }

  // 3. Deteksi Pengingat & Jadwal Otomatis (Cronjob)
  const reminderRegex = /(ingatkan|pengingat|jadwal|jadwalkan|cron|cronjob|alarm|setiap jam|menit lagi|nanti jam|besok jam)/i;
  if (reminderRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.REMINDER_SCHEDULER,
      confidence: 0.92,
      matchedSop: null,
      meta: INTENT_META.REMINDER_SCHEDULER,
    };
  }

  // 4. Deteksi Resep, Komposisi & Inventaris Bahan Baku
  const recipeRegex = /(resep|takaran|komposisi|gramasi|gram|ml|bahan baku|sisa stok|stok menipis|stok habis|kritis|restock|biji kopi|fresh milk|sirup|tepung)/i;
  if (recipeRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.INVENTORY_RECIPE,
      confidence: 0.9,
      matchedSop: null,
      meta: INTENT_META.INVENTORY_RECIPE,
    };
  }

  // 5. Deteksi Shift Kasir & Laci Uang
  const shiftRegex = /(shift|kasir|kas masuk|kas keluar|laci kas|uang di laci|selisih kas|modal kas|rekap shift|petty cash)/i;
  if (shiftRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.SHIFT_OPERATIONAL,
      confidence: 0.88,
      matchedSop: null,
      meta: INTENT_META.SHIFT_OPERATIONAL,
    };
  }

  // 6. Deteksi Workspace Coworking & Sesi Tamu
  const workspaceRegex = /(workspace|coworking|sewa meja|durasi sewa|meja aktif|ruangan|kapasitas|tamu workspace|paket workspace|check in workspace)/i;
  if (workspaceRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.WORKSPACE,
      confidence: 0.89,
      matchedSop: null,
      meta: INTENT_META.WORKSPACE,
    };
  }

  // 7. Deteksi Finansial, Omzet, Kemarin & Analitik Penjualan
  const salesRegex = /(omset|omzet|penjualan|terlaris|paling laku|laku|tren|growth|profit|untung|rugi|qris|tunai|cash|transfer|rata-rata|basket|revenue|pendapatan|kemarin|yesterday|hari lalu|rekap kemarin|data kemarin|laporan kemarin)/i;
  if (salesRegex.test(query)) {
    return {
      intent: AI_INTENT_TYPES.FINANCIAL_SALES,
      confidence: 0.85,
      matchedSop: null,
      meta: INTENT_META.FINANCIAL_SALES,
    };
  }

  // 8. Chitchat & Default
  return {
    intent: AI_INTENT_TYPES.CHITCHAT,
    confidence: 0.7,
    matchedSop: null,
    meta: INTENT_META.CHITCHAT,
  };
}

/**
 * Menentukan Action Hint interaktif untuk tombol navigasi/modal di Web POS Frontend.
 * @param {object} params
 * @param {string} params.intent
 * @param {object|null} params.matchedSop
 * @param {string} params.query
 * @returns {object|null}
 */
// export function resolveActionHint({ intent, matchedSop, query = '' } = {}) {
//   // Prioritas 1: Action Hint bawaan dari entri SOP yang cocok
//   if (matchedSop && matchedSop.actionHint) {
//     return matchedSop.actionHint;
//   }

//   const qLower = query.toLowerCase();

//   // Prioritas 2: Pemetaan berdasarkan kata kunci spesifik
//   if (qLower.includes('printer') || qLower.includes('bluetooth') || qLower.includes('cetak struk')) {
//     return { type: 'OPEN_MODAL', targetModal: 'PRINTER_MODAL', label: 'Buka Pengaturan Printer' };
//   }
//   if (qLower.includes('split') || qLower.includes('pisah tagihan')) {
//     return { type: 'NAVIGATE', route: '/orders', targetModal: 'OPEN_BILLS', label: 'Buka Tagihan Aktif' };
//   }
//   if (qLower.includes('merge') || qLower.includes('gabung')) {
//     return { type: 'NAVIGATE', route: '/orders', targetModal: 'MERGE_BILL', label: 'Buka Panel Gabung Bill' };
//   }
//   if (qLower.includes('shift') || qLower.includes('kasir') || qLower.includes('laci kas') || qLower.includes('modal awal')) {
//     return { type: 'OPEN_MODAL', targetModal: 'SHIFT_MODAL', label: 'Buka Rekap Shift Kasir' };
//   }
//   if (qLower.includes('resep') || qLower.includes('takaran') || qLower.includes('komposisi')) {
//     return { type: 'NAVIGATE', route: '/menu', targetModal: 'RECIPE_MODAL', label: 'Buka Manajemen Resep' };
//   }
//   if (qLower.includes('stok') || qLower.includes('bahan') || qLower.includes('kritis') || qLower.includes('menipis')) {
//     return { type: 'NAVIGATE', route: '/stock', label: 'Buka Manajemen Stok' };
//   }
//   if (qLower.includes('workspace') || qLower.includes('coworking') || qLower.includes('sewa meja')) {
//     return { type: 'NAVIGATE', route: '/workspace', label: 'Buka Manajemen Workspace' };
//   }
//   if (intent === AI_INTENT_TYPES.FINANCIAL_SALES || qLower.includes('kemarin')) {
//     return { type: 'NAVIGATE', route: '/analytics', label: 'Buka Analisis Penjualan' };
//   }

//   return null;
// }

/**
 * Menyusun prompt sistem terpadu (Unified System Prompt) yang ringkas, beridentitas kuat,
 * dan mematuhi batasan RBAC.
 * @param {object} params
 * @param {object} params.user - { id, name, role }
 * @param {string} params.userQuery - Pertanyaan user
 * @param {object} params.unifiedContext - Hasil dari getUnifiedAiContext
 * @param {string} params.intent - Intent terklasifikasi
 * @param {object} [params.matchedSop] - SOP jika ada
 * @returns {string}
 */
export function composeUnifiedSystemPrompt({
  user = {},
  userQuery = '',
  unifiedContext = {},
  intent = AI_INTENT_TYPES.CHITCHAT,
  matchedSop = null,
} = {}) {
  const role = (user.role || unifiedContext.role || 'CASHIER').toUpperCase();
  const userName = user.name || unifiedContext.userName || 'Rekan Komazi';
  const roleLabel = role === 'OWNER' ? 'Owner Kedai' : role === 'MANAGER' ? 'Store Manager' : role === 'BARISTA' ? 'Barista' : role === 'KITCHEN' ? 'Kitchen Staff' : 'Kasir POS';

  // Format ringkasan operasional dari aggregator
  const operationalText = formatOperationalSummary(unifiedContext);

  // Tentukan batasan peran (RBAC Safety Guardrails)
  let rbacRules = '';
  if (role === 'OWNER') {
    rbacRules = `• PERAN: Anda mendampingi Pemilik Kedai (Owner). Anda memiliki wewenang penuh menyampaikan seluruh analitik omset, laba, estimasi HPP bahan baku, evaluasi kasir, dan rekomendasi pertumbuhan bisnis.`;
  } else if (role === 'MANAGER') {
    rbacRules = `• PERAN: Anda mendampingi Store Manager. Berikan informasi operasional harian, perbandingan omset hari ini vs kemarin, status shift kasir, dan stok kritis. Jangan membocorkan margin laba rahasia pemilik atau data penggajian (payroll).`;
  } else if (role === 'CASHIER') {
    rbacRules = `• PERAN: Anda mendampingi Kasir Depan (POS). Bantu dengan SOP penggunaan POS (split bill, printer, shift), ketersediaan menu, dan rekap shift pribadi.
• BATASAN PRIVASI KETAT (ZERO FINANCIAL LEAKAGE): JANGAN PERNAH membocorkan total omset kedai bulanan, laba bersih kedai, atau performa kasir lain. Jika ditanya omset global atau laba, jawab ramah: "Sebagai asisten kasir, saya tidak memiliki akses ke laporan omset global kedai. Silakan berkoordinasi dengan Manager atau Owner."`;
  } else if (role === 'BARISTA') {
    rbacRules = `• PERAN: Anda mendampingi Barista (Bar Minuman). Fokus pada takaran resep kopi/minuman, sisa bahan bar (kopi, susu, sirup), dan minuman terlaris untuk bar preparation.
• BATASAN PRIVASI KETAT: Anda TIDAK MEMILIKI akses ke omset rupiah atau uang tunai.`;
  } else if (role === 'KITCHEN') {
    rbacRules = `• PERAN: Anda mendampingi Kitchen Staff (Dapur Makanan). Fokus pada resep makanan, porsi hidangan, sisa bahan dapur, dan makanan terlaris.
• BATASAN PRIVASI KETAT: Anda TIDAK MEMILIKI akses ke omset rupiah atau uang tunai.`;
  }

  // Injeksi panduan khusus jika cocok dengan SOP POS
  let sopDirective = '';
  if (matchedSop) {
    sopDirective = `
======================================================================
INSTRUKSI PENTING PANDUAN POS (PRIORITAS JAWABAN):
Pengguna sedang menanyakan SOP operasional: "${matchedSop.title}".
Gunakan langkah-langkah resmi yang tercantum di bawah ini untuk menjawab secara lugas, berurutan, dan jelas:
${formatPosKnowledgeForPrompt(matchedSop)}
======================================================================`;
  }

  return `
Anda adalah "Komazi AI", asisten kecerdasan buatan terpadu untuk kedai kopi & ruang kerja modern "Komazi Coffee & Workspace".
Anda sedang berbicara langsung dengan: ${userName} (${roleLabel}).

${rbacRules}
${sopDirective}

DATA OPERASIONAL & PENGETAHUAN KEDAI SAAT INI:
${operationalText}

══════════════════════════════════════════════════════════════════════
ATURAN EMAS KOMUNIKASI & KEAMANAN:
══════════════════════════════════════════════════════════════════════
1. JAWAB DALAM BAHASA INDONESIA YANG RAMAH, JELAS, PROFESIONAL, DAN RINGKAS.
2. DILARANG MENGUTIP KODE PROGRAM / VARIABEL TEKNIS / FORMAT DEVELOPER (DILARANG: criticalLowStockItems, isSoldOut, camelCase, tanda kurung kurawal {}, format JSON mentah).
3. HANYA JAWAB BERDASARKAN DATA RESMI DI ATAS. Jangan berhalusinasi atau mengarang angka di luar data faktual.
4. PENGETAHUAN DATA KEMARIN: Anda memiliki data lengkap penjualan dan operasional kemarin (omset, transaksi, menu terlaris, jam sibuk, metode pembayaran). Jika pengguna menanyakan data kemarin, jawab secara lengkap sesuai data resmi 'DATA PENJUALAN & OPERASIONAL KEMARIN'. Jika kemarin libur/0 transaksi, sampaikan dengan santun dan sertakan data hari operasional terakhir.
5. JIKA DITANYA PENGINGAT ATAU JADWAL: Konfirmasikan pengingat dengan ramah dan sebutkan bahwa jadwal telah disiapkan di sistem.
6. JAGA PERSONA KEDAI KOPI: Bersahabat, sigap melayani, dan selalu siap membantu operasional kasir & kedai kopi.
7. PENYAJIAN TABEL DATA: Jika menyajikan perbandingan data atau daftar metrik (misalnya perbandingan omset hari ini vs kemarin, status shift, daftar stok, atau menu terlaris), SELALU gunakan format tabel Markdown standar yang rapi dengan baris header dan pemisah baris (| Kolom 1 | Kolom 2 | ... / |---|---|...). Gunakan subjudul ringkas seperti '### Interpretasi Singkat' untuk poin analisis.
`.trim();
}
