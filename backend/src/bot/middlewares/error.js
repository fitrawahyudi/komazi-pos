import { GrammyError, HttpError } from 'grammy';

export async function errorHandler(err) {
  const ctx = err.ctx;
  const e = err.error;

  if (e instanceof GrammyError) {
    console.error('[Bot Error] Telegram API error:', e.description);
  } else if (e instanceof HttpError) {
    console.error('[Bot Error] Gagal menghubungi Telegram server:', e);
  } else {
    console.error('[Bot Error] Uncaught error in handler:', e);
  }

  try {
    if (ctx && ctx.reply) {
      await ctx.reply('⚠️ Terjadi kesalahan pada sistem bot. Silakan coba lagi nanti atau gunakan aplikasi web kasir.');
    }
  } catch {
    // Abaikan jika chat tidak bisa dibalas
  }
}
