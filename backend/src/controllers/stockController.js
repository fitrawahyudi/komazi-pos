import prisma from '../config/db.js';
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
    const { name, unit, stock = 0, minStock = 0, costPerUnit = 0 } = req.body;
    const canCost = canViewCost(req.user?.role);

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        stock,
        minStock,
        costPerUnit: canCost ? (parseFloat(costPerUnit) || 0) : 0,
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
    const { name, unit, minStock, costPerUnit } = req.body;
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
    const { type, qty, note, unitCost } = req.body;
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

    const parsedUnitCost = (type === 'PURCHASE' && unitCost !== undefined && canCost)
      ? parseFloat(unitCost)
      : null;
    const totalCost = (parsedUnitCost !== null)
      ? Math.round(parsedUnitCost * delta * 100) / 100
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          ingredientId,
          type,
          qty: delta,
          unitCost: parsedUnitCost,
          totalCost,
          note: note || null,
        },
      });

      const updateData = { stock: newStock };
      // If purchase has unit cost, update ingredient's standard cost
      if (parsedUnitCost !== null && parsedUnitCost > 0) {
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
      include: {
        recipeItems: true,
        movements: true,
      },
    });

    if (!existing) {
      return errorResponse(res, 'Bahan baku tidak ditemukan', 404);
    }

    if (existing.recipeItems.length > 0) {
      return errorResponse(res, 'Bahan baku tidak dapat dihapus karena masih digunakan dalam resep produk', 400);
    }

    if (existing.movements.length > 0) {
      return errorResponse(res, 'Bahan baku tidak dapat dihapus karena memiliki riwayat mutasi stok', 400);
    }

    await prisma.ingredient.delete({ where: { id } });
    return successResponse(res, null, 'Bahan baku berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
