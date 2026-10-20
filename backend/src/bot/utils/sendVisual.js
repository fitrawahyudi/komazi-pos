import { InputFile } from 'grammy';
import { bot } from '../index.js';
import prisma from '../../config/db.js';

/**
 * Helper to safely resolve image buffer with timeout guard (default 8 seconds)
 */
async function resolveBufferSafe(imageBufferPromise, timeoutMs = 8000) {
  if (!imageBufferPromise) return null;
  try {
    const buffer = await Promise.race([
      imageBufferPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Image render timeout')), timeoutMs)
      ),
    ]);
    if (buffer && Buffer.isBuffer(buffer)) {
      return buffer;
    }
  } catch (err) {
    console.warn('[SendVisual] Gagal membuat buffer gambar:', err.message);
  }
  return null;
}

/**
 * Helper to ensure the watermark footer @komazi-assistant is present on all bot messages
 */
export function ensureWatermark(captionHtml) {
  if (!captionHtml || typeof captionHtml !== 'string') return captionHtml;
  if (captionHtml.includes('@komazi-assistant')) return captionHtml;
  return `${captionHtml.trim()}\n\n🤖 <i>@komazi-assistant</i>`;
}

/**
 * Send photo to chatId with automatic graceful fallback to text message
 */
export async function sendPhotoWithFallback({
  chatId,
  imageBufferPromise,
  captionHtml,
  replyMarkup = null,
}) {
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return false;

  const finalCaption = ensureWatermark(captionHtml);
  const photoBuffer = await resolveBufferSafe(imageBufferPromise);

  // 1. Try sending photo with caption
  if (photoBuffer) {
    try {
      await bot.api.sendPhoto(chatId, new InputFile(photoBuffer, 'komazi-card.png'), {
        caption: finalCaption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup || undefined,
      });
      return true;
    } catch (sendErr) {
      if (sendErr.error_code === 403) {
        await prisma.user.updateMany({
          where: { telegramId: String(chatId) },
          data: { telegramId: null },
        }).catch(() => {});
        return false;
      }
      console.warn(`[SendVisual] Gagal sendPhoto ke ${chatId}, fallback teks:`, sendErr.message);
    }
  }

  // 2. Fallback to standard text message
  try {
    await bot.api.sendMessage(chatId, finalCaption, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup || undefined,
    });
    return true;
  } catch (fallbackErr) {
    if (fallbackErr.error_code === 403) {
      await prisma.user.updateMany({
        where: { telegramId: String(chatId) },
        data: { telegramId: null },
      }).catch(() => {});
    } else {
      console.error(`[SendVisual] Gagal fallback text ke ${chatId}:`, fallbackErr.message);
    }
    return false;
  }
}

/**
 * Reply directly in Grammy Context with photo and fallback
 */
export async function replyWithPhotoFallback(ctx, {
  imageBufferPromise,
  captionHtml,
  replyMarkup = null,
}) {
  if (!ctx) return false;

  const finalCaption = ensureWatermark(captionHtml);
  const photoBuffer = await resolveBufferSafe(imageBufferPromise);

  if (photoBuffer) {
    try {
      await ctx.replyWithPhoto(new InputFile(photoBuffer, 'komazi-card.png'), {
        caption: finalCaption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup || undefined,
      });
      return true;
    } catch (err) {
      console.warn(`[SendVisual] ctx.replyWithPhoto gagal, fallback text:`, err.message);
    }
  }

  // Fallback to text reply
  try {
    await ctx.reply(finalCaption, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup || undefined,
    });
    return true;
  } catch (textErr) {
    console.error(`[SendVisual] ctx.reply fallback gagal:`, textErr.message);
    return false;
  }
}

/**
 * Notification dispatchers for roles and users with visual photos
 */
export const notifierVisual = {
  async toRoles(roles = [], { imageBufferPromise, captionHtml, replyMarkup = null }) {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: { in: roles },
          isActive: true,
          telegramId: { not: null },
        },
      });

      // Resolve buffer once to share across all recipients in the role
      const photoBuffer = await resolveBufferSafe(imageBufferPromise);

      await Promise.all(
        users.map((u) =>
          sendPhotoWithFallback({
            chatId: u.telegramId,
            imageBufferPromise: Promise.resolve(photoBuffer),
            captionHtml,
            replyMarkup,
          })
        )
      );
    } catch (err) {
      console.warn('[NotifierVisual] toRoles error:', err.message);
    }
  },

  async toUser(userId, { imageBufferPromise, captionHtml, replyMarkup = null }) {
    try {
      const u = await prisma.user.findUnique({ where: { id: Number(userId) } });
      if (u?.telegramId) {
        await sendPhotoWithFallback({
          chatId: u.telegramId,
          imageBufferPromise,
          captionHtml,
          replyMarkup,
        });
      }
    } catch (err) {
      console.warn('[NotifierVisual] toUser error:', err.message);
    }
  },
};
