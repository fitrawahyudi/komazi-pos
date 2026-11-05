/**
 * Helper Konversi Satuan Inventori & Bahan Baku Komazi POS
 * Mendukung konversi volume (L <-> ml), berat (kg <-> gram), dan kemasan/pack (dus, lusin, slop <-> pcs)
 */

export const UNIT_TYPES = {
  VOLUME: 'VOLUME',
  WEIGHT: 'WEIGHT',
  COUNT: 'COUNT',
  OTHER: 'OTHER',
};

export const COMMON_UNITS = {
  // Volume
  l: { id: 'L', label: 'Liter (L)', type: UNIT_TYPES.VOLUME, toBase: 1000, baseUnit: 'ml' },
  liter: { id: 'L', label: 'Liter (L)', type: UNIT_TYPES.VOLUME, toBase: 1000, baseUnit: 'ml' },
  ml: { id: 'ml', label: 'Mililiter (ml)', type: UNIT_TYPES.VOLUME, toBase: 1, baseUnit: 'ml' },
  mililiter: { id: 'ml', label: 'Mililiter (ml)', type: UNIT_TYPES.VOLUME, toBase: 1, baseUnit: 'ml' },
  galon: { id: 'galon', label: 'Galon 19L (19.000 ml)', type: UNIT_TYPES.VOLUME, toBase: 19000, baseUnit: 'ml' },
  jerigen5l: { id: 'jerigen_5l', label: 'Jerigen 5L (5.000 ml)', type: UNIT_TYPES.VOLUME, toBase: 5000, baseUnit: 'ml' },

  // Berat
  kg: { id: 'kg', label: 'Kilogram (kg)', type: UNIT_TYPES.WEIGHT, toBase: 1000, baseUnit: 'gram' },
  kilogram: { id: 'kg', label: 'Kilogram (kg)', type: UNIT_TYPES.WEIGHT, toBase: 1000, baseUnit: 'gram' },
  gram: { id: 'gram', label: 'Gram (gr)', type: UNIT_TYPES.WEIGHT, toBase: 1, baseUnit: 'gram' },
  gr: { id: 'gram', label: 'Gram (gr)', type: UNIT_TYPES.WEIGHT, toBase: 1, baseUnit: 'gram' },
  g: { id: 'gram', label: 'Gram (gr)', type: UNIT_TYPES.WEIGHT, toBase: 1, baseUnit: 'gram' },
  ons: { id: 'ons', label: 'Ons (100 gr)', type: UNIT_TYPES.WEIGHT, toBase: 100, baseUnit: 'gram' },

  // Satuan / Kemasan
  pcs: { id: 'pcs', label: 'Pieces (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  buah: { id: 'pcs', label: 'Buah (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  biji: { id: 'pcs', label: 'Biji (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  butir: { id: 'pcs', label: 'Butir (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  lembar: { id: 'pcs', label: 'Lembar (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  cup: { id: 'pcs', label: 'Cup (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  porsi: { id: 'pcs', label: 'Porsi (pcs)', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs' },
  lusin: { id: 'lusin', label: 'Lusin (12 pcs)', type: UNIT_TYPES.COUNT, toBase: 12, baseUnit: 'pcs' },
  slop: { id: 'slop', label: 'Roll / Slop (50 pcs)', type: UNIT_TYPES.COUNT, toBase: 50, baseUnit: 'pcs' },
  dus: { id: 'dus', label: 'Dus / Karton', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs', isCustom: true },
  pack: { id: 'pack', label: 'Pack / Kemasan', type: UNIT_TYPES.COUNT, toBase: 1, baseUnit: 'pcs', isCustom: true },
};

/**
 * Normalisasi nama unit menjadi canonical base string
 */
export function normalizeUnit(unitStr = '') {
  if (!unitStr) return 'pcs';
  const clean = String(unitStr).trim().toLowerCase();
  if (COMMON_UNITS[clean]) {
    return COMMON_UNITS[clean].id;
  }
  return unitStr;
}

/**
 * Mendapatkan daftar pilihan satuan belanja berdasarkan satuan master bahan baku
 */
export function getPurchaseUnitOptions(masterUnit = '') {
  const norm = String(masterUnit).trim().toLowerCase();

  if (norm === 'ml' || norm === 'mililiter' || norm === 'cc') {
    return [
      { id: 'L', label: 'Liter (L) [1 L = 1.000 ml]', factor: 1000 },
      { id: 'ml', label: 'Mililiter (ml) [1:1]', factor: 1 },
      { id: 'jerigen_5l', label: 'Jerigen 5 Liter (5.000 ml)', factor: 5000 },
      { id: 'galon', label: 'Galon 19 Liter (19.000 ml)', factor: 19000 },
      { id: 'custom', label: 'Kustom (Botol/Kemasan lain...)', factor: 1, isCustom: true },
    ];
  }

  if (norm === 'gram' || norm === 'gr' || norm === 'g') {
    return [
      { id: 'kg', label: 'Kilogram (kg) [1 kg = 1.000 gr]', factor: 1000 },
      { id: 'gram', label: 'Gram (gr) [1:1]', factor: 1 },
      { id: 'ons', label: 'Ons (100 gr)', factor: 100 },
      { id: 'custom', label: 'Kustom (Kantung/Pack lain...)', factor: 1, isCustom: true },
    ];
  }

  if (norm === 'pcs' || norm === 'cup' || norm === 'buah' || norm === 'butir' || norm === 'lembar' || norm === 'porsi') {
    return [
      { id: masterUnit || 'pcs', label: `${masterUnit || 'Pcs'} [1:1]`, factor: 1 },
      { id: 'lusin', label: 'Lusin (12 pcs)', factor: 12 },
      { id: 'slop_50', label: 'Roll / Slop (50 pcs)', factor: 50 },
      { id: 'pack', label: 'Pack / Kemasan (Isi Kustom)', factor: 1, isCustom: true },
      { id: 'dus', label: 'Dus / Karton (Isi Kustom)', factor: 1, isCustom: true },
    ];
  }

  return [
    { id: masterUnit, label: `${masterUnit} [1:1]`, factor: 1 },
    { id: 'custom', label: 'Kustom (Rasio Pengali)', factor: 1, isCustom: true },
  ];
}

/**
 * Menghitung konversi kuantitas stok & harga satuan efektif
 */
export function calculateInboundConversion({
  masterUnit = 'pcs',
  purchasedQty = 0,
  purchasedUnit = '',
  purchasedUnitCost = 0,
  customMultiplier = 1,
}) {
  const pQty = Number(purchasedQty) || 0;
  const pCost = Number(purchasedUnitCost) || 0;
  const totalAmount = Math.round(pQty * pCost);

  let factor = 1;
  const pUnitClean = String(purchasedUnit).trim().toLowerCase();
  const mUnitClean = String(masterUnit).trim().toLowerCase();

  // Match automatic factors
  if ((mUnitClean === 'ml' || mUnitClean === 'mililiter') && (pUnitClean === 'l' || pUnitClean === 'liter')) {
    factor = 1000;
  } else if ((mUnitClean === 'ml' || mUnitClean === 'mililiter') && pUnitClean === 'jerigen_5l') {
    factor = 5000;
  } else if ((mUnitClean === 'ml' || mUnitClean === 'mililiter') && pUnitClean === 'galon') {
    factor = 19000;
  } else if ((mUnitClean === 'gram' || mUnitClean === 'gr' || mUnitClean === 'g') && (pUnitClean === 'kg' || pUnitClean === 'kilogram')) {
    factor = 1000;
  } else if ((mUnitClean === 'gram' || mUnitClean === 'gr' || mUnitClean === 'g') && pUnitClean === 'ons') {
    factor = 100;
  } else if (pUnitClean === 'lusin') {
    factor = 12;
  } else if (pUnitClean === 'slop_50') {
    factor = 50;
  } else if (pUnitClean === 'custom' || pUnitClean === 'pack' || pUnitClean === 'dus') {
    factor = Number(customMultiplier) > 0 ? Number(customMultiplier) : 1;
  } else {
    factor = 1;
  }

  const convertedQty = Math.round(pQty * factor * 100) / 100;
  const effectiveUnitCost = convertedQty > 0
    ? Math.round((totalAmount / convertedQty) * 100) / 100
    : 0;

  let previewText = '';
  if (factor !== 1) {
    previewText = `+${convertedQty.toLocaleString('id-ID')} ${masterUnit} (Rp ${effectiveUnitCost.toLocaleString('id-ID')} / ${masterUnit})`;
  } else {
    previewText = `+${convertedQty.toLocaleString('id-ID')} ${masterUnit} (Rp ${effectiveUnitCost.toLocaleString('id-ID')} / ${masterUnit})`;
  }

  return {
    factor,
    convertedQty,
    targetUnit: masterUnit,
    totalAmount,
    effectiveUnitCost,
    previewText,
  };
}

