import prisma from '../config/db.js';
import { stockService } from '../services/stock.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

function canViewCost(role) {
  return role === 'OWNER' || role === 'MANAGER';
}

function sanitizeIngredient(ingredient, canCost) {
  if (canCost) return ingredient;
  const { costPerUnit, movements, ...rest } = ingredient;
  return {
    ...rest,
    costPerUnit: null,
    movements: (movements || []).map((m) => {
      const { unitCost, totalCost, ...mRest } = m;
      return mRest;
    }),
  };
}

export async function getIngredients(req, res) {
  try {
    const { search, unit, status, sortBy = 'name', sortOrder = 'asc', page, limit } = req.query;

    const where = {};
    if (search && search.trim() !== '') {
      where.name = { contains: search.trim() };
    }
    if (unit && unit !== 'ALL') {
      where.unit = unit;
    }

    const validSortFields = ['name', 'stock', 'costPerUnit'];
    const resolvedSortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const resolvedSortOrder = sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const allIngredients = await prisma.ingredient.findMany({
      where,
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { [resolvedSortField]: resolvedSortOrder },
    });

    const canCost = canViewCost(req.user?.role);

    let formatted = allIngredients.map((i) => {
      const base = {
        ...i,
        isLowStock: parseFloat(i.stock) <= parseFloat(i.minStock),
      };
      return sanitizeIngredient(base, canCost);
    });

    // Filter by status if provided ('LOW_STOCK' or 'SAFE')
    if (status === 'LOW_STOCK') {
      formatted = formatted.filter((i) => i.isLowStock);
    } else if (status === 'SAFE') {
      formatted = formatted.filter((i) => !i.isLowStock);
    }

    const total = formatted.length;

    // Apply pagination if page or limit query parameters are provided
    if (page || limit) {
      const currentPage = Math.max(1, parseInt(page) || 1);
      const perPage = Math.max(1, parseInt(limit) || 10);
      const totalPages = Math.ceil(total / perPage) || 1;
      const startIndex = (currentPage - 1) * perPage;
      const paginatedItems = formatted.slice(startIndex, startIndex + perPage);

      return successResponse(
        res,
        paginatedItems,
        'Daftar bahan baku berhasil diambil',
        200,
        {
          page: currentPage,
          limit: perPage,
          total,
          totalPages,
        }
      );
    }

    return successResponse(res, formatted, 'Daftar bahan baku berhasil diambil', 200, { total });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createIngredient(req, res) {
  try {
    const { name, unit, stock = 0, minStock = 0, costPerUnit = 0, supplierName = null, supplierPhone = null } = req.body;
    const canCost = canViewCost(req.user?.role);

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        stock,
        minStock,
        costPerUnit: canCost ? (parseFloat(costPerUnit) || 0) : 0,
        supplierName: supplierName ? supplierName.trim() : null,
        supplierPhone: supplierPhone ? supplierPhone.trim() : null,
      },
    });

    return successResponse(
      res,
      sanitizeIngredient(ingredient, canCost),
      'Bahan baku berhasil ditambahkan',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateIngredient(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, unit, minStock, costPerUnit, supplierName, supplierPhone } = req.body;
    const canCost = canViewCost(req.user?.role);

    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, 'Bahan baku tidak ditemukan', 404);
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (unit !== undefined) data.unit = unit;
    if (minStock !== undefined) data.minStock = parseFloat(minStock);
    if (costPerUnit !== undefined && canCost) {
      data.costPerUnit = parseFloat(costPerUnit);
    }
    if (supplierName !== undefined) {
      data.supplierName = supplierName ? supplierName.trim() : null;
    }
    if (supplierPhone !== undefined) {
      data.supplierPhone = supplierPhone ? supplierPhone.trim() : null;
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data,
    });

    return successResponse(
      res,
      sanitizeIngredient(updated, canCost),
      'Bahan baku berhasil diperbarui'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function recordMovement(req, res) {
  try {
    const ingredientId = parseInt(req.params.id);
    const { type, qty, note, unitCost, recordedBy } = req.body;
    const canCost = canViewCost(req.user?.role);

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return errorResponse(res, 'Bahan baku tidak ditemukan', 404);
    }

    const currentStock = parseFloat(ingredient.stock);
    const numQty = parseFloat(qty);
    let delta = 0;
    let newStock = currentStock;

    if (type === 'PURCHASE') {
      delta = Math.abs(numQty);
      newStock += delta;
    } else if (type === 'WASTE' || type === 'SALE') {
      delta = -Math.abs(numQty);
      newStock = Math.max(0, newStock + delta);
    } else if (type === 'ADJUSTMENT') {
      // Set to actual stock opname count
      delta = numQty - currentStock;
      newStock = Math.max(0, numQty);
    }

    const ingredientCost = parseFloat(ingredient.costPerUnit || 0);
    const parsedUnitCost = (type === 'PURCHASE' && unitCost !== undefined && canCost)
      ? parseFloat(unitCost)
      : (type === 'WASTE' ? ingredientCost : null);

    const totalCost = (parsedUnitCost !== null)
      ? Math.round(parsedUnitCost * Math.abs(delta) * 100) / 100
      : null;

    const recordedByName = recordedBy || req.user?.name || (req.user?.role ? `${req.user.role}` : 'Staff');

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          ingredientId,
          type,
          qty: delta,
          unitCost: parsedUnitCost,
          totalCost,
          note: note || null,
          recordedBy: recordedByName,
        },
      });

      const updateData = { stock: newStock };
      // If purchase has unit cost, update ingredient's standard cost
      if (parsedUnitCost !== null && parsedUnitCost > 0 && type === 'PURCHASE') {
        updateData.costPerUnit = parsedUnitCost;
      }

      const updated = await tx.ingredient.update({
        where: { id: ingredientId },
        data: updateData,
      });

      return { movement, updated };
    });

    return successResponse(
      res,
      {
        movement: canCost ? result.movement : (({ unitCost, totalCost, ...rest }) => rest)(result.movement),
        updated: sanitizeIngredient(result.updated, canCost),
      },
      'Mutasi stok berhasil dicatat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteIngredient(req, res) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.ingredient.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse(res, 'Bahan baku tidak ditemukan', 404);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Bersihkan referensi resep produk untuk bahan ini
      await tx.productRecipeItem.deleteMany({
        where: { ingredientId: id },
      });
      // 2. Bersihkan riwayat mutasi stok untuk bahan ini
      await tx.stockMovement.deleteMany({
        where: { ingredientId: id },
      });
      // 3. Hapus data bahan baku
      await tx.ingredient.delete({
        where: { id },
      });
    });

    return successResponse(res, { id }, 'Bahan baku berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bulkDeleteIngredients(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Daftar ID bahan baku harus berupa array dan tidak boleh kosong', 400);
    }

    const numericIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (numericIds.length === 0) {
      return errorResponse(res, 'Tidak ada ID bahan baku yang valid', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.productRecipeItem.deleteMany({
        where: { ingredientId: { in: numericIds } },
      });
      await tx.stockMovement.deleteMany({
        where: { ingredientId: { in: numericIds } },
      });
      await tx.ingredient.deleteMany({
        where: { id: { in: numericIds } },
      });
    });

    return successResponse(
      res,
      { count: numericIds.length, deletedIds: numericIds },
      `${numericIds.length} bahan baku berhasil dihapus`
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bulkCreateIngredients(req, res) {
  try {
    const { ingredients = [] } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return errorResponse(res, 'Daftar bahan baku tidak valid atau kosong', 400);
    }

    const createdList = [];
    await prisma.$transaction(async (tx) => {
      for (const item of ingredients) {
        if (!item.name || !item.name.trim()) continue;

        const stock = Math.max(0, parseFloat(item.stock) || 0);
        const minStock = Math.max(0, parseFloat(item.minStock) || 0);
        const costPerUnit = Math.max(0, parseFloat(item.costPerUnit) || 0);

        const ing = await tx.ingredient.create({
          data: {
            name: item.name.trim(),
            unit: item.unit ? item.unit.trim().toLowerCase() : 'pcs',
            stock,
            minStock,
            costPerUnit,
          },
        });

        // Record initial stock movement if initial stock > 0
        if (stock > 0) {
          await tx.stockMovement.create({
            data: {
              ingredientId: ing.id,
              type: 'IN',
              amount: stock,
              unitCost: costPerUnit,
              totalCost: stock * costPerUnit,
              reason: 'Stok Awal Import Excel',
            },
          });
        }

        createdList.push(ing);
      }
    });

    return successResponse(res, createdList, `${createdList.length} bahan baku berhasil diimpor`, 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function recordWaste(req, res) {
  try {
    const ingredientId = parseInt(req.params.id);
    const { qty, reason, recordedBy } = req.body;
    const canCost = canViewCost(req.user?.role);

    if (!qty || parseFloat(qty) <= 0) {
      return errorResponse(res, 'Jumlah bahan terbuang (qty) harus lebih besar dari 0', 400);
    }

    const staffName = recordedBy || req.user?.name || (req.user?.role ? `${req.user.role}` : 'Staff');

    const result = await stockService.recordWaste({
      ingredientId,
      qty,
      reason: reason || 'Waste / Kalibrasi',
      recordedBy: staffName,
    });

    return successResponse(
      res,
      {
        movement: canCost ? result.movement : (({ unitCost, totalCost, ...rest }) => rest)(result.movement),
        ingredient: sanitizeIngredient(result.ingredient, canCost),
        totalCost: canCost ? result.totalCost : null,
      },
      'Pencatatan waste berhasil disimpan',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getWasteAnalytics(req, res) {
  try {
    const { startDate, endDate, limit } = req.query;
    const summary = await stockService.getWasteSummary({
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 50,
    });

    return successResponse(res, summary, 'Data analitik waste berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getWhatsAppRestockUrl(req, res) {
  try {
    const ingredientId = parseInt(req.params.id);
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return errorResponse(res, 'Bahan baku tidak ditemukan', 404);
    }

    if (!ingredient.supplierPhone) {
      return errorResponse(res, 'Bahan baku ini belum memiliki nomor kontak supplier', 400);
    }

    const url = stockService.formatWhatsAppUrl(
      ingredient.supplierPhone,
      ingredient.name,
      ingredient.unit,
      parseFloat(ingredient.stock || 0),
      ingredient.supplierName
    );

    return successResponse(
      res,
      { url, supplierName: ingredient.supplierName, supplierPhone: ingredient.supplierPhone },
      'Link WhatsApp berhasil dibuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}



