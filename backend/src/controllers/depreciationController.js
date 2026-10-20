import { depreciationService } from '../services/depreciationService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getDepreciations(req, res) {
  try {
    const { year, month, assetId, page, limit } = req.query;
    const result = await depreciationService.getDepreciations({
      year,
      month,
      assetId,
      page,
      limit,
    });
    return successResponse(res, result.items, 'Riwayat penyusutan berhasil diambil', 200, result.pagination);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function previewDepreciation(req, res) {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return errorResponse(res, 'Tahun dan bulan wajib disertakan untuk pratinjau penyusutan', 422);
    }

    const preview = await depreciationService.previewDepreciation({ year, month });
    return successResponse(res, preview, 'Pratinjau penyusutan bulanan berhasil dihitung');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function processDepreciation(req, res) {
  try {
    const { year, month, notes } = req.body;
    const userId = req.user.id;

    if (!year || !month) {
      return errorResponse(res, 'Tahun dan bulan wajib disertakan untuk pemrosesan penyusutan', 422);
    }

    const result = await depreciationService.processDepreciation({ year, month, notes }, userId);
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}
