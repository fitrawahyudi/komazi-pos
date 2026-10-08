export const requireRole = (...roles) => async (ctx, next) => {
  if (!ctx.user) {
    return ctx.reply(
      '🔒 <b>Akses Ditolak</b>\nAkun Telegram Anda belum ditautkan ke POS Komazi.\nSilakan minta kode tautan ke Owner, lalu kirim: <code>/start KODE</code>',
      { parse_mode: 'HTML' }
    );
  }

  // Owner memiliki hak akses tertinggi
  const allowed = roles.includes(ctx.user.role) || ctx.user.role === 'OWNER';

  if (!allowed) {
    return ctx.reply(
      `⛔ <b>Akses Terbatas</b>\nPerintah ini hanya dapat diakses oleh peran: <b>${roles.join(', ')}</b>.\nPeran akun Anda saat ini: <b>${ctx.user.role}</b>.`,
      { parse_mode: 'HTML' }
    );
  }

  return next();
};
