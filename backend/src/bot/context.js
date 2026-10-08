import prisma from '../config/db.js';

export const getBotUser = (conversation, ctx) =>
  conversation.external(() =>
    prisma.user.findFirst({
      where: {
        telegramId: ctx.from?.id?.toString(),
        isActive: true,
      },
    })
  );
