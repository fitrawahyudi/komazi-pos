import prisma from '../config/db.js';
import { events } from '../bot/events.js';

/**
 * Service untuk mengelola pengurangan stok bahan baku secara otomatis (BOM / Recipe)
 * terintegrasi dengan transaksi POS dan KDS/BDS.
 */
export const inventoryService = {
  /**
   * Validasi apakah stok bahan baku mencukupi untuk daftar item pesanan.
   * @param {Array} items - [{ productId, variantName, qty }]
   * @returns {Promise<{ isAvailable: boolean, missing: Array }>}
   */
  async checkStockAvailability(items = []) {
    const requiredIngredients = new Map();

    for (const item of items) {
      const qty = parseInt(item.qty || 1, 10);
      const recipeItems = await prisma.productRecipeItem.findMany({
        where: {
          productId: parseInt(item.productId, 10),
          ...(item.variantId ? { variantId: parseInt(item.variantId, 10) } : {}),
        },
        include: { ingredient: true },
      });

      for (const r of recipeItems) {
        const currentReq = requiredIngredients.get(r.ingredientId) || {
          ingredient: r.ingredient,
          needed: 0,
        };
        currentReq.needed += parseFloat(r.quantity) * qty;
        requiredIngredients.set(r.ingredientId, currentReq);
      }
    }

    const missing = [];
    for (const [, req] of requiredIngredients) {
      const currentStock = parseFloat(req.ingredient.stock);
      if (currentStock < req.needed) {
        missing.push({
          ingredientId: req.ingredient.id,
          name: req.ingredient.name,
          available: currentStock,
          needed: req.needed,
          unit: req.ingredient.unit,
        });
      }
    }

    return {
      isAvailable: missing.length === 0,
      missing,
    };
  },

  /**
   * Mengurangi stok bahan baku saat pesanan dibayar (STATUS: PAID).
   * Idempotent: jika transaksi sudah pernah memotong stok, fungsi ini tidak akan memotong ulang.
   * @param {number} orderId
   * @param {object} tx - Prisma transaction client (opsional)
   */
  async deductOrderStock(orderId, tx = null) {
    const client = tx || prisma;

    const order = await client.order.findUnique({
      where: { id: parseInt(orderId, 10) },
      include: {
        items: {
          include: {
            product: {
              include: {
                variants: true,
                recipeItems: {
                  include: { ingredient: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) return { success: false, message: 'Pesanan tidak ditemukan' };

    // Idempotency check: Jangan potong stok dua kali untuk order yang sama
    const existingMovement = await client.stockMovement.findFirst({
      where: {
        note: { contains: `Sale: Order #${order.id} (${order.invoiceNo})` },
        type: 'SALE',
      },
    });

    if (existingMovement) {
      return { success: true, alreadyDeducted: true, orderId: order.id };
    }

    const movementsToCreate = [];
    const lowStockAlerts = [];

    for (const item of order.items) {
      const itemQty = parseInt(item.qty || 1, 10);
      if (!item.product) continue;

      // Cari variant jika ada
      let matchedVariantId = null;
      if (item.variantName && item.product.variants) {
        const foundVar = item.product.variants.find(
          (v) => v.name.toLowerCase() === item.variantName.toLowerCase()
        );
        if (foundVar) matchedVariantId = foundVar.id;
      }

      // Ambil resep: base recipe (variantId null) + specific variant recipe (jika ada)
      const relevantRecipes = item.product.recipeItems.filter((r) => {
        if (matchedVariantId) {
          return r.variantId === null || r.variantId === matchedVariantId;
        }
        return r.variantId === null;
      });

      for (const recipe of relevantRecipes) {
        const deductionQty = parseFloat(recipe.quantity) * itemQty;
        const ing = recipe.ingredient;
        if (!ing) continue;

        const unitCost = parseFloat(ing.costPerUnit || 0);
        const totalCost = unitCost * deductionQty;

        // Kurangi stok di database
        const updatedIngredient = await client.ingredient.update({
          where: { id: ing.id },
          data: {
            stock: {
              decrement: deductionQty,
            },
          },
        });

        // Catat pergerakan stok
        const movement = await client.stockMovement.create({
          data: {
            ingredientId: ing.id,
            type: 'SALE',
            qty: deductionQty,
            unitCost,
            totalCost,
            note: `Sale: Order #${order.id} (${order.invoiceNo}) - ${item.productName} x${itemQty}`,
          },
        });

        movementsToCreate.push(movement);

        // Cek jika stok berada di bawah batas minimum
        if (parseFloat(updatedIngredient.stock) <= parseFloat(updatedIngredient.minStock)) {
          lowStockAlerts.push(updatedIngredient);
        }
      }
    }

    // Pancarkan alert low stock jika ada
    if (lowStockAlerts.length > 0) {
      for (const low of lowStockAlerts) {
        try {
          events.emit('stock.low', {
            ingredientName: low.name,
            currentStock: parseFloat(low.stock),
            minStock: parseFloat(low.minStock),
            unit: low.unit,
          });
        } catch {}
      }
    }

    return {
      success: true,
      deductedCount: movementsToCreate.length,
      orderId: order.id,
    };
  },

  /**
   * Mengembalikan stok bahan baku jika pesanan dibatalkan (VOID) atau di-refund.
   * Idempotent: hanya mengembalikan jika stok sebelumnya pernah dipotong dan belum pernah direstock.
   * @param {number} orderId
   * @param {string} reason
   * @param {object} tx - Prisma transaction client
   */
  async restoreOrderStock(orderId, reason = 'Pembatalan Pesanan', tx = null) {
    const client = tx || prisma;

    const order = await client.order.findUnique({
      where: { id: parseInt(orderId, 10) },
    });
    if (!order) return { success: false, message: 'Pesanan tidak ditemukan' };

    // Cek apakah ada record pengurangan stok sebelumnya
    const saleMovements = await client.stockMovement.findMany({
      where: {
        note: { contains: `Sale: Order #${order.id} (${order.invoiceNo})` },
        type: 'SALE',
      },
      include: { ingredient: true },
    });

    if (saleMovements.length === 0) {
      return { success: true, message: 'Tidak ada stok yang pernah dipotong untuk pesanan ini' };
    }

    // Cek apakah sudah pernah direstock sebelumnya
    const alreadyRestored = await client.stockMovement.findFirst({
      where: {
        note: { contains: `Restock Order #${order.id} (${order.invoiceNo})` },
        type: 'ADJUSTMENT',
      },
    });

    if (alreadyRestored) {
      return { success: true, alreadyRestored: true };
    }

    for (const mov of saleMovements) {
      const restoreQty = parseFloat(mov.qty);

      await client.ingredient.update({
        where: { id: mov.ingredientId },
        data: {
          stock: {
            increment: restoreQty,
          },
        },
      });

      await client.stockMovement.create({
        data: {
          ingredientId: mov.ingredientId,
          type: 'ADJUSTMENT',
          qty: restoreQty,
          unitCost: mov.unitCost,
          totalCost: mov.totalCost,
          note: `Restock Order #${order.id} (${order.invoiceNo}) - Alasan: ${reason}`,
        },
      });
    }

    return { success: true, restoredCount: saleMovements.length };
  },
};
