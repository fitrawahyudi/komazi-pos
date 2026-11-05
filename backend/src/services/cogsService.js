import prisma from '../config/db.js';

/**
 * Calculate the COGS (Cost of Goods Sold / HPP) for a specific product + optional variant.
 * Sums up: recipe ingredient quantity * ingredient costPerUnit
 * If variant has specific recipe items, those are added on top of the base product recipe.
 * Fallback to manual costPrice (Harga Modal) if no recipe is defined.
 *
 * @param {number} productId
 * @param {string|null} variantName - optional variant name to look up variant-specific recipe items
 * @returns {Promise<number>} calculated COGS (HPP) per unit
 */
export async function calculateProductCogs(productId, variantName = null) {
  // Get base recipe items (variantId is null → applies to all variants / base product)
  const baseRecipeItems = await prisma.productRecipeItem.findMany({
    where: {
      productId,
      variantId: null,
    },
    include: {
      ingredient: { select: { costPerUnit: true } },
    },
  });

  let totalCost = 0;

  for (const item of baseRecipeItems) {
    const qty = parseFloat(item.quantity);
    const cost = parseFloat(item.ingredient.costPerUnit);
    totalCost += qty * cost;
  }

  // If a variant name is provided, look up variant-specific recipe additions
  if (variantName) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        productId,
        name: variantName,
      },
    });

    if (variant) {
      const variantRecipeItems = await prisma.productRecipeItem.findMany({
        where: {
          productId,
          variantId: variant.id,
        },
        include: {
          ingredient: { select: { costPerUnit: true } },
        },
      });

      for (const item of variantRecipeItems) {
        const qty = parseFloat(item.quantity);
        const cost = parseFloat(item.ingredient.costPerUnit);
        totalCost += qty * cost;
      }
    }
  }

  // If no recipe is defined, fallback to product's manual costPrice (Harga Modal)
  if (baseRecipeItems.length === 0 && totalCost === 0) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { costPrice: true },
    });
    if (product && product.costPrice) {
      totalCost = parseFloat(product.costPrice) || 0;
    }
  }

  return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate COGS for all products and return an overview array.
 *
 * @returns {Promise<Array>} Array of products with HPP, price, and margin info
 */
export async function getAllProductsCogsOverview() {
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

  return products.map((product) => {
    // Calculate base HPP from recipe items where variantId is null
    const baseItems = product.recipeItems.filter((ri) => ri.variantId === null);
    const baseCost = baseItems.reduce((sum, ri) => {
      return sum + parseFloat(ri.quantity) * parseFloat(ri.ingredient.costPerUnit);
    }, 0);

    const price = parseFloat(product.price);
    const hasRecipe = product.recipeItems.length > 0;
    const manualCost = parseFloat(product.costPrice || 0);
    const effectiveCost = (!hasRecipe && manualCost > 0) ? manualCost : baseCost;
    const hpp = Math.round(effectiveCost * 100) / 100;
    const margin = price > 0 ? Math.round(((price - hpp) / price) * 10000) / 100 : 0;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: product.category?.name || '-',
      price,
      costPrice: manualCost,
      hpp,
      grossProfit: Math.round((price - hpp) * 100) / 100,
      margin,
      hasRecipe,
      isManualHpp: !hasRecipe && manualCost > 0,
      ingredientCount: baseItems.length,
    };
  });
}
