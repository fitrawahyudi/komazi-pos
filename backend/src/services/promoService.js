import prisma from '../config/db.js';
import { invalidateSettingsCache } from './settingsCache.service.js';

export const DEFAULT_PROMO_PRESETS = [
  {
    id: 'preset_staff_20',
    name: 'Diskon Karyawan 20%',
    shortLabel: 'Karyawan 20%',
    type: 'PERCENT',
    value: 20,
    description: 'Potongan khusus staf & karyawan internal Komazi Coffee',
  },
  {
    id: 'preset_partner_10',
    name: 'Mitra Komunitas 10%',
    shortLabel: 'Mitra 10%',
    type: 'PERCENT',
    value: 10,
    description: 'Diskon mitra bisnis, influencer, dan komunitas rekanan',
  },
  {
    id: 'preset_compliment_drink',
    name: 'Komplimen Minuman',
    shortLabel: 'Komplimen Rp25rb',
    type: 'NOMINAL',
    value: 25000,
    description: 'Potongan satu free item minuman standar (Rp 25.000)',
  },
  {
    id: 'preset_opening_promo',
    name: 'Promo Opening Rp 10.000',
    shortLabel: 'Hemat 10rb',
    type: 'NOMINAL',
    value: 10000,
    description: 'Potongan langsung Rp 10.000 untuk pelanggan terpilih',
  },
];

export const DEFAULT_VOUCHERS = [
  {
    code: 'KOMAZI10',
    name: 'Diskon 10% Spesial',
    type: 'PERCENT',
    value: 10,
    minSpend: 40000,
    maxDiscount: 20000,
    quota: 500,
    usedCount: 0,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    description: 'Diskon 10% dengan minimal transaksi Rp 40.000 (Maksimal Rp 20.000)',
  },
  {
    code: 'HEMAT15K',
    name: 'Voucher Hemat Rp 15.000',
    type: 'NOMINAL',
    value: 15000,
    minSpend: 60000,
    maxDiscount: 15000,
    quota: 200,
    usedCount: 0,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    description: 'Potongan langsung Rp 15.000 dengan minimal transaksi Rp 60.000',
  },
  {
    code: 'NGOPI20',
    name: 'Voucher Ngopi Sore 20%',
    type: 'PERCENT',
    value: 20,
    minSpend: 50000,
    maxDiscount: 25000,
    quota: 100,
    usedCount: 0,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    description: 'Diskon 20% belanja santai sore (Maksimal Rp 25.000)',
  },
];

const SETTING_PRESETS_KEY = 'pos_promo_presets';
const SETTING_VOUCHERS_KEY = 'pos_promo_vouchers';

// In-memory cache for ultra-fast validation
let memoryPresets = null;
let memoryVouchers = null;

/**
 * Format nominal Rupiah sederhana untuk pesan informasi
 */
function formatRp(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Mengambil daftar preset diskon kasir
 */
export async function getPromoPresets() {
  if (memoryPresets !== null && memoryPresets !== undefined) return memoryPresets;

  try {
    const record = await prisma.setting.findUnique({
      where: { key: SETTING_PRESETS_KEY },
    });

    if (record) {
      if (record.value !== null && record.value !== undefined) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) {
            memoryPresets = parsed;
            return memoryPresets;
          }
        } catch (e) {
          console.warn('[PromoService] Gagal parse JSON presets dari DB:', e.message);
        }
      }
      memoryPresets = [];
      return memoryPresets;
    }

    // Seed default presets HANYA jika setting record belum pernah ada sama sekali di database
    memoryPresets = [...DEFAULT_PROMO_PRESETS];
    await prisma.setting.upsert({
      where: { key: SETTING_PRESETS_KEY },
      create: { key: SETTING_PRESETS_KEY, value: JSON.stringify(DEFAULT_PROMO_PRESETS) },
      update: { value: JSON.stringify(DEFAULT_PROMO_PRESETS) },
    }).catch(() => {});

    return memoryPresets;
  } catch (err) {
    console.warn('[PromoService] Database unreachable, fallback to memory presets:', err.message);
    return memoryPresets !== null && memoryPresets !== undefined ? memoryPresets : DEFAULT_PROMO_PRESETS;
  }
}

/**
 * Menyimpan / memperbarui daftar preset diskon
 */
export async function savePromoPresets(presets) {
  if (!Array.isArray(presets)) {
    throw new Error('Presets harus berupa array');
  }
  memoryPresets = presets;
  try {
    await prisma.setting.upsert({
      where: { key: SETTING_PRESETS_KEY },
      create: { key: SETTING_PRESETS_KEY, value: JSON.stringify(presets) },
      update: { value: JSON.stringify(presets) },
    });
    invalidateSettingsCache();
  } catch (err) {
    console.warn('[PromoService] Gagal simpan presets ke DB:', err.message);
  }
  return memoryPresets;
}

/**
 * Mengambil seluruh daftar voucher promo
 */
export async function getPromoVouchers() {
  if (memoryVouchers !== null && memoryVouchers !== undefined) return memoryVouchers;

  try {
    const record = await prisma.setting.findUnique({
      where: { key: SETTING_VOUCHERS_KEY },
    });

    if (record) {
      if (record.value !== null && record.value !== undefined) {
        try {
          const parsed = JSON.parse(record.value);
          if (Array.isArray(parsed)) {
            memoryVouchers = parsed;
            return memoryVouchers;
          }
        } catch (e) {
          console.warn('[PromoService] Gagal parse JSON vouchers dari DB:', e.message);
        }
      }
      memoryVouchers = [];
      return memoryVouchers;
    }

    // Seed default vouchers HANYA jika setting record belum pernah ada sama sekali di database
    memoryVouchers = [...DEFAULT_VOUCHERS];
    await prisma.setting.upsert({
      where: { key: SETTING_VOUCHERS_KEY },
      create: { key: SETTING_VOUCHERS_KEY, value: JSON.stringify(DEFAULT_VOUCHERS) },
      update: { value: JSON.stringify(DEFAULT_VOUCHERS) },
    }).catch(() => {});

    return memoryVouchers;
  } catch (err) {
    console.warn('[PromoService] Database unreachable, fallback to memory vouchers:', err.message);
    return memoryVouchers !== null && memoryVouchers !== undefined ? memoryVouchers : DEFAULT_VOUCHERS;
  }
}

/**
 * Menyimpan daftar voucher ke setting
 */
export async function savePromoVouchers(vouchers) {
  if (!Array.isArray(vouchers)) {
    throw new Error('Vouchers harus berupa array');
  }
  memoryVouchers = vouchers;
  try {
    await prisma.setting.upsert({
      where: { key: SETTING_VOUCHERS_KEY },
      create: { key: SETTING_VOUCHERS_KEY, value: JSON.stringify(vouchers) },
      update: { value: JSON.stringify(vouchers) },
    });
    invalidateSettingsCache();
  } catch (err) {
    console.warn('[PromoService] Gagal simpan vouchers ke DB:', err.message);
  }
  return memoryVouchers;
}

/**
 * Validasi kode voucher terhadap subtotal belanja saat ini
 * @param {string} rawCode - Kode voucher yang diketik kasir
 * @param {number} subtotal - Subtotal belanja saat ini
 * @param {number|null} customerId - ID pelanggan (opsional)
 */
export async function validateVoucher(rawCode, subtotal = 0, customerId = null) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) {
    return {
      valid: false,
      reason: 'EMPTY_CODE',
      error: 'Silakan masukkan kode voucher promo',
    };
  }

  const numSubtotal = Math.max(0, Number(subtotal) || 0);
  const vouchers = await getPromoVouchers();
  const voucher = vouchers.find((v) => (v.code || '').toUpperCase() === code);

  if (!voucher) {
    return {
      valid: false,
      reason: 'NOT_FOUND',
      error: `Kode voucher "${code}" tidak ditemukan atau tidak berlaku.`,
    };
  }

  // 1. Cek status aktif
  if (voucher.isActive === false) {
    return {
      valid: false,
      reason: 'INACTIVE',
      error: `Voucher "${code}" saat ini sedang dinonaktifkan.`,
    };
  }

  // 2. Cek periode tanggal berlaku
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (voucher.startDate && todayStr < voucher.startDate) {
    return {
      valid: false,
      reason: 'NOT_STARTED',
      error: `Voucher "${code}" baru berlaku mulai tanggal ${voucher.startDate}.`,
    };
  }
  if (voucher.endDate && todayStr > voucher.endDate) {
    return {
      valid: false,
      reason: 'EXPIRED',
      error: `Voucher "${code}" telah kedaluwarsa pada ${voucher.endDate}.`,
    };
  }

  // 3. Cek kuota pemakaian
  const quota = Number(voucher.quota) || 0;
  const usedCount = Number(voucher.usedCount) || 0;
  if (quota > 0 && usedCount >= quota) {
    return {
      valid: false,
      reason: 'QUOTA_EXCEEDED',
      error: `Voucher "${code}" telah habis terpakai (kuota ${quota} tercapai).`,
    };
  }

  // 4. Cek minimal belanja
  const minSpend = Number(voucher.minSpend) || 0;
  if (minSpend > 0 && numSubtotal < minSpend) {
    const selisih = minSpend - numSubtotal;
    return {
      valid: false,
      reason: 'MIN_SPEND_NOT_MET',
      error: `Minimal transaksi untuk voucher ini adalah ${formatRp(minSpend)} (kurang ${formatRp(selisih)}).`,
    };
  }

  // 5. Hitung diskon yang diperoleh
  let calculatedDiscount = 0;
  if (voucher.type === 'PERCENT') {
    const percent = Math.min(100, Math.max(0, Number(voucher.value) || 0));
    calculatedDiscount = Math.round((numSubtotal * percent) / 100);
    const maxDiscount = Number(voucher.maxDiscount) || 0;
    if (maxDiscount > 0 && calculatedDiscount > maxDiscount) {
      calculatedDiscount = maxDiscount;
    }
  } else {
    // NOMINAL
    calculatedDiscount = Math.min(numSubtotal, Number(voucher.value) || 0);
  }

  return {
    valid: true,
    voucher: {
      code: voucher.code,
      name: voucher.name,
      type: voucher.type,
      value: Number(voucher.value),
      discountAmount: calculatedDiscount,
      minSpend: Number(voucher.minSpend) || 0,
      maxDiscount: Number(voucher.maxDiscount) || 0,
      description: voucher.description || '',
    },
    message: `Voucher "${voucher.name}" berhasil diterapkan! Hemat ${formatRp(calculatedDiscount)}.`,
  };
}

/**
 * Mencatat pemakaian voucher saat order berhasil dibuat / dibayar
 * @param {string} rawCode
 */
export async function consumeVoucher(rawCode) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return false;

  const vouchers = await getPromoVouchers();
  const index = vouchers.findIndex((v) => (v.code || '').toUpperCase() === code);

  if (index === -1) return false;

  const updated = [...vouchers];
  updated[index] = {
    ...updated[index],
    usedCount: (Number(updated[index].usedCount) || 0) + 1,
  };

  await savePromoVouchers(updated);
  return true;
}

/**
 * Buat voucher baru (Khusus Owner/Manager)
 */
export async function createPromoVoucher(data) {
  const code = (data.code || '').trim().toUpperCase();
  if (!code) throw new Error('Kode voucher wajib diisi');

  const vouchers = await getPromoVouchers();
  if (vouchers.some((v) => (v.code || '').toUpperCase() === code)) {
    throw new Error(`Kode voucher "${code}" sudah digunakan. Gunakan kode lain.`);
  }

  const newVoucher = {
    code,
    name: data.name || `Voucher ${code}`,
    type: data.type === 'NOMINAL' ? 'NOMINAL' : 'PERCENT',
    value: Math.max(0, Number(data.value) || 0),
    minSpend: Math.max(0, Number(data.minSpend) || 0),
    maxDiscount: Math.max(0, Number(data.maxDiscount) || 0),
    quota: Math.max(0, Number(data.quota) || 100),
    usedCount: 0,
    startDate: data.startDate || new Date().toISOString().slice(0, 10),
    endDate: data.endDate || '2027-12-31',
    isActive: data.isActive !== false,
    description: data.description || '',
  };

  const updated = [...vouchers, newVoucher];
  await savePromoVouchers(updated);
  return newVoucher;
}

/**
 * Update voucher (Khusus Owner/Manager)
 */
export async function updatePromoVoucher(targetCode, updates) {
  const code = (targetCode || '').trim().toUpperCase();
  const vouchers = await getPromoVouchers();
  const index = vouchers.findIndex((v) => (v.code || '').toUpperCase() === code);

  if (index === -1) {
    throw new Error(`Voucher dengan kode "${code}" tidak ditemukan`);
  }

  const current = vouchers[index];
  const updatedVoucher = {
    ...current,
    ...updates,
    code: current.code, // Kode tidak dapat diubah sembarangan
  };

  const updated = [...vouchers];
  updated[index] = updatedVoucher;
  await savePromoVouchers(updated);
  return updatedVoucher;
}

/**
 * Hapus voucher (Khusus Owner/Manager)
 */
export async function deletePromoVoucher(targetCode) {
  const code = (targetCode || '').trim().toUpperCase();
  const vouchers = await getPromoVouchers();
  const filtered = vouchers.filter((v) => (v.code || '').toUpperCase() !== code);

  if (filtered.length === vouchers.length) {
    throw new Error(`Voucher "${code}" tidak ditemukan`);
  }

  await savePromoVouchers(filtered);
  return true;
}

/**
 * Reset memory cache (untuk pengujian)
 */
export function _resetPromoCacheForTesting() {
  memoryPresets = null;
  memoryVouchers = null;
}
