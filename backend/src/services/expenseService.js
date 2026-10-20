import prisma from '../config/db.js';

/**
 * Generate sequential reference number format: EXP-YYYYMM-XXXX
 */
async function generateExpenseReferenceNo(tx = prisma) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `EXP-${yearMonth}-`;

  const latestExpense = await tx.expense.findFirst({
    where: {
      referenceNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      referenceNo: 'desc',
    },
    select: {
      referenceNo: true,
    },
  });

  let nextSequence = 1;
  if (latestExpense && latestExpense.referenceNo) {
    const parts = latestExpense.referenceNo.split('-');
    const currentSeq = parseInt(parts[2], 10);
    if (!isNaN(currentSeq)) {
      nextSequence = currentSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export const expenseService = {
  /**
   * Get paginated expenses with filters
   */
  async getExpenses({
    page = 1,
    limit = 20,
    startDate,
    endDate,
    categoryId,
    paymentStatus,
    isCancelled,
    search,
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.date.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId, 10);
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus.toUpperCase();
    }

    if (isCancelled !== undefined && isCancelled !== null && isCancelled !== '') {
      where.isCancelled = isCancelled === 'true' || isCancelled === true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { referenceNo: { contains: q } },
        { description: { contains: q } },
        { recipientVendor: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, username: true } },
          updatedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: parseFloat(item.amount),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Get single expense by ID
   */
  async getExpenseById(id) {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        category: true,
        createdBy: { select: { id: true, name: true, username: true } },
        updatedBy: { select: { id: true, name: true, username: true } },
      },
    });

    if (!expense) return null;

    return {
      ...expense,
      amount: parseFloat(expense.amount),
    };
  },

  /**
   * Create a new expense record
   */
  async createExpense(data, userId) {
    const {
      date,
      categoryId,
      description,
      amount,
      paymentMethod = 'CASH',
      paymentStatus = 'PAID',
      recipientVendor = null,
      sourceType = 'MANUAL',
      sourceRef = null,
      notes = null,
      receiptUrl = null,
    } = data;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Nominal biaya harus lebih besar dari 0');
    }

    const catId = parseInt(categoryId, 10);
    const categoryExists = await prisma.expenseCategory.findUnique({
      where: { id: catId },
    });
    if (!categoryExists) {
      throw new Error('Kategori biaya tidak ditemukan atau tidak valid');
    }

    // Cegah duplikasi referensi sumber (misal dari kas kecil atau PO)
    if (sourceRef && sourceRef.trim()) {
      const duplicateRef = await prisma.expense.findFirst({
        where: {
          sourceRef: sourceRef.trim(),
          isCancelled: false,
        },
      });
      if (duplicateRef) {
        throw new Error(`Transaksi biaya untuk referensi "${sourceRef}" sudah pernah dicatat (${duplicateRef.referenceNo})`);
      }
    }

    let expenseDate;
    if (date) {
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        const now = new Date();
        const [y, m, d] = date.trim().split('-').map(Number);
        expenseDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        expenseDate = new Date(date);
      }
    } else {
      expenseDate = new Date();
    }
    if (isNaN(expenseDate.getTime())) {
      throw new Error('Format tanggal biaya tidak valid');
    }

    return await prisma.$transaction(async (tx) => {
      const referenceNo = await generateExpenseReferenceNo(tx);

      const created = await tx.expense.create({
        data: {
          referenceNo,
          date: expenseDate,
          categoryId: catId,
          description: description.trim(),
          amount: parsedAmount,
          paymentMethod: paymentMethod.toUpperCase(),
          paymentStatus: paymentStatus.toUpperCase(),
          recipientVendor: recipientVendor ? recipientVendor.trim() : null,
          sourceType,
          sourceRef: sourceRef ? sourceRef.trim() : null,
          notes: notes ? notes.trim() : null,
          receiptUrl: receiptUrl || null,
          createdById: userId,
        },
        include: {
          category: true,
          createdBy: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_CREATE',
          detail: {
            expenseId: created.id,
            referenceNo: created.referenceNo,
            amount: parsedAmount,
            categoryId: catId,
            description: created.description,
          },
        },
      });

      return {
        ...created,
        amount: parseFloat(created.amount),
      };
    });
  },

  /**
   * Update an existing expense
   */
  async updateExpense(id, data, userId) {
    const expenseId = parseInt(id, 10);
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('Data biaya tidak ditemukan');
    }

    if (existing.isCancelled) {
      throw new Error('Biaya yang sudah dibatalkan tidak dapat diubah kembali');
    }

    const updateData = {
      updatedById: userId,
    };

    if (data.description !== undefined) {
      if (!data.description.trim()) throw new Error('Deskripsi biaya tidak boleh kosong');
      updateData.description = data.description.trim();
    }

    if (data.amount !== undefined) {
      const parsedAmount = parseFloat(data.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Nominal biaya harus lebih besar dari 0');
      }
      updateData.amount = parsedAmount;
    }

    if (data.categoryId !== undefined) {
      const catId = parseInt(data.categoryId, 10);
      const categoryExists = await prisma.expenseCategory.findUnique({ where: { id: catId } });
      if (!categoryExists) throw new Error('Kategori biaya tidak valid');
      updateData.categoryId = catId;
    }

    if (data.date !== undefined) {
      let expenseDate;
      if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date.trim())) {
        const now = new Date();
        const [y, m, d] = data.date.trim().split('-').map(Number);
        expenseDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        expenseDate = new Date(data.date);
      }
      if (isNaN(expenseDate.getTime())) throw new Error('Format tanggal biaya tidak valid');
      updateData.date = expenseDate;
    }

    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod.toUpperCase();
    }

    if (data.paymentStatus !== undefined) {
      updateData.paymentStatus = data.paymentStatus.toUpperCase();
    }

    if (data.recipientVendor !== undefined) {
      updateData.recipientVendor = data.recipientVendor ? data.recipientVendor.trim() : null;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes ? data.notes.trim() : null;
    }

    if (data.receiptUrl !== undefined) {
      updateData.receiptUrl = data.receiptUrl || null;
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: updateData,
        include: {
          category: true,
          createdBy: { select: { id: true, name: true, username: true } },
          updatedBy: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_UPDATE',
          detail: {
            expenseId,
            referenceNo: updated.referenceNo,
            oldAmount: parseFloat(existing.amount),
            newAmount: parseFloat(updated.amount),
            changes: Object.keys(updateData),
          },
        },
      });

      return {
        ...updated,
        amount: parseFloat(updated.amount),
      };
    });
  },

  /**
   * Cancel an expense (Audit-safe cancellation)
   */
  async cancelExpense(id, reason, userId) {
    const expenseId = parseInt(id, 10);
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new Error('Data biaya tidak ditemukan');
    }

    if (existing.isCancelled) {
      throw new Error('Biaya ini sudah berstatus dibatalkan');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Alasan pembatalan biaya wajib diisi');
    }

    return await prisma.$transaction(async (tx) => {
      const cancelled = await tx.expense.update({
        where: { id: expenseId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledReason: reason.trim(),
          updatedById: userId,
        },
        include: {
          category: true,
          createdBy: { select: { id: true, name: true, username: true } },
          updatedBy: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit trail
      await tx.auditLog.create({
        data: {
          userId,
          action: 'EXPENSE_CANCEL',
          detail: {
            expenseId,
            referenceNo: cancelled.referenceNo,
            amount: parseFloat(cancelled.amount),
            reason: reason.trim(),
          },
        },
      });

      return {
        ...cancelled,
        amount: parseFloat(cancelled.amount),
      };
    });
  },

  /**
   * Expense Summary & Metrics
   */
  async getExpenseSummary({ startDate, endDate } = {}) {
    const where = { isCancelled: false };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.date.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true },
    });

    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    const categoryTotals = {};

    for (const exp of expenses) {
      const amt = parseFloat(exp.amount || 0);
      totalAmount += amt;

      if (exp.paymentStatus === 'PAID') {
        paidAmount += amt;
      } else {
        unpaidAmount += amt;
      }

      const catName = exp.category?.name || 'Tanpa Kategori';
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
    }

    const byCategory = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalCount: expenses.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      byCategory,
    };
  },

  /**
   * Category Management
   */
  async getCategories() {
    return prisma.expenseCategory.findMany({
      include: {
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  },

  async createCategory(data) {
    const { name, description } = data;
    if (!name || !name.trim()) throw new Error('Nama kategori tidak boleh kosong');

    const cleanName = name.trim();
    const existing = await prisma.expenseCategory.findUnique({
      where: { name: cleanName },
    });
    if (existing) throw new Error(`Kategori "${cleanName}" sudah ada`);

    return prisma.expenseCategory.create({
      data: {
        name: cleanName,
        description: description ? description.trim() : null,
        isDefault: false,
      },
    });
  },

  async updateCategory(id, data) {
    const catId = parseInt(id, 10);
    const existing = await prisma.expenseCategory.findUnique({
      where: { id: catId },
    });
    if (!existing) throw new Error('Kategori tidak ditemukan');

    const updateData = {};
    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('Nama kategori tidak boleh kosong');
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    return prisma.expenseCategory.update({
      where: { id: catId },
      data: updateData,
    });
  },

  async deleteCategory(id) {
    const catId = parseInt(id, 10);
    const existing = await prisma.expenseCategory.findUnique({
      where: { id: catId },
      include: { _count: { select: { expenses: true } } },
    });
    if (!existing) throw new Error('Kategori tidak ditemukan');

    if (existing._count.expenses > 0) {
      throw new Error(`Kategori "${existing.name}" tidak dapat dihapus karena memiliki ${existing._count.expenses} data biaya terkait`);
    }

    return prisma.expenseCategory.delete({
      where: { id: catId },
    });
  },
};
