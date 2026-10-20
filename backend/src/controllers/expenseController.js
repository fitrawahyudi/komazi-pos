import { expenseService } from '../services/expenseService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getExpenses(req, res) {
  try {
    const { page, limit, startDate, endDate, categoryId, paymentStatus, isCancelled, search } = req.query;

    const result = await expenseService.getExpenses({
      page,
      limit,
      startDate,
      endDate,
      categoryId,
      paymentStatus,
      isCancelled,
      search,
    });

    return successResponse(res, result.items, 'Data biaya operasional berhasil diambil', 200, result.pagination);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getExpenseById(req, res) {
  try {
    const { id } = req.params;
    const expense = await expenseService.getExpenseById(id);

    if (!expense) {
      return errorResponse(res, 'Biaya operasional tidak ditemukan', 404);
    }

    return successResponse(res, expense, 'Detail biaya operasional berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function createExpense(req, res) {
  try {
    const userId = req.user.id;
    const expense = await expenseService.createExpense(req.body, userId);
    return successResponse(res, expense, 'Biaya operasional berhasil dicatat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updated = await expenseService.updateExpense(id, req.body, userId);
    return successResponse(res, updated, 'Biaya operasional berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function cancelExpense(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || !reason.trim()) {
      return errorResponse(res, 'Alasan pembatalan biaya wajib diisi', 422);
    }

    const cancelled = await expenseService.cancelExpense(id, reason, userId);
    return successResponse(res, cancelled, 'Biaya operasional berhasil dibatalkan');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getExpenseSummary(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const summary = await expenseService.getExpenseSummary({ startDate, endDate });
    return successResponse(res, summary, 'Ringkasan biaya berhasil dihitung');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getCategories(req, res) {
  try {
    const categories = await expenseService.getCategories();
    return successResponse(res, categories, 'Kategori biaya berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function createCategory(req, res) {
  try {
    const category = await expenseService.createCategory(req.body);
    return successResponse(res, category, 'Kategori biaya berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const category = await expenseService.updateCategory(id, req.body);
    return successResponse(res, category, 'Kategori biaya berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    await expenseService.deleteCategory(id);
    return successResponse(res, null, 'Kategori biaya berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}
