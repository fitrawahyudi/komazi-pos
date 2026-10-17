import { profitService } from '../services/profitService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getProfitAndLossReport(req, res) {
  try {
    const { period = 'today', startDate, endDate } = req.query;

    const report = await profitService.calculateProfitAndLoss({
      period,
      startDate,
      endDate,
    });

    return successResponse(
      res,
      report,
      'Laporan Laba Rugi (P&L) berhasil dihitung'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
