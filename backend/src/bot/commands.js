const COMMON = [
  { command: 'menu', description: 'Tampilkan menu utama' },
  { command: 'whoami', description: 'Info akun saya' },
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
    { command: 'antrean', description: 'Lihat antrean pesanan' },
  ],
  MANAGER: [
    { command: 'approval', description: 'Persetujuan menunggu' },
    { command: 'stok', description: 'Cek stok bahan menipis' },
    { command: 'stok_masuk', description: 'Catat stok masuk' },
    { command: 'habis', description: 'Tandai menu habis/tersedia' },
    { command: 'laporan', description: 'Laporan ringkasan hari ini' },
    { command: 'workspace', description: 'Status area workspace' },
  ],
  OWNER: [
    { command: 'ringkasan', description: 'Ringkasan penjualan realtime' },
    { command: 'laporan', description: 'Laporan per periode' },
    { command: 'approval', description: 'Persetujuan menunggu' },
    { command: 'stok', description: 'Cek stok bahan' },
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
