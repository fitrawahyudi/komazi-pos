import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isDrinkItemHelper } from '../services/kdsService.js';

export async function getAllProducts(req, res) {
  try {
    const { categoryId, search, isSoldOut, isActive, page, limit } = req.query;

    const where = {};
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (isSoldOut !== undefined) where.isSoldOut = isSoldOut === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const total = await prisma.product.count({ where });

    const findArgs = {
      where,
      include: {
        category: true,
        variants: true,
      },
      orderBy: { id: 'desc' },
    };

    if (page || limit) {
      const currentPage = Math.max(1, parseInt(page) || 1);
      const perPage = Math.max(1, parseInt(limit) || 10);
      findArgs.skip = (currentPage - 1) * perPage;
      findArgs.take = perPage;
      const products = await prisma.product.findMany(findArgs);
      return successResponse(res, products, 'Daftar produk berhasil diambil', 200, {
        page: currentPage,
        limit: perPage,
        total,
        totalPages: Math.ceil(total / perPage) || 1,
      });
    }

    const products = await prisma.product.findMany(findArgs);

    return successResponse(res, products, 'Daftar produk berhasil diambil', 200, { total });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getProductById(req, res) {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
      },
    });

    if (!product) {
      return errorResponse(res, 'Produk tidak ditemukan', 404);
    }

    return successResponse(res, product, 'Data produk berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createProduct(req, res) {
  try {
    const { name, categoryId, price, sku, imageUrl, description, modifiers, isActive, isSoldOut, variants, stationId, isDynamicPrice, minPrice } = req.body;

    const autoSku = sku || `KMZ-PRD-${Math.floor(100 + Math.random() * 900)}`;

    let resolvedStationId = stationId !== undefined ? (stationId ? parseInt(stationId) : null) : null;
    if (!resolvedStationId) {
      const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId) } });
      const isDrink = isDrinkItemHelper({ name, category });
      const targetType = isDrink ? 'BAR' : 'KITCHEN';
      const defaultStation = await prisma.station.findFirst({ where: { type: targetType } });
      if (defaultStation) {
        resolvedStationId = defaultStation.id;
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        categoryId: parseInt(categoryId),
        stationId: resolvedStationId,
        price,
        sku: autoSku,
        imageUrl: imageUrl || null,
        description: description || null,
        modifiers: modifiers || null,
        isDynamicPrice: isDynamicPrice === true || isDynamicPrice === 'true',
        minPrice: minPrice !== undefined ? minPrice : 0,
        isActive: isActive !== undefined ? isActive : true,
        isSoldOut: isSoldOut !== undefined ? isSoldOut : false,
        variants: variants && variants.length > 0 ? {
          create: variants.map((v) => ({
            name: v.name,
            extraPrice: v.extraPrice || 0,
          })),
        } : undefined,
      },
      include: {
        variants: true,
        category: true,
        station: true,
      },
    });

    return successResponse(res, product, 'Produk berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateProduct(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, categoryId, price, sku, imageUrl, description, modifiers, isActive, isSoldOut, variants, stationId, isDynamicPrice, minPrice } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      // If variants are supplied, replace them
      if (variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants.map((v) => ({
              productId: id,
              name: v.name,
              extraPrice: v.extraPrice || 0,
            })),
          });
        }
      }

      let resolvedStationId = stationId !== undefined ? (stationId ? parseInt(stationId) : null) : undefined;
      if (resolvedStationId === undefined && (categoryId || name)) {
        const existing = await tx.product.findUnique({ where: { id }, include: { category: true } });
        const catId = categoryId ? parseInt(categoryId) : existing.categoryId;
        const cat = categoryId ? await tx.category.findUnique({ where: { id: catId } }) : existing.category;
        const prodName = name || existing.name;
        const isDrink = isDrinkItemHelper({ name: prodName, category: cat });
        const targetType = isDrink ? 'BAR' : 'KITCHEN';
        const defaultStation = await tx.station.findFirst({ where: { type: targetType } });
        if (defaultStation) {
          resolvedStationId = defaultStation.id;
        }
      }

      return await tx.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(categoryId && { categoryId: parseInt(categoryId) }),
          ...(resolvedStationId !== undefined && { stationId: resolvedStationId }),
          ...(price !== undefined && { price }),
          ...(sku && { sku }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(description !== undefined && { description }),
          ...(modifiers !== undefined && { modifiers }),
          ...(isDynamicPrice !== undefined && { isDynamicPrice: isDynamicPrice === true || isDynamicPrice === 'true' }),
          ...(minPrice !== undefined && { minPrice }),
          ...(isActive !== undefined && { isActive }),
          ...(isSoldOut !== undefined && { isSoldOut }),
        },
        include: {
          variants: true,
          category: true,
          station: true,
        },
      });
    });

    return successResponse(res, updated, 'Produk berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteProduct(req, res) {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!product) {
      return errorResponse(res, 'Produk tidak ditemukan', 404);
    }

    if (product._count.orderItems > 0) {
      // Soft-delete: deactive the product so historical order data remains intact
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return successResponse(
        res,
        { id, isSoftDeleted: true },
        'Produk dinonaktifkan dari katalog karena memiliki riwayat pesanan'
      );
    }

    // Hard-delete: can be safely deleted completely (variants and recipe items cascade)
    await prisma.product.delete({ where: { id } });
    return successResponse(res, { id, isHardDeleted: true }, 'Produk berhasil dihapus permanen');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bulkDeleteProducts(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Daftar ID produk harus berupa array dan tidak boleh kosong', 400);
    }

    const numericIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (numericIds.length === 0) {
      return errorResponse(res, 'Tidak ada ID produk yang valid', 400);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: numericIds } },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (products.length === 0) {
      return errorResponse(res, 'Produk yang dipilih tidak ditemukan', 404);
    }

    const toSoftDelete = [];
    const toHardDelete = [];

    for (const prod of products) {
      if (prod._count.orderItems > 0) {
        toSoftDelete.push(prod.id);
      } else {
        toHardDelete.push(prod.id);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (toSoftDelete.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: toSoftDelete } },
          data: { isActive: false },
        });
      }
      if (toHardDelete.length > 0) {
        await tx.product.deleteMany({
          where: { id: { in: toHardDelete } },
        });
      }
    });

    const msg = toSoftDelete.length > 0
      ? `${products.length} produk berhasil diproses (${toHardDelete.length} dihapus permanen, ${toSoftDelete.length} diarsipkan)`
      : `${products.length} produk berhasil dihapus`;

    return successResponse(
      res,
      {
        total: products.length,
        hardDeletedCount: toHardDelete.length,
        softDeletedCount: toSoftDelete.length,
        deletedIds: numericIds,
      },
      msg
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bulkCreateProducts(req, res) {
  try {
    const { products = [] } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return errorResponse(res, 'Daftar produk tidak valid atau kosong', 400);
    }

    const categories = await prisma.category.findMany();
    const catMap = new Map();
    categories.forEach((c) => {
      catMap.set(c.id, c.id);
      catMap.set(c.name.toLowerCase().trim(), c.id);
    });
    const defaultCatId = categories[0]?.id || 1;

    // Load existing ingredients for recipe matching and HPP calculation
    const existingIngredients = await prisma.ingredient.findMany();
    const ingMap = new Map();
    existingIngredients.forEach((ing) => {
      ingMap.set(ing.name.toLowerCase().trim(), ing);
      ingMap.set(ing.id, ing);
    });

    const createdList = [];
    await prisma.$transaction(async (tx) => {
      for (const item of products) {
        if (!item.name || !item.name.trim()) continue;

        let categoryId = defaultCatId;
        if (item.categoryId && catMap.has(Number(item.categoryId))) {
          categoryId = Number(item.categoryId);
        } else if (item.categoryName && catMap.has(item.categoryName.toLowerCase().trim())) {
          categoryId = catMap.get(item.categoryName.toLowerCase().trim());
        }

        const price = Math.max(0, parseFloat(item.price) || 0);
        const sku = item.sku?.trim() || `KMZ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

        const isDynamicPrice = Boolean(
          item.isDynamicPrice === true ||
          item.isDynamicPrice === 'true' ||
          item.isDynamicPrice === 'ya'
        );
        const minPrice = item.minPrice !== undefined ? Math.max(0, parseFloat(item.minPrice) || 0) : 0;

        const product = await tx.product.create({
          data: {
            name: item.name.trim(),
            categoryId,
            price,
            sku,
            description: item.description?.trim() || null,
            imageUrl: item.imageUrl?.trim() || null,
            isDynamicPrice,
            minPrice,
            isSoldOut: Boolean(item.isSoldOut),
            isActive: item.isActive !== false,
            variants: Array.isArray(item.variants) && item.variants.length > 0 ? {
              create: item.variants.map((v) => ({
                name: v.name.trim(),
                price: parseFloat(v.price) || price,
                sku: v.sku?.trim() || `${sku}-${v.name.slice(0, 3).toUpperCase()}`,
              })),
            } : undefined,
          },
          include: {
            category: true,
            variants: true,
          },
        });

        // Handle HPP & Recipe items creation!
        let recipeItemsToCreate = [];

        // 1. If structured recipeItems were sent from Excel (e.g. "Kopi Biji: 18 gram, Susu Fresh: 150 ml")
        if (Array.isArray(item.recipeItems) && item.recipeItems.length > 0) {
          for (const rItem of item.recipeItems) {
            let ing = null;
            if (rItem.ingredientId && ingMap.has(Number(rItem.ingredientId))) {
              ing = ingMap.get(Number(rItem.ingredientId));
            } else if (rItem.ingredientName && ingMap.has(rItem.ingredientName.toLowerCase().trim())) {
              ing = ingMap.get(rItem.ingredientName.toLowerCase().trim());
            }

            // If ingredient doesn't exist yet, auto-create it in master bahan baku!
            if (!ing && rItem.ingredientName) {
              const ingName = rItem.ingredientName.trim();
              const unit = rItem.unit?.trim() || 'gram';
              const costPerUnit = parseFloat(rItem.costPerUnit) || 0;
              ing = await tx.ingredient.create({
                data: {
                  name: ingName,
                  unit,
                  stock: 0,
                  minStock: 0,
                  costPerUnit,
                },
              });
              ingMap.set(ing.name.toLowerCase().trim(), ing);
              ingMap.set(ing.id, ing);
            }

            if (ing) {
              const qty = Math.max(0.0001, parseFloat(rItem.quantity) || 1);
              recipeItemsToCreate.push({
                productId: product.id,
                ingredientId: ing.id,
                quantity: qty,
              });
            }
          }

          // If recipe items were provided but total cost evaluated to 0, and user provided direct HPP, attach base cost
          if (item.hpp && parseFloat(item.hpp) > 0) {
            const currentRecipeCost = recipeItemsToCreate.reduce((sum, ri) => {
              const matched = ingMap.get(ri.ingredientId);
              return sum + (ri.quantity * (matched?.costPerUnit || 0));
            }, 0);

            if (currentRecipeCost === 0) {
              const directHpp = parseFloat(item.hpp);
              if (recipeItemsToCreate.length === 1) {
                // Assign cost directly to this sole ingredient
                const singleRi = recipeItemsToCreate[0];
                const unitCost = directHpp / singleRi.quantity;
                await tx.ingredient.update({
                  where: { id: singleRi.ingredientId },
                  data: { costPerUnit: unitCost },
                });
                const ingObj = ingMap.get(singleRi.ingredientId);
                if (ingObj) ingObj.costPerUnit = unitCost;
              } else {
                // Add base cost ingredient to preserve HPP
                const ingName = `Bahan Pokok ${product.name}`;
                let ing = ingMap.get(ingName.toLowerCase().trim());
                if (!ing) {
                  ing = await tx.ingredient.create({
                    data: {
                      name: ingName,
                      unit: 'porsi',
                      stock: 0,
                      minStock: 0,
                      costPerUnit: directHpp,
                    },
                  });
                  ingMap.set(ing.name.toLowerCase().trim(), ing);
                  ingMap.set(ing.id, ing);
                }
                recipeItemsToCreate.push({
                  productId: product.id,
                  ingredientId: ing.id,
                  quantity: 1,
                });
              }
            }
          }
        } 
        // 2. If direct HPP is provided (item.hpp > 0) and no recipe items were matched
        else if (item.hpp && parseFloat(item.hpp) > 0) {
          const directHpp = parseFloat(item.hpp);
          const ingName = `Bahan Pokok ${product.name}`;
          
          let ing = ingMap.get(ingName.toLowerCase().trim());
          if (!ing) {
            ing = await tx.ingredient.create({
              data: {
                name: ingName,
                unit: 'porsi',
                stock: 0,
                minStock: 0,
                costPerUnit: directHpp,
              },
            });
            ingMap.set(ing.name.toLowerCase().trim(), ing);
            ingMap.set(ing.id, ing);
          } else {
            ing = await tx.ingredient.update({
              where: { id: ing.id },
              data: { costPerUnit: directHpp },
            });
          }

          recipeItemsToCreate.push({
            productId: product.id,
            ingredientId: ing.id,
            quantity: 1,
          });
        }

        if (recipeItemsToCreate.length > 0) {
          await tx.productRecipeItem.createMany({
            data: recipeItemsToCreate,
          });
        }

        createdList.push(product);
      }
    });

    return successResponse(res, createdList, `${createdList.length} produk berhasil diimpor ke sistem beserta perhitungan HPP`, 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

