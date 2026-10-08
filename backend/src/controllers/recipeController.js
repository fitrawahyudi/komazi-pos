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
    const products = await prisma.product.findMany({
      where: { isActive: true },
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
      };
    });

    return successResponse(res, overview, 'Overview HPP semua produk');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
