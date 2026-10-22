import { ensureWatermark } from '../utils/sendVisual.js';
import { esc } from '../utils/format.js';

/**
 * Handler untuk interaksi Persistent Reply Keyboard (Tombol Bawah Layar)
 * Khusus fitur operasional Staf POS Komazi (Owner, Manager, Kasir, Barista, Kitchen)
 */
export function registerStaffMenu(bot) {
  // 1. Ringkasan Omzet
  bot.hears('📊 Ringkasan Omzet', async (ctx) => {
    if (ctx.user && ['OWNER', 'MANAGER'].includes(ctx.user.role)) {
      const { handleSummary } = await import('./owner.js');
      if (typeof handleSummary === 'function') {
        return handleSummary(ctx, 'today');
      }
    }
    const text = ensureWatermark('📊 Ketik <code>/ringkasan</code> untuk melihat ringkasan omzet hari ini.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 2. Laporan Penjualan
  bot.hears(['📊 Laporan Penjualan', '📊 Laporan Hari Ini'], async (ctx) => {
    const text = ensureWatermark('📈 Ketik <code>/laporan</code> untuk melihat pilihan periode dan tanggal laporan penjualan.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 3. Stok Bahan
  bot.hears(['📦 Stok Bahan', '📦 Cek Stok'], async (ctx) => {
    const text = ensureWatermark('📦 Ketik <code>/stok</code> untuk membuka daftar ketersediaan stok bahan baku.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 4. Approval
  bot.hears('✅ Approval', async (ctx) => {
    const text = ensureWatermark('✅ Ketik <code>/approval</code> untuk melihat permintaan persetujuan yang sedang menunggu.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 5. Antrean Barista & Dapur
  bot.hears(['☕ Antrean Barista', '🍳 Antrean Dapur'], async (ctx) => {
    const text = ensureWatermark('☕ Ketik <code>/antrean</code> untuk memantau live antrean pesanan bar & dapur.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 6. Pesanan Baru
  bot.hears('🧾 Pesanan Baru', async (ctx) => {
    if (ctx.conversation?.enter) {
      return ctx.conversation.enter('quickOrder');
    }
    return ctx.reply(ensureWatermark('Ketik <code>/pesanan_baru</code> untuk membuat order baru.'), { parse_mode: 'HTML' });
  });

  // 7. Pesanan Aktif (Open Bills)
  bot.hears('📋 Pesanan Aktif', async (ctx) => {
    const text = ensureWatermark('📋 Ketik <code>/pesanan</code> untuk melihat daftar open bill pesanan aktif.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 8. Workspace Sessions
  bot.hears('💻 Workspace', async (ctx) => {
    const text = ensureWatermark('💻 Ketik <code>/workspace</code> untuk melihat status area dan sesi tamu aktif.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 9. Shift Kasir
  bot.hears('⏱ Shift Kasir', async (ctx) => {
    const text = ensureWatermark(
      '⏱ <b>Aksi Shift Kasir:</b>\n• /buka_shift — Buka sesi kasir baru & input modal awal\n• /tutup_shift — Tutup shift & rekonsiliasi kas fisik (Z-Report)'
    );
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 10. Prediksi AI
  bot.hears('🔮 Prediksi AI', async (ctx) => {
    const text = ensureWatermark('🔮 Ketik <code>/prediksi</code> untuk melihat insight proyeksi jam sibuk & omzet AI.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 11. Jadwal Otomatis & Pengingat
  bot.hears(['⏰ Jadwal Otomatis', '⏰ Jadwal Cron'], async (ctx) => {
    const text = ensureWatermark('⏰ Ketik <code>/cron</code> untuk mengelola jadwal tugas otomatis dan pengingat kedai.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 12. Asisten AI
  bot.hears('🤖 Asisten AI', async (ctx) => {
    const text = ensureWatermark('🤖 Ketik <code>/ai</code> untuk membuka menu asisten pintar Komazi AI.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 13. Menu Habis / Sold Out Toggle
  bot.hears('🚫 Menu Habis', async (ctx) => {
    const text = ensureWatermark('🚫 Ketik <code>/habis</code> untuk mengubah status menu yang habis atau tersedia.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 14. Status Bot
  bot.hears('ℹ️ Status Bot', async (ctx) => {
    const text = ensureWatermark('ℹ️ Ketik <code>/infobot</code> untuk melihat status performa & koneksi bot.');
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 15. Profil Staf / Info Akun
  bot.hears(['👤 Profil Staf', 'ℹ️ Info Akun'], async (ctx) => {
    if (!ctx.user) {
      const text = ensureWatermark(
        `🔒 <b>Informasi Akun</b>\n• ID Telegram: <code>${ctx.from?.id}</code>\n• Status: <b>Belum Ditautkan</b>\n\nSilakan minta Kode Tautan ke Owner outlet, lalu kirim:\n<code>/start KODE_TAUTAN</code>`
      );
      return ctx.reply(text, { parse_mode: 'HTML' });
    }
    const text = ensureWatermark(
      `👤 <b>Profil Staf POS</b>\n• Nama: <b>${esc(ctx.user.name)}</b>\n• Username: @${ctx.user.username}\n• Peran: <b>${ctx.user.role}</b>\n• Telegram ID: <code>${ctx.from?.id}</code>`
    );
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 16. Sembunyikan Menu / Tutup Keyboard Bawah
  bot.hears(['❌ Sembunyikan Menu', '❌ Tutup Menu', 'Tutup Menu'], async (ctx) => {
    return ctx.reply(
      ensureWatermark(
        '⌨️ <b>Tombol menu bawah telah disembunyikan.</b>\n\nKetik <code>/menu</code> kapan saja untuk menampilkan kembali tombol menu.'
      ),
      {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      }
    );
  });

  if (typeof bot.command === 'function') {
    bot.command(['tutup_menu', 'sembunyikan_menu', 'hide_keyboard'], async (ctx) => {
      return ctx.reply(
        ensureWatermark(
          '⌨️ <b>Tombol menu bawah telah ditutup.</b>\n\nKetik <code>/menu</code> kapan saja untuk menampilkan kembali tombol menu.'
        ),
        {
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        }
      );
    });
  }
}

