import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { calculateProductCogs } from '../services/cogsService.js';

/**
 * GET /api/products/:id/recipe
 * Retrieve the recipe (BOM) for a product with HPP calculation.
 */
export async function getProductRecipe(req, res) {
  try {
    const productId = parseInt(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        recipeItems: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, costPerUnit: true },
            },
            variant: {
              select: { id: true, name: true },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!product) {
      return errorResponse(res, 'Produk tidak ditemukan', 404);
    }

    // Calculate HPP
    const baseItems = product.recipeItems.filter((ri) => ri.variantId === null);
    const baseCost = baseItems.reduce((sum, ri) => {
      return sum + parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit);
    }, 0);

    const price = parseFloat(product.price);
    const hpp = Math.round(baseCost * 100) / 100;
    const margin = price > 0 ? Math.round(((price - hpp) / price) * 10000) / 100 : 0;

    return successResponse(res, {
      productId: product.id,
      productName: product.name,
      price,
      hpp,
      grossProfit: Math.round((price - hpp) * 100) / 100,
      margin,
      hasRecipe: product.recipeItems.length > 0,
      recipeItems: product.recipeItems.map((ri) => ({
        id: ri.id,
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredient.name,
        ingredientUnit: ri.ingredient.unit,
        costPerUnit: parseFloat(ri.ingredient.costPerUnit),
        quantity: parseFloat(ri.quantity),
        lineCost: Math.round(parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit) * 100) / 100,
        variantId: ri.variantId,
        variantName: ri.variant?.name || null,
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        extraPrice: parseFloat(v.extraPrice),
      })),
    }, 'Resep produk berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PUT /api/products/:id/recipe
 * Save/update the full recipe (BOM) for a product.
 * Body: { items: [{ ingredientId, quantity, variantId? }] }
 */
export async function saveProductRecipe(req, res) {
  try {
    const productId = parseInt(req.params.id);
    const { items = [] } = req.body;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return errorResponse(res, 'Produk tidak ditemukan', 404);
    }

    // Transaction: delete old recipe items and create new ones
    const result = await prisma.$transaction(async (tx) => {
      // Remove existing recipe items for this product
      await tx.productRecipeItem.deleteMany({
        where: { productId },
      });

      // Insert new recipe items
      if (items.length > 0) {
        await tx.productRecipeItem.createMany({
          data: items.map((item) => ({
            productId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            variantId: item.variantId || null,
          })),
        });
      }

      // Return the new recipe with relations
      return tx.productRecipeItem.findMany({
        where: { productId },
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, costPerUnit: true },
          },
          variant: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      });
    });

    // Calculate new HPP
    const baseItems = result.filter((ri) => ri.variantId === null);
    const baseCost = baseItems.reduce((sum, ri) => {
      return sum + parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit);
    }, 0);

    const price = parseFloat(product.price);
    const hpp = Math.round(baseCost * 100) / 100;
    const margin = price > 0 ? Math.round(((price - hpp) / price) * 10000) / 100 : 0;

    return successResponse(res, {
      productId,
      productName: product.name,
      price,
      hpp,
      grossProfit: Math.round((price - hpp) * 100) / 100,
      margin,
      recipeItems: result.map((ri) => ({
        id: ri.id,
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredient.name,
        ingredientUnit: ri.ingredient.unit,
        costPerUnit: parseFloat(ri.ingredient.costPerUnit),
        quantity: parseFloat(ri.quantity),
        lineCost: Math.round(parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit) * 100) / 100,
        variantId: ri.variantId,
        variantName: ri.variant?.name || null,
      })),
    }, 'Resep produk berhasil disimpan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * GET /api/products/cogs/overview
 * Get all products with their HPP, price, and margin overview.
 */
export async function getCogsOverview(req, res) {
  try {
    const { activeOnly } = req.query || {};
    const where = activeOnly === 'true' ? { isActive: true } : {};

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        variants: true,
        recipeItems: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, costPerUnit: true } },
            variant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const overview = products.map((product) => {
      const baseItems = product.recipeItems.filter((ri) => ri.variantId === null);
      const baseCost = baseItems.reduce((sum, ri) => {
        return sum + parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit);
      }, 0);

      const price = parseFloat(product.price);
      const hpp = Math.round(baseCost * 100) / 100;
      const margin = price > 0 ? Math.round(((price - hpp) / price) * 10000) / 100 : 0;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryName: product.category?.name || '-',
        price,
        hpp,
        grossProfit: Math.round((price - hpp) * 100) / 100,
        margin,
        hasRecipe: product.recipeItems.length > 0,
        ingredientCount: baseItems.length,
        recipeItems: product.recipeItems.map((ri) => ({
          id: ri.id,
          ingredientId: ri.ingredientId,
          ingredientName: ri.ingredient.name,
          ingredientUnit: ri.ingredient.unit,
          costPerUnit: parseFloat(ri.ingredient.costPerUnit),
          quantity: parseFloat(ri.quantity),
          lineCost: Math.round(parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit) * 100) / 100,
          variantId: ri.variantId,
          variantName: ri.variant?.name || null,
        })),
      };
    });

    return successResponse(res, overview, 'Overview HPP semua produk');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/products/recipes/bulk
 * Import/update multiple product recipes (BOM) from Excel.
 * Body: { recipes: [ { sku, variantName, ingredientName, quantity } ] }
 */
export async function bulkSaveRecipes(req, res) {
  try {
    const { recipes = [] } = req.body;
    if (!Array.isArray(recipes) || recipes.length === 0) {
      return errorResponse(res, 'Daftar baris resep tidak valid atau kosong', 400);
    }

    // 1. Fetch all products and master ingredients
    const products = await prisma.product.findMany({
      include: { variants: true },
    });
    const ingredients = await prisma.ingredient.findMany();

    const skuMap = new Map();
    const nameMap = new Map();
    products.forEach((p) => {
      if (p.sku) skuMap.set(p.sku.toLowerCase().trim(), p);
      nameMap.set(p.name.toLowerCase().trim(), p);
    });

    const ingMap = new Map();
    ingredients.forEach((ing) => {
      ingMap.set(ing.name.toLowerCase().trim(), ing);
      ingMap.set(String(ing.id), ing);
    });

    // 2. Group recipe items by target product
    const productRecipesMap = new Map();
    let skippedCount = 0;
    const skippedItems = [];

    for (const item of recipes) {
      const rawSku = String(item.sku || item.productSku || '').toLowerCase().trim();
      const rawProdName = String(item.productName || '').toLowerCase().trim();
      const matchedProduct = (rawSku && skuMap.get(rawSku)) || (rawProdName && nameMap.get(rawProdName));

      if (!matchedProduct) {
        skippedCount++;
        skippedItems.push({
          item,
          reason: `Produk dengan SKU/Nama "${item.sku || item.productName}" tidak terdaftar di sistem`,
        });
        continue;
      }

      const ingName = String(item.ingredientName || item.name || '').trim();
      if (!ingName) {
        skippedCount++;
        skippedItems.push({ item, reason: 'Nama bahan baku kosong' });
        continue;
      }

      const quantity = Math.max(0.0001, parseFloat(item.quantity) || 1);
      const variantName = String(item.variantName || '').trim().toLowerCase();

      let matchedVariantId = null;
      if (variantName) {
        const matchedVariant = (matchedProduct.variants || []).find(
          (v) => v.name.toLowerCase().trim() === variantName
        );
        if (matchedVariant) {
          matchedVariantId = matchedVariant.id;
        }
      }

      if (!productRecipesMap.has(matchedProduct.id)) {
        productRecipesMap.set(matchedProduct.id, {
          product: matchedProduct,
          items: [],
        });
      }

      productRecipesMap.get(matchedProduct.id).items.push({
        ingredientName: ingName,
        quantity,
        variantId: matchedVariantId,
      });
    }

    if (productRecipesMap.size === 0) {
      return errorResponse(res, 'Tidak ada baris resep yang cocok dengan produk yang terdaftar', 400, {
        skipped: skippedItems,
      });
    }

    // 3. Execute in transaction
    let totalItemsSaved = 0;
    const updatedProducts = [];

    await prisma.$transaction(
      async (tx) => {
        for (const [productId, { product, items }] of productRecipesMap.entries()) {
          // Delete existing recipe items for this product
          await tx.productRecipeItem.deleteMany({
            where: { productId },
          });

          const itemsToCreate = [];
          for (const it of items) {
            let ing = ingMap.get(it.ingredientName.toLowerCase().trim());
            if (!ing) {
              // Auto-create ingredient if not existing!
              ing = await tx.ingredient.create({
                data: {
                  name: it.ingredientName,
                  unit: 'gram',
                  stock: 0,
                  minStock: 0,
                  costPerUnit: 0,
                },
              });
              ingMap.set(ing.name.toLowerCase().trim(), ing);
              ingMap.set(String(ing.id), ing);
            }

            itemsToCreate.push({
              productId,
              ingredientId: ing.id,
              quantity: it.quantity,
              variantId: it.variantId,
            });
          }

          if (itemsToCreate.length > 0) {
            await tx.productRecipeItem.createMany({
              data: itemsToCreate,
            });
            totalItemsSaved += itemsToCreate.length;
            updatedProducts.push(product.name);
          }
        }
      },
      { timeout: 30000 }
    );

    return successResponse(
      res,
      {
        totalItemsSaved,
        productsUpdatedCount: updatedProducts.length,
        updatedProducts,
        skippedCount,
      },
      `Berhasil memperbarui resep untuk ${updatedProducts.length} produk (${totalItemsSaved} bahan baku)` +
        (skippedCount > 0 ? ` (${skippedCount} dilewati)` : ''),
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

