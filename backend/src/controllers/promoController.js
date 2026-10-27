import {
  getPromoPresets,
  savePromoPresets,
  getPromoVouchers,
  validateVoucher,
  createPromoVoucher,
  updatePromoVoucher,
  deletePromoVoucher,
} from '../services/promoService.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * GET /api/promos/presets
 * Mengambil daftar preset diskon cepat untuk kasir
 */
export async function getPresetsHandler(req, res) {
  try {
    const presets = await getPromoPresets();
    return successResponse(res, presets, 'Daftar preset diskon kasir berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PUT /api/promos/presets
 * Memperbarui daftar preset diskon (Khusus OWNER / MANAGER)
 */
export async function updatePresetsHandler(req, res) {
  try {
    const { presets } = req.body;
    if (!Array.isArray(presets)) {
      return errorResponse(res, 'Field "presets" harus berupa array', 400);
    }
    const updated = await savePromoPresets(presets);
    return successResponse(res, updated, 'Preset diskon kasir berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/promos/validate-voucher
 * Validasi kode voucher terhadap subtotal keranjang belanja kasir
 */
export async function validateVoucherHandler(req, res) {
  try {
    const { code, subtotal, customerId } = req.body;
    if (!code) {
      return errorResponse(res, 'Kode voucher wajib diisi', 400);
    }

    const result = await validateVoucher(code, subtotal, customerId);
    if (!result.valid) {
      return errorResponse(res, result.error, 400, { reason: result.reason });
    }

    return successResponse(res, result.voucher, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * GET /api/promos/vouchers
 * Mengambil seluruh daftar voucher promo (Khusus OWNER / MANAGER)
 */
export async function getVouchersHandler(req, res) {
  try {
    const vouchers = await getPromoVouchers();
    return successResponse(res, vouchers, 'Daftar voucher promo berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/promos/vouchers
 * Membuat kode voucher promo baru (Khusus OWNER / MANAGER)
 */
export async function createVoucherHandler(req, res) {
  try {
    const newVoucher = await createPromoVoucher(req.body);
    return successResponse(res, newVoucher, `Voucher "${newVoucher.code}" berhasil dibuat`, 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

/**
 * PUT /api/promos/vouchers/:code
 * Memperbarui data voucher promo (Khusus OWNER / MANAGER)
 */
export async function updateVoucherHandler(req, res) {
  try {
    const { code } = req.params;
    const updated = await updatePromoVoucher(code, req.body);
    return successResponse(res, updated, `Voucher "${code}" berhasil diperbarui`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

/**
 * DELETE /api/promos/vouchers/:code
 * Menghapus voucher promo (Khusus OWNER / MANAGER)
 */
export async function deleteVoucherHandler(req, res) {
  try {
    const { code } = req.params;
    await deletePromoVoucher(code);
    return successResponse(res, { code }, `Voucher "${code}" berhasil dihapus`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}
