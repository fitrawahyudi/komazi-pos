const COMMON = [
  { command: 'menu', description: 'Tampilkan menu utama' },
  { command: 'whoami', description: 'Info akun saya' },
  { command: 'infobot', description: 'Status & performa sistem bot' },
  { command: 'batal', description: 'Batalkan proses berjalan' },
];

export const ROLE_COMMANDS = {
  CASHIER: [
    { command: 'buka_shift', description: 'Buka shift & input modal kas' },
    { command: 'tutup_shift', description: 'Tutup shift kasir' },
    { command: 'order', description: 'Buat pesanan cepat' },
    { command: 'pesanan', description: 'Pesanan aktif / open bill' },
    { command: 'workspace', description: 'Status area workspace' },
    { command: 'checkin', description: 'Check-in workspace tamu' },
    { command: 'checkout', description: 'Check-out workspace' },
    { command: 'approval', description: 'Ajukan void/diskon' },
  ],
  BARISTA: [
    { command: 'antrean', description: 'Lihat antrean bar minuman' },
  ],
  KITCHEN: [
    { command: 'antrean', description: 'Lihat antrean dapur makanan' },
  ],
  MANAGER: [
    { command: 'ai', description: 'Tanya asisten cerdas Komazi AI' },
    { command: 'ai_mode', description: 'Toggle mode chat AI langsung (ON/OFF)' },
    { command: 'antrean', description: 'Lihat seluruh antrean pesanan' },
    { command: 'approval', description: 'Persetujuan menunggu' },
    { command: 'stok', description: 'Cek stok bahan menipis' },
    { command: 'cek_stok_kritis', description: 'AI cek sisa waktu stok habis' },
    { command: 'prediksi', description: 'AI prediksi jam sibuk & target' },
    { command: 'stok_masuk', description: 'Catat stok masuk' },
    { command: 'habis', description: 'Tandai menu habis/tersedia' },
    { command: 'waste', description: 'Catat bahan terbuang/tumpah/kalibrasi' },
    { command: 'profit', description: 'Estimasi laba bersih (P&L)' },
    { command: 'laporan', description: 'Laporan ringkasan hari ini' },
    { command: 'workspace', description: 'Status area workspace' },
    { command: 'jobs', description: 'Daftar jadwal otomatis & cron' },
    { command: 'cron', description: 'Kelola jadwal & pengingat (/cron)' },
    { command: 'job_help', description: 'Bantuan sistem cron & jobs' },
  ],
  OWNER: [
    { command: 'ai', description: 'Tanya asisten cerdas Komazi AI' },
    { command: 'ai_mode', description: 'Toggle mode chat AI langsung (ON/OFF)' },
    { command: 'ringkasan', description: 'Ringkasan penjualan realtime' },
    { command: 'profit', description: 'Laporan laba bersih eksekutif (P&L)' },
    { command: 'antrean', description: 'Lihat seluruh antrean pesanan' },
    { command: 'prediksi', description: 'AI prediksi jam sibuk & target' },
    { command: 'cek_stok_kritis', description: 'AI cek sisa waktu stok habis' },
    { command: 'laporan', description: 'Laporan per periode' },
    { command: 'waste', description: 'Catat bahan terbuang/tumpah/kalibrasi' },
    { command: 'approval', description: 'Persetujuan menunggu' },
    { command: 'stok', description: 'Cek stok bahan' },
    { command: 'jobs', description: 'Kelola jadwal otomatis & cron' },
    { command: 'cron', description: 'Kelola jadwal & pengingat (/cron)' },
    { command: 'job_help', description: 'Bantuan sistem cron & jobs' },
    { command: 'tautkan', description: 'Buat kode tautan akun staf' },
  ],
};

export async function setCommandsForUser(bot, telegramId, role) {
  try {
    await bot.api.setMyCommands(
      [...COMMON, ...(ROLE_COMMANDS[role] ?? [])],
      { scope: { type: 'chat', chat_id: Number(telegramId) } },
    );
  } catch (err) {
    console.warn(`[Commands] Failed to set commands for ${telegramId}:`, err.message);
  }
}
