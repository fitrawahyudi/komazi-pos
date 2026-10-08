import prisma from '../config/db.js';

export const menuService = {
  async listCategories() {
    return prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  },

  async listAvailable(categoryId = null) {
    const where = {
      isActive: true,
      isSoldOut: false,
    };
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }
    return prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async listAllForToggle() {
    return prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });
  },

  async toggleSoldOut(productId) {
    const prd = await prisma.product.findUnique({ where: { id: Number(productId) } });
    if (!prd) throw new Error('Menu tidak ditemukan');
    const updated = await prisma.product.update({
      where: { id: Number(productId) },
      data: { isSoldOut: !prd.isSoldOut },
    });
    return updated;
  },
};
