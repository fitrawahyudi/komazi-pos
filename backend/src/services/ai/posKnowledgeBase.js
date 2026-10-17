/**
 * POS Technical SOP & Operational Knowledge Base for Komazi AI.
 * Menyediakan panduan langkah-demi-langkah resmi dan troubleshooting fitur Komazi POS:
 * Split Bill, Merge Bill, Printer Thermal, Buka/Tutup Shift, Void/Refund, Resep, Workspace, Diskon.
 */

export const POS_KNOWLEDGE_ENTRIES = [
  {
    id: 'split_bill',
    title: 'Panduan Split Bill (Pemisahan Tagihan)',
    category: 'POS_OPERATION',
    keywords: ['split bill', 'pisah tagihan', 'bagi tagihan', 'split pembayaran', 'pisah bill', 'bagi bayar', 'pecah bill'],
    actionHint: { type: 'NAVIGATE', route: '/orders', targetModal: 'OPEN_BILLS', label: 'Buka Pesanan Aktif' },
    summary: 'Cara memisahkan satu pesanan aktif menjadi beberapa sub-tagihan pembayaran di Komazi POS.',
    steps: [
      'Buka menu **Pesanan** atau buka panel **Pesanan Aktif (Open Bills)** di halaman kasir POS.',
      'Pilih pesanan pelanggan yang ingin dipisahkan tagihannya.',
      'Tekan tombol **Split Bill** (ikon pemisah tagihan) di bagian bawah ringkasan order.',
      'Pilih item dan jumlah (qty) yang ingin dialokasikan ke Tagihan 1 dan Tagihan 2 (atau tambah sub-tagihan baru).',
      'Pilih metode pembayaran masing-masing (misal: Tagihan 1 Tunai, Tagihan 2 QRIS).',
      'Proses pembayaran masing-masing sub-bill hingga semua item terbayar lunas.',
    ],
    troubleshooting: 'Pastikan status pesanan masih berupa **Open Bill** (belum lunas penuh) sebelum melakukan split bill.',
  },
  {
    id: 'merge_bill',
    title: 'Panduan Merge Bill (Penggabungan Tagihan)',
    category: 'POS_OPERATION',
    keywords: ['merge bill', 'gabung bill', 'gabung tagihan', 'satukan bill', 'gabung pesanan', 'gabung meja', 'satukan pesanan', 'merge'],
    actionHint: { type: 'NAVIGATE', route: '/orders', targetModal: 'MERGE_BILL', label: 'Buka Panel Gabung Bill' },
    summary: 'Cara menggabungkan dua atau lebih tagihan meja/tamu yang sama menjadi satu transaksi pembayaran tunggal.',
    steps: [
      'Buka tab **Open Bills / Tagihan Aktif** di halaman POS.',
      'Beri tanda centang pada 2 atau lebih tagihan yang ingin digabungkan (misal pesanan Meja 3A dan Meja 3B).',
      'Klik tombol **Gabung Bill (Merge)** di bagian atas daftar tagihan.',
      'Periksa kembali rincian gabungan item dan total harga.',
      'Tekan **Konfirmasi Gabung** — pesanan otomatis menyatu menjadi 1 tagihan utama untuk langsung dibayar.',
    ],
    troubleshooting: 'Tagihan yang sudah berstatus PAID (lunas) tidak dapat digabungkan kembali.',
  },
  {
    id: 'thermal_printer',
    title: 'Panduan Printer Thermal Bluetooth / ESC-POS',
    category: 'HARDWARE_TROUBLESHOOTING',
    keywords: ['printer', 'bluetooth', 'cetak struk', 'struk tidak keluar', 'koneksi printer', 'thermal', 'esc/pos', 'printer mati', 'print'],
    actionHint: { type: 'OPEN_MODAL', targetModal: 'PRINTER_MODAL', label: 'Buka Pengaturan Printer' },
    summary: 'Panduan pairing, pengaturan ukuran kertas (58mm/80mm), dan troubleshooting koneksi printer thermal Bluetooth.',
    steps: [
      'Pastikan printer thermal dalam kondisi **Menyala (ON)** dan lampu indikator Bluetooth berkedip/standby.',
      'Pastikan Bluetooth pada perangkat tablet/PC POS Anda telah diaktifkan.',
      'Klik ikon **Printer** di sudut kanan atas Navbar POS atau buka menu **Pengaturan ➡️ Printer**.',
      'Klik tombol **🔍 Cari Perangkat Bluetooth** pada modal printer.',
      'Pilih nama printer Anda dari daftar perangkat yang ditemukan (contoh: RPP02N, MPT-II, POS-58, Iware, Zywell).',
      'Pilih lebar kertas sesuai printer Anda: **58 mm** atau **80 mm**.',
      'Klik tombol **Uji Cetak (Test Print)** untuk memverifikasi cetakan struk berhasil.',
    ],
    troubleshooting: 'Jika printer tidak terdeteksi: 1) Matikan printer selama 5 detik lalu nyalakan kembali, 2) Pastikan printer tidak sedang terhubung ke ponsel kasir lain (disconnect dulu), 3) Berikan izin akses Bluetooth di browser Google Chrome jika diminta.',
  },
  {
    id: 'shift_management',
    title: 'Panduan Buka & Tutup Shift Kasir (Cash Drawer Reconciliation)',
    category: 'CASHIER_SOP',
    keywords: ['cara buka shift', 'cara tutup shift', 'prosedur shift', 'panduan shift', 'sop shift', 'tata cara shift', 'closing kasir', 'prosedur selisih kas', 'rekonsiliasi kasir', 'aturan tutup shift'],
    actionHint: { type: 'OPEN_MODAL', targetModal: 'SHIFT_MODAL', label: 'Buka Form Shift Kasir' },
    summary: 'Prosedur pembukaan kas awal, pencatatan kas masuk/keluar, dan penutupan shift kasir dengan audit selisih kas.',
    steps: [
      '**Membuka Shift:** Klik tombol **Buka Shift** di bagian atas kasir ➡️ Masukkan uang modal kas awal di laci (misal Rp 200.000) ➡️ Klik **Mulai Shift**.',
      '**Selama Shift:** Semua transaksi tunai otomatis menambahkan saldo laci kas. Jika ada pengeluaran kas kecil (petty cash), catat melalui tombol Kas Keluar.',
      '**Menutup Shift:** Klik **Tutup Shift** di akhir jam kerja ➡️ Hitung fisik seluruh uang tunai yang ada di laci kas.',
      'Masukkan jumlah uang fisik aktual pada form verifikasi kas tutup shift.',
      'Sistem akan otomatis menghitung selisih kas (Cocok / Surplus / Defisit).',
      'Masukkan catatan verifikasi bila ada selisih, lalu klik **Tutup Shift & Cetak Rekap** untuk mencetak struk laporan shift.',
    ],
    troubleshooting: 'Jangan menutup peramban/browser sebelum menekan tombol Tutup Shift agar data transaksi sesi tersimpan rapi ke server.',
  },
  {
    id: 'void_refund',
    title: 'Panduan Void & Refund (Pembatalan Pesanan)',
    category: 'APPROVAL_SOP',
    keywords: ['void', 'refund', 'batal pesanan', 'salah input', 'kembalikan uang', 'batal transaksi', 'approval void'],
    actionHint: { type: 'NAVIGATE', route: '/orders', targetModal: 'ORDER_DETAIL', label: 'Buka Riwayat Pesanan' },
    summary: 'Prosedur pembatalan transaksi salah input atau pengembalian dana pelanggan yang memerlukan otorisasi Manager/Owner.',
    steps: [
      'Buka menu **Riwayat Pesanan (Orders)** di navigasi POS.',
      'Cari pesanan berdasarkan nomor struk atau nama pelanggan, lalu klik pesanan tersebut.',
      'Klik tombol **Ajukan Void / Refund** di detail pesanan.',
      'Pilih alasan pembatalan (misal: salah input menu, pelanggan komplain, bahan habis).',
      'Minta Owner atau Manager memasukkan **PIN Approval Otorisasi** (atau setujui melalui bot Telegram / menu Approval).',
      'Setelah disetujui, status pesanan berubah menjadi VOID/REFUND dan stok bahan baku otomatis dikembalikan ke inventaris.',
    ],
    troubleshooting: 'Kasir biasa tidak memiliki wewenang membatalkan transaksi tanpa PIN otorisasi Manager/Owner demi keamanan audit kedai.',
  },
  {
    id: 'recipe_inventory',
    title: 'Panduan Resep Menu & Pengurangan Stok Otomatis',
    category: 'INVENTORY_SOP',
    keywords: ['cara atur resep', 'mengatur resep', 'setting resep', 'input resep', 'panduan resep', 'sop resep', 'potong stok otomatis', 'bahan baku produk', 'hubungkan resep', 'kurangi stok otomatis'],
    actionHint: { type: 'NAVIGATE', route: '/menu', targetModal: 'RECIPE_MODAL', label: 'Buka Manajemen Resep' },
    summary: 'Cara mengatur takaran bahan baku (gram/ml/pcs) pada setiap menu agar stok terpotong otomatis secara real-time saat kasir checkout.',
    steps: [
      'Masuk ke menu **Daftar Menu (Products)** pada navigasi samping.',
      'Cari produk yang ingin diatur resepnya (contoh: *Caramel Macchiato* atau *Croissant*).',
      'Klik ikon **Resep (Bahan Baku)** pada kartu produk.',
      'Klik **Tambah Bahan** ➡️ Pilih bahan baku dari gudang (misal: Biji Kopi Espresso, Fresh Milk, Sirup Karamel).',
      'Masukkan jumlah takaran per porsi (contoh: 18 gram biji kopi, 150 ml susu, 20 ml sirup karamel).',
      'Klik **Simpan Resep**.',
      'Mulai sekarang, setiap kali menu tersebut dipesan dan dibayar, stok bahan di gudang akan otomatis berkurang secara akurat.',
    ],
    troubleshooting: 'Jika bahan baku habis total di gudang, menu terkait akan otomatis ditandai *Habis (Sold Out)* pada layar kasir untuk mencegah over-selling.',
  },
  {
    id: 'workspace_coworking',
    title: 'Panduan Manajemen Meja & Area Workspace Coworking',
    category: 'WORKSPACE_SOP',
    keywords: ['cara sewa meja', 'panduan workspace', 'sop workspace', 'checkin workspace', 'checkout workspace', 'cara check in meja', 'atur durasi sewa'],
    actionHint: { type: 'NAVIGATE', route: '/pos', targetModal: 'WORKSPACE_PANEL', label: 'Buka Manajemen Workspace' },
    summary: 'Prosedur check-in tamu ruang kerja, pemantauan durasi jam sewa, dan penggabungan tagihan sewa dengan F&B.',
    steps: [
      'Di layar kasir POS, klik tab **Workspace Area**.',
      'Pilih meja atau kursi yang berstatus **Tersedia (Hijau)**.',
      'Klik **Check-in Tamu** ➡️ Masukkan nama tamu, nomor kontak, dan paket durasi (misal: 2 Jam, 4 Jam, atau Seharian/Daily Pass).',
      'Klik **Konfirmasi Check-in** — timer durasi sewa meja otomatis berjalan di layar POS.',
      'Bila tamu memesan kopi atau makanan selama bekerja, kasir cukup menambahkan pesanan ke tab tagihan tamu tersebut.',
      'Saat tamu selesai, klik **Check-out** untuk menyelesaikan total pembayaran sewa dan konsumsi F&B.',
    ],
    troubleshooting: 'Jika durasi sewa tamu hampir habis, kartu meja di layar POS akan berubah warna menjadi kuning/merah sebagai pengingat staf.',
  },
  {
    id: 'discount_tax',
    title: 'Panduan Diskon, Promo & Pajak Transaksi',
    category: 'PRICING_SOP',
    keywords: ['diskon', 'potongan', 'promo', 'voucher', 'pajak', 'ppn', 'service charge', 'diskon kasir'],
    actionHint: { type: 'NAVIGATE', route: '/pos', label: 'Buka Kasir POS' },
    summary: 'Cara menerapkan diskon nominal atau persentase pada keranjang belanja kasir.',
    steps: [
      'Pilih menu-menu pesanan ke keranjang kasir seperti biasa.',
      'Di bagian bawah keranjang belanja, klik tombol **Diskon / Promo**.',
      'Pilih jenis diskon: **Persentase (%)** atau **Nominal Tetap (Rp)**, lalu masukkan nilainya.',
      'Jika diskon adalah promo khusus member, pilih member pelanggan untuk mengaplikasikan poin/diskon loyalitas.',
      'Total tagihan akan otomatis berkurang sesuai perhitungan diskon sebelum pajak diterapkan.',
    ],
    troubleshooting: 'Diskon bernilai di atas batas wewenang kasir (misal di atas 20%) akan meminta konfirmasi PIN Manager.',
  },
];

/**
 * Mencari entri SOP panduan teknis POS yang paling relevan dengan pertanyaan pengguna.
 * @param {string} userQuery - Pertanyaan bebas pengguna
 * @returns {object|null} Entri SOP terbaik atau null jika bukan pertanyaan panduan teknis
 */
export function findPosKnowledge(userQuery) {
  if (!userQuery || typeof userQuery !== 'string') return null;
  const raw = userQuery.toLowerCase().trim();

  let bestMatch = null;
  let highestScore = 0;

  for (const entry of POS_KNOWLEDGE_ENTRIES) {
    let score = 0;

    for (const kw of entry.keywords) {
      if (raw.includes(kw)) {
        // Keyword lebih panjang diberi bobot lebih tinggi (lebih spesifik)
        score += kw.length >= 8 ? 3 : 2;
      }
    }

    // Skor tambahan jika query mengandung pola tanya cara/bagaimana/panduan
    if (/(?:bagaimana|cara|panduan|gimana|kenapa|tata cara|prosedur|tutorial)/i.test(raw) && score > 0) {
      score += 2;
    }

    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch;
}

/**
 * Memformat panduan SOP menjadi string markdown naratif siap pakai untuk injeksi prompt LLM atau respons fallback.
 * @param {object} entry - Objek dari POS_KNOWLEDGE_ENTRIES
 * @returns {string}
 */
export function formatPosKnowledgeForPrompt(entry) {
  if (!entry) return '';

  const stepsText = entry.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
  return `
[PANDUAN RESMI KOMAZI POS: ${entry.title.toUpperCase()}]
Ringkasan: ${entry.summary}

Langkah-langkah Eksekusi:
${stepsText}

Troubleshooting / Catatan Penting:
${entry.troubleshooting}
  `.trim();
}
