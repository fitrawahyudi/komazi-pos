import prisma from '../../config/db.js';

export async function auth(ctx, next) {
  const tgId = ctx.from?.id?.toString();
  if (!tgId || ctx.chat?.type !== 'private') {
    ctx.user = null; // Di grup tidak ada identitas privat
    return next();
  }
  ctx.user = await prisma.user.findFirst({
    where: { telegramId: tgId, isActive: true },
  });
  return next();
}
