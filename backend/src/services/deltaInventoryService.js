import prisma from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Service untuk memproses mutasi inventori berbasis selisih (Delta)
 * saat pesanan dibuat (OPEN / Hold Bill), diedit (Delta Edit),
 * dilunasi (PAID - Zero Double-Deduction), atau dibatalkan (VOIDED).
 */
export const deltaInventoryService = {
  /**
   * Helper untuk mengekstrak kebutuhan bahan baku dari satu item produk dan varian (BOM)
   * @param {object} tx - Prisma Client / Transaction Client
   * @param {number} productId
   * @param {string|null} variantName
   * @param {number} qtyMultiplier
   * @returns {Promise<Array>}
   */
  async extractBomRequirements(tx, productId, variantName, qtyMultiplier = 1) {
    const client = tx || prisma;
    const parsedProductId = parseInt(productId, 10);
    if (isNaN(parsedProductId)) return [];

    const product = await client.product.findUnique({
      where: { id: parsedProductId },
      include: {
        variants: true,
        recipeItems: {
          include: { ingredient: true },
        },
      },
    });

    if (!product || !product.recipeItems || product.recipeItems.length === 0) {
      return [];
    }

    let matchedVariantId = null;
    if (variantName && product.variants && product.variants.length > 0) {
      const found = product.variants.find(
        (v) => v.name.toLowerCase().trim() === String(variantName).toLowerCase().trim()
      );
      if (found) matchedVariantId = found.id;
    }

    // Filter resep: base recipe (variantId null) + specific variant recipe (jika ada varian terpilih)
    const relevantRecipes = product.recipeItems.filter((r) => {
      if (matchedVariantId) {
        return r.variantId === null || r.variantId === matchedVariantId;
      }
      return r.variantId === null;
    });

    return relevantRecipes.map((r) => ({
      ingredientId: r.ingredientId,
      ingredientName: r.ingredient.name,
      unit: r.ingredient.unit,
      costPerUnit: parseFloat(r.ingredient.costPerUnit || 0),
      currentStock: parseFloat(r.ingredient.stock || 0),
      requiredQty: parseFloat(r.quantity) * Number(qtyMultiplier),
    }));
  },

  /**
   * Memotong stok bahan baku untuk pesanan baru (Hold Bill / OPEN maupun langsung PAID).
   * @param {object} tx - Prisma Transaction Client
   * @param {number} orderId
   * @param {string} invoiceNo
   * @param {Array} items - Array of { productId, productName, variantName, qty }
   */
  async deductNewOrderStock(tx, orderId, invoiceNo, items) {
    const client = tx || prisma;

    // 1. Agregasi total kebutuhan bahan baku dari seluruh item pesanan
    const aggregatedRequirements = new Map();

    for (const item of items) {
      const itemQty = parseInt(item.qty || 1, 10);
      const bomItems = await this.extractBomRequirements(
        client,
        item.productId,
        item.variantName,
        itemQty
      );

      for (const bom of bomItems) {
        const cur = aggregatedRequirements.get(bom.ingredientId) || {
          ingredientId: bom.ingredientId,
          name: bom.ingredientName,
          unit: bom.unit,
          costPerUnit: bom.costPerUnit,
          needed: 0,
        };
        cur.needed += bom.requiredQty;
        aggregatedRequirements.set(bom.ingredientId, cur);
      }
    }

    // Jika pesanan tidak mengandung produk dengan resep BOM, lewati
    if (aggregatedRequirements.size === 0) {
      return { success: true, count: 0 };
    }

    // 2. Validasi ketersediaan stok fisik seluruh bahan baku
    const outOfStockErrors = [];
    for (const [, req] of aggregatedRequirements) {
      const ing = await client.ingredient.findUnique({
        where: { id: req.ingredientId },
        select: { id: true, name: true, stock: true, unit: true },
      });

      const currentStock = parseFloat(ing?.stock || 0);
      if (currentStock < req.needed) {
        outOfStockErrors.push(
          `Bahan baku "${req.name}" tidak mencukupi (Tersedia: ${currentStock} ${req.unit}, Diperlukan: ${req.needed} ${req.unit})`
        );
      }
    }

    if (outOfStockErrors.length > 0) {
      const error = new Error(outOfStockErrors.join('; '));
      error.statusCode = 400;
      throw error;
    }

    // 3. Potong stok dan catat StockMovement bertipe SALE
    const movements = [];
    for (const [, req] of aggregatedRequirements) {
      await client.ingredient.update({
        where: { id: req.ingredientId },
        data: { stock: { decrement: req.needed } },
      });

      const movement = await client.stockMovement.create({
        data: {
          ingredientId: req.ingredientId,
          type: 'SALE',
          qty: req.needed,
          unitCost: req.costPerUnit,
          totalCost: req.costPerUnit * req.needed,
          note: `Sale: Order #${orderId} (${invoiceNo})`,
        },
      });
      movements.push(movement);
    }

    if (movements.length > 0) {
      logger.inventory.info(`Stock deducted | invoiceNo=${invoiceNo} ingredientsCount=${movements.length}`, {
        orderId,
        invoiceNo,
        ingredientsCount: movements.length,
      });
    }

    return { success: true, count: movements.length };
  },

  /**
   * Eksekusi Perhitungan Delta & Mutasi Stok Atomik saat Hold Bill diedit.
   * @param {object} tx - Prisma Transaction Client
   * @param {number} orderId - ID Pesanan yang diedit
   * @param {string} invoiceNo - Nomor Faktur Pesanan
   * @param {Array} existingItems - Item pesanan yang saat ini tersimpan di DB
   * @param {Array} incomingItems - Item pesanan baru yang dikirim kasir
   */
  async processOrderDelta(tx, orderId, invoiceNo, existingItems, incomingItems) {
    const client = tx || prisma;
    const buildKey = (item) => `${item.productId}_${(item.variantName || '').toLowerCase().trim()}`;

    // 1. Buat Peta Identifikasi Item Unik berdasarkan (productId_variantName)
    const existingMap = new Map();
    for (const item of existingItems) {
      if (item.status === 'CANCELLED') continue;
      existingMap.set(buildKey(item), item);
    }

    const incomingMap = new Map();
    for (const item of incomingItems) {
      incomingMap.set(buildKey(item), item);
    }

    // 2. Hitung Delta Qty untuk Setiap Item
    const deltaList = [];
    const allKeys = new Set([...existingMap.keys(), ...incomingMap.keys()]);

    for (const key of allKeys) {
      const oldItem = existingMap.get(key);
      const newItem = incomingMap.get(key);

      const oldQty = oldItem ? parseInt(oldItem.qty, 10) : 0;
      const newQty = newItem ? parseInt(newItem.qty, 10) : 0;
      const deltaQty = newQty - oldQty;

      if (deltaQty !== 0) {
        const sample = newItem || oldItem;
        deltaList.push({
          key,
          productId: sample.productId,
          productName: sample.productName || sample.name,
          variantName: sample.variantName || null,
          oldItem,
          newItem,
          oldQty,
          newQty,
          deltaQty, // Positif = Penambahan porsi, Negatif = Pengurangan / Batal
        });
      }
    }

    // Jika tidak ada perubahan kuantitas item, lewati mutasi stok
    if (deltaList.length === 0) {
      return { modified: false, deltaList: [] };
    }

    // 3. Agregasi Kebutuhan Bahan Baku untuk Semua Item yang Bertambah (Delta > 0)
    const positiveDeductions = new Map();
    for (const delta of deltaList.filter((d) => d.deltaQty > 0)) {
      const bomItems = await this.extractBomRequirements(
        client,
        delta.productId,
        delta.variantName,
        delta.deltaQty
      );

      for (const b of bomItems) {
        const cur = positiveDeductions.get(b.ingredientId) || {
          ingredientId: b.ingredientId,
          name: b.ingredientName,
          unit: b.unit,
          costPerUnit: b.costPerUnit,
          needed: 0,
        };
        cur.needed += b.requiredQty;
        positiveDeductions.set(b.ingredientId, cur);
      }
    }

    // 4. Validasi Ketersediaan Stok Fisik untuk Seluruh Tambahan Baru
    const outOfStockErrors = [];
    for (const [, req] of positiveDeductions) {
      const ing = await client.ingredient.findUnique({
        where: { id: req.ingredientId },
        select: { id: true, name: true, stock: true, unit: true },
      });

      const currentStock = parseFloat(ing?.stock || 0);
      if (currentStock < req.needed) {
        outOfStockErrors.push(
          `Bahan baku "${req.name}" tidak mencukupi (Tersedia: ${currentStock} ${req.unit}, Diperlukan tambahan: ${req.needed} ${req.unit})`
        );
      }
    }

    // Batalkan seluruh transaksi jika ada bahan yang tidak mencukupi
    if (outOfStockErrors.length > 0) {
      const error = new Error(outOfStockErrors.join('; '));
      error.statusCode = 400;
      throw error;
    }

    // 5. Eksekusi Mutasi Stok Bahan Baku Berdasarkan Delta
    for (const delta of deltaList) {
      const absQty = Math.abs(delta.deltaQty);
      const bomItems = await this.extractBomRequirements(
        client,
        delta.productId,
        delta.variantName,
        absQty
      );

      if (delta.deltaQty > 0) {
        // KASUS A: KUANTITAS BERTAMBAH (POTONG STOK TAMBAHAN)
        for (const bom of bomItems) {
          await client.ingredient.update({
            where: { id: bom.ingredientId },
            data: { stock: { decrement: bom.requiredQty } },
          });

          await client.stockMovement.create({
            data: {
              ingredientId: bom.ingredientId,
              type: 'SALE',
              qty: bom.requiredQty,
              unitCost: bom.costPerUnit,
              totalCost: bom.costPerUnit * bom.requiredQty,
              note: `Delta Sale (+${delta.deltaQty}): Order #${orderId} (${invoiceNo}) - ${delta.productName} [${delta.variantName || 'Std'}]`,
            },
          });
        }
      } else {
        // KASUS B: KUANTITAS BERKURANG / DIBATALKAN (KEMBALIKAN STOK / REVERSAL)
        for (const bom of bomItems) {
          await client.ingredient.update({
            where: { id: bom.ingredientId },
            data: { stock: { increment: bom.requiredQty } },
          });

          await client.stockMovement.create({
            data: {
              ingredientId: bom.ingredientId,
              type: 'ADJUSTMENT',
              qty: bom.requiredQty,
              unitCost: bom.costPerUnit,
              totalCost: bom.costPerUnit * bom.requiredQty,
              note: `Delta Restock (${delta.deltaQty}): Order #${orderId} (${invoiceNo}) - ${delta.productName} [${delta.variantName || 'Std'}]`,
            },
          });
        }
      }
    }

    return {
      modified: true,
      deltaCount: deltaList.length,
      deltaList,
    };
  },

  /**
   * Mengembalikan seluruh stok bahan baku untuk pesanan yang dibatalkan (VOID).
   * Idempotent: hanya mengembalikan stok jika pesanan belum pernah direstock penuh.
   * @param {object} tx - Prisma Transaction Client
   * @param {number} orderId
   * @param {string} reason
   */
  async restoreOrderStock(tx, orderId, reason = 'Pembatalan Pesanan (Void)') {
    const client = tx || prisma;
    const parsedOrderId = parseInt(orderId, 10);

    const order = await client.order.findUnique({
      where: { id: parsedOrderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return { success: false, message: 'Pesanan tidak ditemukan' };
    }

    // Idempotency check: Jangan restock dua kali untuk order yang sama
    const alreadyRestored = await client.stockMovement.findFirst({
      where: {
        note: { contains: `Order #${order.id}` },
        type: 'ADJUSTMENT',
      },
    });

    if (alreadyRestored) {
      return { success: true, alreadyRestored: true };
    }

    // Ambil item yang aktif (bukan CANCELLED)
    const activeItems = order.items.filter((i) => i.status !== 'CANCELLED');
    if (activeItems.length === 0) {
      return { success: true, restoredCount: 0 };
    }

    // Ekstrak dan kembalikan seluruh stok bahan baku
    let restoredMovements = 0;
    for (const item of activeItems) {
      const itemQty = parseInt(item.qty, 10);
      const bomItems = await this.extractBomRequirements(
        client,
        item.productId,
        item.variantName,
        itemQty
      );

      for (const bom of bomItems) {
        await client.ingredient.update({
          where: { id: bom.ingredientId },
          data: { stock: { increment: bom.requiredQty } },
        });

        await client.stockMovement.create({
          data: {
            ingredientId: bom.ingredientId,
            type: 'ADJUSTMENT',
            qty: bom.requiredQty,
            unitCost: bom.costPerUnit,
            totalCost: bom.costPerUnit * bom.requiredQty,
            note: `Restock Void Order #${order.id} (${order.invoiceNo}) - ${item.productName} x${itemQty} (${reason})`,
          },
        });
        restoredMovements++;
      }
    }

    logger.inventory.info(`Stock restored | orderId=${order.id} invoiceNo=${order.invoiceNo} count=${restoredMovements}`, {
      orderId: order.id,
      invoiceNo: order.invoiceNo,
      restoredMovements,
      reason,
    });

    return { success: true, restoredCount: restoredMovements };
  },
};
