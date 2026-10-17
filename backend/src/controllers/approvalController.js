import prisma from '../config/db.js';
import { approvalService } from '../services/approval.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getPendingApprovals(req, res) {
  try {
    const list = await approvalService.listPending();
    return successResponse(res, list, 'Daftar permintaan persetujuan berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function decideApproval(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { approve } = req.body;
    const deciderId = req.user.id;

    if (!['OWNER', 'MANAGER'].includes(req.user.role)) {
      return errorResponse(res, 'Hanya Owner atau Manager yang berhak menyetujui permintaan ini', 403);
    }

    const result = await approvalService.decide({
      id,
      deciderId,
      approve: Boolean(approve),
    });

    if (!result.ok) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(
      res,
      result.request,
      result.request.status === 'APPROVED'
        ? 'Permintaan berhasil disetujui'
        : 'Permintaan berhasil ditolak'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
