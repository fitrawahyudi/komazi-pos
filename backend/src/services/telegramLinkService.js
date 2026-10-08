import crypto from 'crypto';
import prisma from '../config/db.js';

export const telegramLinkService = {
  async generate(userId) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });
    if (!user) throw new Error('Pengguna tidak ditemukan');

    // Buat kode 8 karakter acak alfanumerik huruf kapital
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const ttlMin = parseInt(process.env.BOT_LINK_CODE_TTL_MIN || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60000);

    const link = await prisma.telegramLinkCode.create({
      data: {
        userId: Number(userId),
        code,
        expiresAt,
      },
    });

    return link.code;
  },

  async verifyAndLink(code, telegramId, telegramUsername = null) {
    const link = await prisma.telegramLinkCode.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { user: true },
    });

    if (!link || link.usedAt || link.expiresAt < new Date() || !link.user.isActive) {
      return { ok: false, message: 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru ke Owner.' };
    }

    // Lepaskan tautan lama jika Telegram ID ini sebelumnya terhubung ke akun lain
    const existingWithSameTg = await prisma.user.findFirst({
      where: { telegramId: String(telegramId) },
    });
    if (existingWithSameTg && existingWithSameTg.id !== link.userId) {
      await prisma.user.update({
        where: { id: existingWithSameTg.id },
        data: { telegramId: null, telegramUsername: null, telegramLinkedAt: null },
      });
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: link.userId },
        data: {
          telegramId: String(telegramId),
          telegramUsername: telegramUsername || null,
          telegramLinkedAt: new Date(),
        },
      }),
      prisma.telegramLinkCode.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, user: updatedUser };
  },

  async unlink(userId) {
    return prisma.user.update({
      where: { id: Number(userId) },
      data: {
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });
  },

  async listUnlinkedStaff() {
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
};
