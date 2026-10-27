/**
 * Menghasilkan array string frame animasi progress bar monospaced untuk Telegram.
 * Menggunakan format <code>[████░░░░░░] 40%</code> agar lebar karakter presisi dan seragam di semua perangkat.
 */
export function generateLoadingBarFrames({
  steps = [15, 35, 55, 75, 90, 100],
  barLength = 10,
  prefix = '⏳ ',
} = {}) {
  return steps.map((pct) => {
    const filled = Math.round((pct / 100) * barLength);
    const empty = Math.max(0, barLength - filled);
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${prefix}<code>[${bar}] ${pct}%</code>`;
  });
}

/**
 * Helper eksekusi proses dengan animasi progress bar bertahap yang aman dari rate-limit Telegram.
 * Menggunakan jeda minimal 750-800ms antar frame guna mencegah HTTP 429 Too Many Requests (Telegram 1 Hz limit).
 */
export async function withLoadingAnimation(ctx, options = {}, workerFn) {
  // Dukung signature fleksibel: withLoadingAnimation(ctx, workerFn)
  if (typeof options === 'function') {
    workerFn = options;
    options = {};
  }

  const {
    chatAction = 'typing',
    frames = null,
    forceLoadingBar = false,
    skipLoadingMessage = false,
    skipLoading = false,
  } = options || {};

  const shouldSkipMessage = Boolean(skipLoadingMessage || skipLoading);

  // Jika skipLoadingMessage aktif (misalnya pada mode bebas chat langsung),
  // jangan kirim pesan frame loading ke ruang obrolan Telegram.
  // Cukup kirim chat action native (seperti 'typing') secara berkala agar responsif & natural.
  if (shouldSkipMessage) {
    let actionInterval = null;
    try {
      if (chatAction && ctx && typeof ctx.replyWithChatAction === 'function') {
        await ctx.replyWithChatAction(chatAction).catch(() => {});
        actionInterval = setInterval(() => {
          ctx.replyWithChatAction(chatAction).catch(() => {});
        }, 4000);
      }
      return await workerFn();
    } finally {
      if (actionInterval) clearInterval(actionInterval);
    }
  }

  // Gunakan loading bar sebagai standar default kecuali bila frame eksplisit diberikan
  const activeFrames =
    !forceLoadingBar && Array.isArray(frames) && frames.length > 0
      ? frames
      : generateLoadingBarFrames();

  let loadingMsg = null;
  let currentFrameIndex = 0;
  let isDone = false;

  try {
    // 1. Kirim chat action native (typing / upload_photo / find_location)
    if (ctx && typeof ctx.replyWithChatAction === 'function') {
      await ctx.replyWithChatAction(chatAction).catch(() => {});
    }

    // 2. Kirim pesan frame loading bar pertama
    if (activeFrames.length > 0 && ctx && typeof ctx.reply === 'function') {
      loadingMsg = await ctx.reply(activeFrames[0], { parse_mode: 'HTML' }).catch(() => null);
    }

    // 3. Jalankan interval transisi frame progress bar aman
    let frameInterval = null;
    if (loadingMsg && activeFrames.length > 1) {
      frameInterval = setInterval(async () => {
        if (isDone || !loadingMsg || currentFrameIndex >= activeFrames.length - 1) {
          if (frameInterval) clearInterval(frameInterval);
          return;
        }
        currentFrameIndex++;
        try {
          await ctx.api.editMessageText(
            loadingMsg.chat.id,
            loadingMsg.message_id,
            activeFrames[currentFrameIndex],
            { parse_mode: 'HTML' }
          );
        } catch {
          // Abaikan jika pesan sudah dihapus atau jaringan sedang sibuk
        }
      }, 800);
    }

    // 4. Jalankan proses kerja aktual
    const result = await workerFn();
    isDone = true;
    if (frameInterval) clearInterval(frameInterval);

    // 5. Bersihkan pesan loading sementara sebelum menampilkan output final
    if (loadingMsg) {
      await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).catch(() => {});
    }

    return result;
  } catch (err) {
    isDone = true;
    if (loadingMsg) {
      await ctx.api.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `❌ <b>Gagal memproses permintaan:</b>\n<i>${err.message || 'Terjadi kesalahan sistem'}</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
    throw err;
  }
}
