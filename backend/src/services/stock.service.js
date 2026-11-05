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
          stockBefore: currentStock,
          stockAfter: newStock,
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
    ingredientIds,
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

    if (ingredientIds) {
      const ids = (Array.isArray(ingredientIds) ? ingredientIds : String(ingredientIds).split(','))
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        where.ingredientId = { in: ids };
      }
    } else if (ingredientId) {
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
    const take = Math.min(1000, Math.max(1, parseInt(limit, 10) || 20));
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

  async getStockCard({ ingredientId, startDate, endDate, limit = 100, canCost = false } = {}) {
    const id = Number(ingredientId);
    if (!id || isNaN(id)) throw new Error('ID Bahan Baku tidak valid');

    const ingredient = await prisma.ingredient.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        unit: true,
        stock: true,
        minStock: true,
        costPerUnit: true,
        supplierName: true,
      },
    });

    if (!ingredient) throw new Error('Bahan baku tidak ditemukan');

    const currentStock = parseFloat(ingredient.stock || 0);

    const where = { ingredientId: id };
    let start = null;
    let end = null;

    if (startDate) {
      start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
      } else {
        start = null;
      }
    }
    if (endDate) {
      end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
      } else {
        end = null;
      }
    }

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: Math.min(500, Math.max(1, limit)),
    });

    let calculatedOpeningStock = currentStock;
    if (start) {
      const subsequentMovements = await prisma.stockMovement.findMany({
        where: {
          ingredientId: id,
          createdAt: { gte: start },
        },
        select: { qty: true, type: true },
      });

      const netDeltaSinceStart = subsequentMovements.reduce((acc, m) => {
        const q = parseFloat(m.qty || 0);
        if (m.type === 'PURCHASE') return acc + Math.abs(q);
        if (m.type === 'SALE' || m.type === 'WASTE') return acc - Math.abs(q);
        return acc + q;
      }, 0);
      calculatedOpeningStock = Math.round((currentStock - netDeltaSinceStart) * 100) / 100;
    } else if (movements.length > 0) {
      const netDeltaInBatch = movements.reduce((acc, m) => {
        const q = parseFloat(m.qty || 0);
        if (m.type === 'PURCHASE') return acc + Math.abs(q);
        if (m.type === 'SALE' || m.type === 'WASTE') return acc - Math.abs(q);
        return acc + q;
      }, 0);
      calculatedOpeningStock = Math.round((currentStock - netDeltaInBatch) * 100) / 100;
    }

    let running = calculatedOpeningStock;
    let totalIn = 0;
    let totalOut = 0;
    let totalCostIn = 0;
    let totalCostOut = 0;

    const formattedMovements = movements.map((m) => {
      const rawQty = parseFloat(m.qty || 0);
      let netDelta = 0;
      let isIncrease = false;

      if (m.type === 'PURCHASE') {
        netDelta = Math.abs(rawQty);
        isIncrease = true;
      } else if (m.type === 'SALE' || m.type === 'WASTE') {
        netDelta = -Math.abs(rawQty);
        isIncrease = false;
      } else {
        netDelta = rawQty;
        isIncrease = rawQty >= 0;
      }

      const absQty = Math.abs(netDelta);

      const stockBefore = m.stockBefore !== null && m.stockBefore !== undefined
        ? parseFloat(m.stockBefore)
        : running;

      const stockAfter = m.stockAfter !== null && m.stockAfter !== undefined
        ? parseFloat(m.stockAfter)
        : Math.round((running + netDelta) * 100) / 100;

      running = stockAfter;

      if (isIncrease) {
        totalIn += absQty;
        if (m.totalCost) totalCostIn += parseFloat(m.totalCost);
      } else {
        totalOut += absQty;
        if (m.totalCost) totalCostOut += parseFloat(m.totalCost);
      }

      return {
        id: m.id,
        type: m.type,
        qty: netDelta,
        displayQty: `${isIncrease ? '+' : '-'}${absQty}`,
        stockBefore,
        stockAfter,
        unitCost: canCost && m.unitCost !== null ? parseFloat(m.unitCost) : null,
        totalCost: canCost && m.totalCost !== null ? parseFloat(m.totalCost) : null,
        note: m.note || null,
        recordedBy: m.recordedBy || 'Sistem',
        createdAt: m.createdAt,
      };
    });

    formattedMovements.reverse();

    return {
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        currentStock,
        minStock: parseFloat(ingredient.minStock || 0),
        costPerUnit: canCost ? parseFloat(ingredient.costPerUnit || 0) : null,
        supplierName: ingredient.supplierName || null,
      },
      summary: {
        openingStock: calculatedOpeningStock,
        totalIn: Math.round(totalIn * 100) / 100,
        totalOut: Math.round(totalOut * 100) / 100,
        closingStock: running,
        movementCount: formattedMovements.length,
        totalCostIn: canCost ? Math.round(totalCostIn) : null,
        totalCostOut: canCost ? Math.round(totalCostOut) : null,
      },
      movements: formattedMovements,
    };
  },

  async recordInboundBatch({
    inboundNumber,
    supplierName,
    date,
    receivedBy,
    notes,
    items = [],
    canCost = false,
    createExpense = true,
    paymentMethod = 'CASH',
    userId = null,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Daftar item stok masuk tidak boleh kosong');
    }

    const recordedDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const processedMovements = [];
      const updatedIngredients = [];
      let totalInboundCost = 0;

      for (const item of items) {
        let ing = null;
        if (item.ingredientId) {
          ing = await tx.ingredient.findUnique({
            where: { id: Number(item.ingredientId) },
          });
        }
        if (!ing && item.name) {
          ing = await tx.ingredient.findFirst({
            where: { name: String(item.name).trim() },
          });
        }

        if (!ing) {
          throw new Error(`Bahan baku "${item.name || item.ingredientId}" tidak ditemukan di master persediaan`);
        }

        const currentStock = parseFloat(ing.stock || 0);
        const addQty = parseFloat(item.convertedQty || item.qty || 0);
        if (addQty <= 0) continue;

        const newStock = Math.round((currentStock + addQty) * 100) / 100;

        const effectiveCost = (item.effectiveUnitCost !== undefined && item.effectiveUnitCost !== null)
          ? parseFloat(item.effectiveUnitCost)
          : (item.unitCost ? parseFloat(item.unitCost) : null);

        const totalCost = (item.totalCost !== undefined && item.totalCost !== null)
          ? parseFloat(item.totalCost)
          : (effectiveCost !== null ? Math.round(effectiveCost * addQty * 100) / 100 : null);

        if (totalCost && totalCost > 0) {
          totalInboundCost += totalCost;
        }

        const updateData = { stock: newStock };
        if (effectiveCost !== null && effectiveCost > 0) {
          updateData.costPerUnit = effectiveCost;
        }
        if (supplierName && String(supplierName).trim()) {
          updateData.supplierName = String(supplierName).trim();
        }

        const updated = await tx.ingredient.update({
          where: { id: ing.id },
          data: updateData,
        });

        let note = `[${inboundNumber || 'INBOUND'}]`;
        if (item.purchasedUnit && item.purchasedUnit !== ing.unit) {
          note += ` Beli ${item.purchasedQty || item.qty} ${item.purchasedUnit} -> Masuk ${addQty} ${ing.unit}`;
        } else {
          note += ` Stok Masuk: +${addQty} ${ing.unit}`;
        }
        if (supplierName) note += ` • Pemasok: ${supplierName}`;
        if (notes) note += ` (${notes})`;

        const movement = await tx.stockMovement.create({
          data: {
            ingredientId: ing.id,
            type: 'PURCHASE',
            qty: addQty,
            stockBefore: currentStock,
            stockAfter: newStock,
            unitCost: effectiveCost,
            totalCost,
            note,
            recordedBy: receivedBy || 'Staff',
            createdAt: recordedDate,
          },
        });

        processedMovements.push(movement);
        updatedIngredients.push(updated);
      }

      // 2. Otomatisasi sinkronisasi ke tabel Expense (Menu Biaya)
      let createdExpense = null;
      if (createExpense && totalInboundCost > 0) {
        // Dapatkan atau buat Kategori Pengeluaran 'Pembelian Bahan Baku'
        let category = await tx.expenseCategory.findFirst({
          where: { name: 'Pembelian Bahan Baku' },
        });
        if (!category) {
          category = await tx.expenseCategory.create({
            data: {
              name: 'Pembelian Bahan Baku',
              description: 'Belanja persediaan bahan baku dan stok kedai',
              isDefault: true,
            },
          });
        }

        // Tentukan user pembuat
        let creatorId = userId;
        if (!creatorId) {
          const defaultUser = await tx.user.findFirst({
            where: { role: { in: ['OWNER', 'MANAGER'] } },
            select: { id: true },
          });
          creatorId = defaultUser ? defaultUser.id : 1;
        }

        // Generate nomor referensi pengeluaran
        const dateKey = recordedDate.toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const expRefNo = `EXP-${dateKey}-INB${randomSuffix}`;

        createdExpense = await tx.expense.create({
          data: {
            referenceNo: expRefNo,
            date: recordedDate,
            categoryId: category.id,
            description: `Belanja Stok Masuk ${inboundNumber || ''}${supplierName ? ` - ${supplierName}` : ''}`.trim(),
            amount: Math.round(totalInboundCost * 100) / 100,
            paymentMethod: paymentMethod || 'CASH',
            paymentStatus: 'PAID',
            recipientVendor: supplierName ? String(supplierName).trim() : null,
            sourceType: 'INBOUND',
            sourceRef: inboundNumber || expRefNo,
            notes: notes || `Otomatis dari Penerimaan Stok Masuk (${processedMovements.length} item bahan baku)`,
            createdById: creatorId,
          },
        });
      }

      return {
        processedCount: processedMovements.length,
        movements: processedMovements,
        updatedIngredients,
        totalInboundCost: Math.round(totalInboundCost * 100) / 100,
        expense: createdExpense,
      };
    });

    return result;
  },
};

