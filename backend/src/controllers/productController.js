import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
    const { name, categoryId, price, sku, imageUrl, description, modifiers, isActive, isSoldOut, variants } = req.body;

    const autoSku = sku || `KMZ-PRD-${Math.floor(100 + Math.random() * 900)}`;

    const product = await prisma.product.create({
      data: {
        name,
        categoryId: parseInt(categoryId),
        price,
        sku: autoSku,
        imageUrl: imageUrl || null,
        description: description || null,
        modifiers: modifiers || null,
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
    const { name, categoryId, price, sku, imageUrl, description, modifiers, isActive, isSoldOut, variants } = req.body;

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

      return await tx.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(categoryId && { categoryId: parseInt(categoryId) }),
          ...(price !== undefined && { price }),
          ...(sku && { sku }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(description !== undefined && { description }),
          ...(modifiers !== undefined && { modifiers }),
          ...(isActive !== undefined && { isActive }),
          ...(isSoldOut !== undefined && { isSoldOut }),
        },
        include: {
          variants: true,
          category: true,
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
    await prisma.product.delete({ where: { id } });
    return successResponse(res, null, 'Produk berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
