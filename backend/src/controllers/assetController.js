import { assetService } from '../services/assetService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getAssets(req, res) {
  try {
    const { page, limit, status, category, condition, search } = req.query;

    const result = await assetService.getAssets({
      page,
      limit,
      status,
      category,
      condition,
      search,
    });

    return successResponse(res, result.items, 'Data aset tetap berhasil diambil', 200, result.pagination);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getAssetById(req, res) {
  try {
    const { id } = req.params;
    const asset = await assetService.getAssetById(id);

    if (!asset) {
      return errorResponse(res, 'Aset tetap tidak ditemukan', 404);
    }

    return successResponse(res, asset, 'Detail aset tetap berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function createAsset(req, res) {
  try {
    const userId = req.user.id;
    const asset = await assetService.createAsset(req.body, userId);
    return successResponse(res, asset, 'Aset tetap berhasil didaftarkan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function updateAsset(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updated = await assetService.updateAsset(id, req.body, userId);
    return successResponse(res, updated, 'Informasi aset tetap berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function disposeAsset(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const disposed = await assetService.disposeAsset(id, req.body, userId);
    return successResponse(res, disposed, 'Aset tetap berhasil dilepas / dijual');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getDepreciationSchedule(req, res) {
  try {
    const { id } = req.params;
    const schedule = await assetService.getDepreciationSchedule(id);
    return successResponse(res, schedule, 'Jadwal penyusutan aset berhasil dibuat');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getAssetsSummary(req, res) {
  try {
    const summary = await assetService.getAssetsSummary();
    return successResponse(res, summary, 'Ringkasan aset tetap berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}
