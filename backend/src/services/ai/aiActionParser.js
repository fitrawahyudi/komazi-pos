/**
 * Operational AI Action Parser (Bahasa Indonesia).
 * Mengekstrak intensi tindakan operasional dari percakapan teks bebas:
 * 1. RESTOCK_INGREDIENT (Penambahan stok bahan baku)
 * 2. SET_MENU_AVAILABILITY (Tandai menu habis / tersedia kembali)
 *
 * Menggunakan pencocokan deterministik & fuzzy entity matcher cerdas
 * bebas halusinasi untuk menjamin keamanan mutasi inventaris POS.
 */

/**
 * Normalisasi string untuk pencocokan teks toleran
 */
export function normalizeEntityString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stopwords umum dalam kalimat perintah percakapan kafe/POS
 */
const COMMAND_STOPWORDS = new Set([
  'tolong', 'bisa', 'minta', 'coba', 'dong', 'ya', 'bro', 'min', 'bot', 'ai',
  'catat', 'catatkan', 'input', 'masukkan', 'tambah', 'tambahkan',
  'stok', 'bahan', 'baku', 'menu', 'produk', 'item',
  'sekarang', 'hari', 'ini', 'dulu', 'lagi', 'sudah',
  'set', 'jadikan', 'tandai', 'ubah', 'ganti', 'status',
]);

/**
 * Menghitung skor kemiripan antara query pengguna dengan nama entitas master di database
 * @param {string} rawQuery - Kata kunci dari input chat
 * @param {string} candidateName - Nama di database (misal: "Fresh Milk Greenfields 1L")
 * @returns {number} Nilai kecocokan 0 - 100
 */
export function calculateEntityMatchScore(rawQuery, candidateName) {
  const normQuery = normalizeEntityString(rawQuery);
  const normCandidate = normalizeEntityString(candidateName);

  if (!normQuery || !normCandidate) return 0;
  if (normQuery === normCandidate) return 100; // Perfect match

  // Jika candidate dimulai dengan query atau sebaliknya
  if (normCandidate.startsWith(normQuery)) return 92;
  if (normQuery.startsWith(normCandidate)) return 88;

  // Jika candidate mengandung kata kunci query utuh
  if (normCandidate.includes(normQuery)) return 85;

  // Pencocokan per kata (token-based overlap)
  const queryTokens = normQuery.split(' ').filter((t) => t.length > 1 && !COMMAND_STOPWORDS.has(t));
  const candidateTokens = normCandidate.split(' ').filter((t) => t.length > 1);

  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  let matchedTokenCount = 0;
  for (const qToken of queryTokens) {
    if (candidateTokens.some((cToken) => cToken.includes(qToken) || qToken.includes(cToken))) {
      matchedTokenCount++;
    }
  }

  const score = Math.round((matchedTokenCount / queryTokens.length) * 80);
  return score;
}

/**
 * Mencari entitas bahan baku terbaik dari database
 * @param {string} query
 * @param {Array<object>} ingredients
 * @returns {object|null}
 */
export function findBestIngredientMatch(query, ingredients = []) {
  if (!query || !Array.isArray(ingredients) || ingredients.length === 0) return null;

  let best = null;
  let highestScore = 0;

  for (const ing of ingredients) {
    const score = calculateEntityMatchScore(query, ing.name);
    if (score > highestScore) {
      highestScore = score;
      best = ing;
    }
  }

  // Ambang batas kecocokan minimal 50%
  return highestScore >= 50 ? { entity: best, score: highestScore } : null;
}

/**
 * Mencari entitas produk/menu terbaik dari database
 * @param {string} query
 * @param {Array<object>} products
 * @returns {object|null}
 */
export function findBestProductMatch(query, products = []) {
  if (!query || !Array.isArray(products) || products.length === 0) return null;

  let best = null;
  let highestScore = 0;

  for (const prod of products) {
    const score = calculateEntityMatchScore(query, prod.name);
    if (score > highestScore) {
      highestScore = score;
      best = prod;
    }
  }

  return highestScore >= 50 ? { entity: best, score: highestScore } : null;
}

/**
 * Parser pola Restock Bahan Baku
 * Contoh:
 * - "catat restock fresh milk 5 liter"
 * - "tambah stok susu uht 10 pack"
 * - "restock 2.5 kg kopi espresso"
 * - "stok masuk biji kopi 3 kg"
 */
export function parseRestockCommand(text, availableIngredients = []) {
  const lower = text.toLowerCase().trim();

  // Pola awalan restock
  const isRestockTrigger = /^(?:catat|catatkan|input|tolong\s+catat)?\s*(?:restock|tambah\s+stok|stok\s+masuk|masuk\s+stok)\b/i.test(lower) ||
    /\b(?:catat|input|tambah)\s+(?:stok|restock)\b/i.test(lower);

  if (!isRestockTrigger) return null;

  // Bersihkan trigger prefix
  let cleaned = lower
    .replace(/^(?:tolong|bisa|minta|coba|dong|min|bot|ai)\s+/i, '')
    .replace(/^(?:catat|catatkan|input|masukkan)?\s*(?:restock|tambah\s+stok|stok\s+masuk|masuk\s+stok)\s*/i, '')
    .trim();

  // Ekstrak angka kuantitas & satuan
  // Pola A: [angka] [satuan] [nama bahan] -> misal: "5 liter fresh milk", "10 pack susu"
  // Pola B: [nama bahan] [angka] [satuan] -> misal: "fresh milk 5 liter", "kopi arabika 2.5 kg"

  let qty = null;
  let unit = null;
  let rawEntityName = '';

  // Deteksi angka (integer atau desimal 2.5 / 2,5)
  const patternA = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/i;
  const matchA = cleaned.match(patternA);

  if (matchA) {
    const num = parseFloat(matchA[1].replace(',', '.'));
    const possibleUnit = (matchA[2] || '').trim();
    const rest = (matchA[3] || '').trim();

    // Pastikan valid
    if (!isNaN(num) && num > 0) {
      qty = num;
      unit = possibleUnit || null;
      rawEntityName = rest;
    }
  }

  // Jika Pola A tidak cocok, coba Pola B: [nama bahan] [angka] [satuan optional]
  if (!qty) {
    const patternB = /^(.*?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/i;
    const matchB = cleaned.match(patternB);

    if (matchB) {
      const rest = (matchB[1] || '').trim();
      const num = parseFloat(matchB[2].replace(',', '.'));
      const possibleUnit = (matchB[3] || '').trim();

      if (!isNaN(num) && num > 0 && rest.length > 0) {
        qty = num;
        unit = possibleUnit || null;
        rawEntityName = rest;
      }
    }
  }

  if (!qty || !rawEntityName) return null;

  // Bersihkan rawEntityName dari kata sambung
  rawEntityName = rawEntityName
    .replace(/^(?:bahan|stok|untuk)?\s+/i, '')
    .replace(/\s+(?:ke\s+dalam\s+stok|ke\s+stok|gudang)$/i, '')
    .trim();

  const matchResult = findBestIngredientMatch(rawEntityName, availableIngredients);
  const matchedIngredient = matchResult ? matchResult.entity : null;

  const currentStockNum = matchedIngredient ? parseFloat(matchedIngredient.stock || 0) : 0;
  const newStockNum = currentStockNum + qty;
  const displayUnit = matchedIngredient?.unit || unit || 'satuan';

  return {
    intent: 'RESTOCK_INGREDIENT',
    actionType: 'RESTOCK',
    rawText: text,
    rawEntityQuery: rawEntityName,
    matchedEntity: matchedIngredient,
    qty,
    unit: displayUnit,
    currentStock: currentStockNum,
    projectedStock: newStockNum,
    summary: matchedIngredient
      ? `Tambah <b>+${qty} ${displayUnit}</b> ke stok <b>${matchedIngredient.name}</b>\n(Sisa saat ini: <code>${currentStockNum}</code> ➔ Proyeksi: <b>${newStockNum} ${displayUnit}</b>)`
      : `Tambah <b>+${qty} ${displayUnit}</b> ke <i>${rawEntityName}</i> (Bahan belum terdaftar di POS)`,
    confidence: matchResult ? matchResult.score : 40,
  };
}

/**
 * Parser pola Ubah Status Ketersediaan Menu (Sold Out / Ready)
 * Contoh:
 * - "matikan menu matcha latte"
 * - "tandai avocado coffee sold out"
 * - "menu caramel macchiato habis"
 * - "aktifkan kembali menu espresso"
 * - "menu croissant sudah ready lagi"
 */
export function parseMenuAvailabilityCommand(text, availableProducts = []) {
  const lower = text.toLowerCase().trim();

  // 1. Deteksi intent SOLD OUT (Habis)
  const isSoldOutPattern =
    /\b(?:matikan|nonaktifkan|tutup|tandai|set|jadikan)?\s*(?:menu|produk)?\s*.*?\b(?:habis|sold\s*out|kosong)\b/i.test(lower) ||
    /^(?:matikan|nonaktifkan|tutup)\s+(?:menu\s+)?(.+)$/i.test(lower);

  // 2. Deteksi intent READY / TERSEDIA (Aktif Kembali)
  const isAvailablePattern =
    /\b(?:aktifkan|buka|nyalakan|tandai|set)?\s*(?:menu|produk)?\s*.*?\b(?:tersedia|ready|ada|buka)\s*(?:lagi|kembali)?\b/i.test(lower) ||
    /^(?:aktifkan|nyalakan|buka)\s+(?:menu\s+)?(.+)$/i.test(lower);

  if (!isSoldOutPattern && !isAvailablePattern) return null;

  // Tentukan target status
  // Default prioritize sold-out if words like 'habis' or 'matikan' appear
  let targetSoldOut = true;
  if (isAvailablePattern && !/\b(?:habis|sold\s*out|kosong|matikan)\b/i.test(lower)) {
    targetSoldOut = false;
  }

  // Ekstrak nama produk mentah
  let rawEntityName = lower
    .replace(/^(?:tolong|bisa|minta|coba|dong|min|bot|ai)\s+/i, '')
    .replace(/^(?:matikan|nonaktifkan|tutup|aktifkan|nyalakan|buka|tandai|set|jadikan|ubah)\s+/i, '')
    .replace(/^(?:menu|produk|item)\s+/i, '')
    .replace(/\b(?:sebagai|jadi)?\s*(?:habis|sold\s*out|kosong|tersedia|ready|ada)\b.*$/i, '')
    .replace(/\b(?:sudah\s+ready|sudah\s+ada|kembali|lagi)\b.*$/i, '')
    .trim();

  if (!rawEntityName || rawEntityName.length < 2) return null;

  const matchResult = findBestProductMatch(rawEntityName, availableProducts);
  const matchedProduct = matchResult ? matchResult.entity : null;

  const statusLabel = targetSoldOut ? '🚫 HABIS (Sold Out)' : '🟢 TERSEDIA (Ready)';
  const actionWord = targetSoldOut ? 'Matikan / Tandai Habis' : 'Aktifkan Kembali';

  return {
    intent: 'SET_MENU_AVAILABILITY',
    actionType: 'TOGGLE_MENU',
    rawText: text,
    rawEntityQuery: rawEntityName,
    matchedEntity: matchedProduct,
    targetSoldOut,
    statusLabel,
    summary: matchedProduct
      ? `${actionWord}: <b>${matchedProduct.name}</b>\n(Status baru: <b>${statusLabel}</b>)`
      : `${actionWord}: <i>${rawEntityName}</i> (Menu belum terdaftar di POS)`,
    confidence: matchResult ? matchResult.score : 40,
  };
}

/**
 * Parser Utama Aksi Operasional AI Copilot
 * @param {string} text - Pesan input pengguna
 * @param {object} contextData - { ingredients: [], products: [] }
 * @returns {object|null}
 */
export function parseOperationalAction(text, { ingredients = [], products = [] } = {}) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (trimmed.length < 3) return null;

  // 1. Uji pola Restock Bahan Baku
  const restockAction = parseRestockCommand(trimmed, ingredients);
  if (restockAction && restockAction.matchedEntity) {
    return restockAction;
  }

  // 2. Uji pola Status Menu (Habis / Tersedia)
  const menuAction = parseMenuAvailabilityCommand(trimmed, products);
  if (menuAction && menuAction.matchedEntity) {
    return menuAction;
  }

  // Jika restock terdeteksi meskipun entity belum 100% cocok (misal nama typo dekat)
  if (restockAction && restockAction.confidence >= 40) {
    return restockAction;
  }

  // Jika menu terdeteksi meskipun entity belum 100% cocok
  if (menuAction && menuAction.confidence >= 40) {
    return menuAction;
  }

  return null;
}
