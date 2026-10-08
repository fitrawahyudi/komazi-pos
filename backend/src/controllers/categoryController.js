import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getAllCategories(req, res) {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return successResponse(res, categories, 'Daftar kategori berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createCategory(req, res) {
  try {
    const { name, sortOrder } = req.body;

    // Jika sortOrder tidak diisi, otomatis buat urutan terakhir
    let resolvedSort = sortOrder;
    if (resolvedSort === undefined || resolvedSort === null) {
      const highest = await prisma.category.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      resolvedSort = (highest?.sortOrder || 0) + 1;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        sortOrder: Number(resolvedSort) || 0,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    return successResponse(res, category, 'Kategori berhasil dibuat', 201);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Nama kategori sudah terdaftar', 400);
    }
    return errorResponse(res, err.message, 500);
  }
}

export async function updateCategory(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, sortOrder } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

    const updated = await prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    return successResponse(res, updated, 'Kategori berhasil diperbarui');
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Nama kategori sudah terdaftar', 400);
    }
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteCategory(req, res) {
  try {
    const id = parseInt(req.params.id);

    // Cek apakah ada produk terikat dengan kategori ini
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return errorResponse(
        res,
        `Tidak dapat menghapus kategori karena masih memiliki ${productCount} produk terkait. Pindahkan atau hapus produk terlebih dahulu.`,
        400
      );
    }

    await prisma.category.delete({ where: { id } });
    return successResponse(res, null, 'Kategori berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
