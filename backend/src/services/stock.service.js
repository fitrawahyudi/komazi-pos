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

  async checkAndEmitLowStock() {
    const lowItems = await this.listLowStock();
    for (const item of lowItems) {
      events.emit('stock.low', {
        ingredientName: item.name,
        currentStock: parseFloat(item.stock),
        minStock: parseFloat(item.minStock),
        unit: item.unit,
      });
    }
    return lowItems;
  },
};
