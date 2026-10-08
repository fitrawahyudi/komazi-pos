import prisma from '../config/db.js';

export const userService = {
  async listUnlinked() {
    return prisma.user.findMany({
      where: {
        isActive: true,
        telegramId: null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id) {
    return prisma.user.findUnique({
      where: { id: Number(id) },
    });
  },

  async getByTelegramId(telegramId) {
    return prisma.user.findFirst({
      where: { telegramId: String(telegramId), isActive: true },
    });
  },
};
