import prisma from '../config/db.js';
import { events } from '../bot/events.js';

export const stockService = {
  async listAll() {
    return prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async listLowStock() {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });

    return ingredients.filter((ing) => parseFloat(ing.stock) <= parseFloat(ing.minStock));
  },

  async recordStockIn({ ingredientId, qty, unitCost = null, note = 'Stok Masuk via Bot' }) {
    const numericQty = parseFloat(qty);
    if (numericQty <= 0) throw new Error('Jumlah stok masuk harus lebih dari 0');

    const result = await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUnique({
        where: { id: Number(ingredientId) },
      });
      if (!ing) throw new Error('Bahan baku tidak ditemukan');

      const cost = unitCost ? parseFloat(unitCost) : parseFloat(ing.costPerUnit || 0);

      const movement = await tx.stockMovement.create({
        data: {
          ingredientId: Number(ingredientId),
          type: 'PURCHASE',
          qty: numericQty,
          unitCost: cost,
          totalCost: cost * numericQty,
          note,
        },
      });

      const updated = await tx.ingredient.update({
        where: { id: Number(ingredientId) },
        data: {
          stock: { increment: numericQty },
        },
      });

      return { ingredient: updated, movement };
    });

    return result;
  },

  async recordWaste({ ingredientId, qty, reason = 'Waste / Kalibrasi', recordedBy = 'Staff' }) {
    const numericQty = parseFloat(qty);
    if (!numericQty || numericQty <= 0) throw new Error('Jumlah bahan terbuang (waste) harus lebih dari 0');

    const result = await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUnique({
        where: { id: Number(ingredientId) },
      });
      if (!ing) throw new Error('Bahan baku tidak ditemukan');

      const currentStock = parseFloat(ing.stock || 0);
      const unitCost = parseFloat(ing.costPerUnit || 0);
      const totalCost = Math.round(unitCost * numericQty * 100) / 100;
      const newStock = Math.max(0, currentStock - numericQty);

      const movement = await tx.stockMovement.create({
        data: {
          ingredientId: Number(ingredientId),
          type: 'WASTE',
          qty: -numericQty,
          unitCost: unitCost > 0 ? unitCost : null,
          totalCost: totalCost > 0 ? totalCost : null,
          note: reason,
          recordedBy: recordedBy || 'Staff',
        },
      });

      const updated = await tx.ingredient.update({
        where: { id: Number(ingredientId) },
        data: { stock: newStock },
      });

      return { ingredient: updated, movement, totalCost, unitCost };
    });

    return result;
  },

  async getWasteSummary({ startDate, endDate, limit = 50 } = {}) {
    const where = { type: 'WASTE' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, costPerUnit: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    let totalWasteCost = 0;
    let totalWasteQty = 0;
    const byReason = {};
    const byIngredient = {};

    for (const m of movements) {
      const cost = parseFloat(m.totalCost || 0);
      const absQty = Math.abs(parseFloat(m.qty || 0));
      totalWasteCost += cost;
      totalWasteQty += absQty;

      const reasonKey = m.note || 'Lainnya';
      byReason[reasonKey] = (byReason[reasonKey] || 0) + cost;

      const ingName = m.ingredient?.name || `Bahan #${m.ingredientId}`;
      if (!byIngredient[ingName]) {
        byIngredient[ingName] = { name: ingName, cost: 0, qty: 0, unit: m.ingredient?.unit || '' };
      }
      byIngredient[ingName].cost += cost;
      byIngredient[ingName].qty += absQty;
    }

    return {
      totalWasteCount: movements.length,
      totalWasteCost: Math.round(totalWasteCost * 100) / 100,
      totalWasteQty: Math.round(totalWasteQty * 100) / 100,
      byReason,
      byIngredient: Object.values(byIngredient).sort((a, b) => b.cost - a.cost),
      recentMovements: movements,
    };
  },

  async updateSupplier({ ingredientId, supplierName, supplierPhone }) {
    return prisma.ingredient.update({
      where: { id: Number(ingredientId) },
      data: {
        supplierName: supplierName ? supplierName.trim() : null,
        supplierPhone: supplierPhone ? supplierPhone.trim() : null,
      },
    });
  },

  formatWhatsAppUrl(phone, ingredientName, unit, currentStock = 0, supplierName = '') {
    if (!phone) return null;
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }

    const greeting = supplierName ? `Halo ${supplierName}` : 'Halo Supplier';
    const text = `${greeting}, kami dari Komazi Coffee ingin memesan restock bahan:\n\n• Bahan: *${ingredientName}*\n• Sisa Stok: ${currentStock} ${unit}\n• Status: Memerlukan restock segera\n\nMohon informasi stok & konfirmasi harga terbarunya. Terima kasih! 🙏`;

    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  },

  async checkAndEmitLowStock() {
    const lowItems = await this.listLowStock();
    for (const item of lowItems) {
      events.emit('stock.low', {
        ingredientName: item.name,
        currentStock: parseFloat(item.stock),
        minStock: parseFloat(item.minStock),
        unit: item.unit,
        supplierName: item.supplierName,
        supplierPhone: item.supplierPhone,
      });
    }
    return lowItems;
  },

  async getMovements({
    ingredientId,
    type,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const where = {};

    if (ingredientId) {
      const parsedId = parseInt(ingredientId, 10);
      if (!isNaN(parsedId)) {
        where.ingredientId = parsedId;
      }
    }

    if (type && type !== 'ALL') {
      const upperType = String(type).toUpperCase();
      const validTypes = ['PURCHASE', 'WASTE', 'SALE', 'ADJUSTMENT'];
      if (validTypes.includes(upperType)) {
        where.type = upperType;
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          where.createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { note: { contains: q } },
        { recordedBy: { contains: q } },
        { ingredient: { name: { contains: q } } },
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * take;

    const validSortFields = ['createdAt', 'qty', 'totalCost'];
    const resolvedSortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, items] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true,
              costPerUnit: true,
            },
          },
        },
        orderBy: {
          [resolvedSortField]: resolvedSortOrder,
        },
        skip,
        take,
      }),
    ]);

    const totalPages = Math.ceil(total / take) || 1;

    return {
      items,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages,
      },
    };
  },
};

