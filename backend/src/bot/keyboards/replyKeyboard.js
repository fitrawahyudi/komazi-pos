import { Keyboard } from 'grammy';

/**
 * Membangun Custom Persistent Reply Keyboard untuk Operasional Staf POS
 * Sesuai peran aktif: OWNER, MANAGER, CASHIER, BARISTA, KITCHEN
 * Tampil rapi dalam format grid 2 kolom di bawah layar Telegram.
 */
export function buildStaffReplyKeyboard(role) {
  const kb = new Keyboard();

  switch ((role || '').toUpperCase()) {
    case 'OWNER':
      kb.text('📊 Ringkasan Omzet').text('✅ Approval').row()
        .text('📦 Stok Bahan').text('🔮 Prediksi AI').row()
        .text('⏰ Jadwal Otomatis').text('🤖 Asisten AI').row()
        .text('ℹ️ Status Bot').text('👤 Profil Staf').row()
        .text('❌ Sembunyikan Menu');
      break;

    case 'MANAGER':
      kb.text('📊 Laporan Hari Ini').text('✅ Approval').row()
        .text('📦 Cek Stok').text('🚫 Menu Habis').row()
        .text('⏰ Jadwal Otomatis').text('🤖 Asisten AI').row()
        .text('ℹ️ Status Bot').text('👤 Profil Staf').row()
        .text('❌ Sembunyikan Menu');
      break;

    case 'CASHIER':
      kb.text('🧾 Pesanan Baru').text('📋 Pesanan Aktif').row()
        .text('⏱ Shift Kasir').row()
        .text('ℹ️ Status Bot').text('👤 Profil Staf').row()
        .text('❌ Sembunyikan Menu');
      break;

    case 'BARISTA':
      kb.text('☕ Antrean Barista').text('ℹ️ Status Bot').row()
        .text('👤 Profil Staf').row()
        .text('❌ Sembunyikan Menu');
      break;

    case 'KITCHEN':
      kb.text('🍳 Antrean Dapur').text('ℹ️ Status Bot').row()
        .text('👤 Profil Staf').row()
        .text('❌ Sembunyikan Menu');
      break;

    default:
      kb.text('ℹ️ Info Akun').text('ℹ️ Status Bot').row()
        .text('❌ Sembunyikan Menu');
  }

  return kb.resized().persistent();
}
