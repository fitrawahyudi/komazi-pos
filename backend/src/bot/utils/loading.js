/**
 * Helper eksekusi proses dengan animasi progress bertahap yang aman dari rate-limit Telegram.
 * Menggunakan jeda minimal 750-800ms antar frame guna mencegah HTTP 429 Too Many Requests (Telegram 1 Hz limit).
 */
export async function withLoadingAnimation(ctx, { chatAction = 'typing', frames = [] }, workerFn) {
  let loadingMsg = null;
  let currentFrameIndex = 0;
  let isDone = false;

  try {
    // 1. Kirim chat action native (typing / upload_photo / find_location)
    if (ctx && typeof ctx.replyWithChatAction === 'function') {
      await ctx.replyWithChatAction(chatAction).catch(() => {});
    }

    // 2. Kirim pesan frame pertama jika disediakan
    if (frames.length > 0 && ctx && typeof ctx.reply === 'function') {
      loadingMsg = await ctx.reply(frames[0], { parse_mode: 'HTML' }).catch(() => null);
    }

    // 3. Jalankan interval transisi frame aman
    let frameInterval = null;
    if (loadingMsg && frames.length > 1) {
      frameInterval = setInterval(async () => {
        if (isDone || !loadingMsg || currentFrameIndex >= frames.length - 1) {
          if (frameInterval) clearInterval(frameInterval);
          return;
        }
        currentFrameIndex++;
        try {
          await ctx.api.editMessageText(
            loadingMsg.chat.id,
            loadingMsg.message_id,
            frames[currentFrameIndex],
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
