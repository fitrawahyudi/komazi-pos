import prisma from '../config/db.js';

export const getBotUser = (conversation, ctx) =>
  conversation.external(async () => {
    const u = await prisma.user.findFirst({
      where: {
        telegramId: ctx.from?.id?.toString(),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        telegramId: true,
      },
    });
    return u || null;
  });
