import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Download,
  Smartphone,
  Bot,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Printer,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Search,
  Sparkles,
  ArrowRight,
  Wifi,
  Radio,
  Clock,
  Send,
  Coffee,
  CheckCircle2,
  Tv,
  Wallet,
  Receipt,
  FileText,
  Terminal,
  Settings,
  Users,
  Bell,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Cpu,
  Layers,
  Sparkle,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed
} from 'lucide-react';

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'bot'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL'); // 'ALL' | 'CASHIER' | 'KITCHEN' | 'MANAGER' | 'OWNER'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [selectedPreview, setSelectedPreview] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Close zoom modal with ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsZoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // PRATINJAU TAMPILAN NYATA APLIKASI TABLET KOMAZI POS (SCREENSHOTS)
  // ─────────────────────────────────────────────────────────────────────────────
  const previewScreens = [
    {
      id: 'pos-main',
      title: 'Layar Kasir & Katalog Menu',
      subtitle: 'Antarmuka kasir cepat dengan tata letak optimal untuk tablet 10 inch ke atas.',
      category: 'Kasir & Transaksi',
      roleBadge: 'Kasir',
      roleColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      image: '/preview/pos-main.png',
      alt: 'Tampilan Layar Kasir Komazi POS',
      icon: Coffee,
      highlights: [
        'Kategori Menu Lengkap (Espresso, Milk Base, Manual Brew, Non-Coffee, Makanan)',
        'Tombol Cepat Shortcut Keyboard (F2 Cari Menu, F9 Bayar)',
        'Pilihan Layanan Cepat: Dine-In, Take-Away, Nomor Meja & Tamu CRM',
        'Sidebar Keranjang Responsif, Tambah Diskon/Promo, & Split Bill',
      ],
      description:
        'Didesain khusus untuk ritme kerja kasir coffee shop yang serba cepat. Menu tertata rapi dalam grid visual dengan kode warna, memudahkan input pesanan bahkan saat antrean pelanggan sedang ramai.',
    },
    {
      id: 'pos-shift',
      title: 'Gerbang Presensi Sesi Kasir',
      subtitle: 'Sistem pengaman sesi aktif sebelum kasir melayani transaksi.',
      category: 'Presensi & Keamanan',
      roleBadge: 'Kasir & Staf',
      roleColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      image: '/preview/pos-shift.png',
      alt: 'Gerbang Presensi Shift Kasir Komazi POS',
      icon: ShieldCheck,
      highlights: [
        'Wajib Clock-In & Selfie Sebelum Memproses Pesanan',
        'Pencatatan Kas Masuk/Keluar per Shift Kasir',
        'Identitas Staf Kasir Tercatat & Terpisah Tiap Transaksi',
        'Pencegahan Selisih Kas Antar-Pergantian Shift',
      ],
      description:
        'Mencegah manipulasi kas dan transaksi tak tercatat. Sesi kasir hanya dapat dibuka setelah petugas kasir melakukan verifikasi kehadiran, sehingga pembukuan uang kas laci selalu akurat 100%.',
    },
    {
      id: 'pos-ai',
      title: 'Komazi AI — Asisten Eksekutif Kedai',
      subtitle: 'Kecerdasan buatan terintegrasi untuk analisis performa & finansial kedai kopi.',
      category: 'Kecerdasan Buatan (AI)',
      roleBadge: 'Manager & Owner',
      roleColor: 'bg-komazi-coral/15 text-komazi-coral border-komazi-coral/30',
      image: '/preview/pos-ai.png',
      alt: 'Asisten Bisnis Komazi AI POS',
      icon: Sparkles,
      highlights: [
        'Tanya Jawab Performa Omzet Harian vs Kemarin',
        'Analisis Margin HPP Bahan Baku & Menu Terlaris',
        'Audit Selisih Kas & Rekap Finansial Berbahasa Manusia',
        'Rekomendasi Strategis Berdasarkan Tren Penjualan',
      ],
      description:
        'Bukan sekadar kasir biasa! Komazi AI bertindak sebagai asisten eksekutif pribadi di dalam tablet. Cukup tanyakan kondisi kedai dengan bahasa sehari-hari, Komazi AI akan menyajikan data analitik dan tabel komparatif secara instan.',
    },
    {
      id: 'pos-kds',
      title: 'Kitchen & Bar Display System',
      subtitle: 'Layar pantau pesanan real-time untuk barista dan dapur tanpa tiket kertas.',
      category: 'Barista & Dapur',
      roleBadge: 'Barista & Dapur',
      roleColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      image: '/preview/pos-kds.png',
      alt: 'Kitchen & Bar Display System Komazi POS',
      icon: UtensilsCrossed,
      highlights: [
        'Tiket Pesanan Masuk Real-Time Otomatis Sinkron',
        'Timer Durasi Tunggu & Indikator Delay Alert',
        'Satu Sentuhan Tombol Bump Tiket (Proses & Selesai)',
        'Navigasi Antrean Aktif, Diproses, & Riwayat Selesai',
      ],
      description:
        'Mengeliminasi kesalahan pesanan minuman dan makanan. Barista melihat pesanan minuman espresso/manual brew secara berurutan lengkap dengan status waktu tunggu, menghemat biaya kertas struk thermal.',
    },
  ];

  // Dynamic APK URLs (Mendukung Private Repo via Backend Proxy Railway & Public Releases Repo)
  const backendApiBase = (import.meta.env.VITE_API_URL || 'https://komazi-pos-production.up.railway.app/api').replace(/\/api\/?$/, '');
  const backendDownloadUrl = `https://drive.google.com/file/d/1-1qQI-it-AqkM3ILQPB_eto2tjiXZQzt/view?usp=drive_link`;
  const mirrorApkUrl = '/download/komazi-pos.apk';
  const sha256Checksum = 'C060D39A88C9326F8C422099FD451C16D58E4EECCBEE7AD18AB86E97F967A174';

  // Target download URL untuk tombol utama dan scan QR Code
  const primaryDownloadUrl = backendDownloadUrl;

  // Generate QR Code on load
  useEffect(() => {
    QRCode.toDataURL(primaryDownloadUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0B0F14',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [primaryDownloadUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(primaryDownloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySha = () => {
    navigator.clipboard.writeText(sha256Checksum);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2500);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PANDUAN APLIKASI POS ANDROID DATA
  // ─────────────────────────────────────────────────────────────────────────────
  const posGuides = [
    {
      id: 'pos-1',
      step: 1,
      title: 'Unduh & Izinkan Instalasi APK Sumber Tidak Dikenal',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-komazi-coral/15 text-komazi-coral border-komazi-coral/30',
      icon: Download,
      summary: 'Cara mengunduh berkas APK mandiri (sideload) tanpa melewati Google Play Store.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Karena Komazi POS adalah aplikasi internal operasional kedai, sistem Android akan memberikan konfirmasi keamanan standar saat memasang aplikasi di luar Play Store:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-1 text-xs sm:text-sm text-neutral-300">
            <li>
              Tekan tombol <strong>Unduh APK Android</strong> di atas atau pindai QR Code menggunakan kamera tablet/smartphone kasir.
            </li>
            <li>
              Jika Google Chrome menampilkan peringatan <em>"Jenis berkas ini mungkin berbahaya. Tetap unduh komazi-pos.apk?"</em>, pilih <strong>Tetap Download</strong>.
            </li>
            <li>
              Setelah unduhan selesai, klik <strong>Buka</strong> pada notifikasi unduhan.
            </li>
            <li>
              Jika muncul jendela <em>"Demi keamanan, ponsel Anda tidak diizinkan memasang aplikasi yang tidak dikenal dari sumber ini"</em>:
              <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-amber-300">
                <li>Klik tombol <strong>Setelan (Settings)</strong>.</li>
                <li>Aktifkan sakelar <strong>"Izinkan dari sumber ini" (Allow from this source)</strong>.</li>
                <li>Tekan tombol kembali lalu klik <strong>Instal</strong>.</li>
              </ul>
            </li>
          </ol>
          <div className="p-3 rounded-xl bg-komazi-surface-2/80 border border-komazi-border flex items-start gap-2.5 text-xs text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-komazi-teal-light shrink-0 mt-0.5" />
            <span>
              <strong>Aman & Bebas Virus:</strong> Berkas APK ini dikompilasi secara otomatis langsung dari repositori resmi GitHub Komazi POS via GitHub Actions CI/CD.
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'pos-2',
      step: 2,
      title: 'Izin Perangkat & Login Akun Kasir / Staf',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      icon: Smartphone,
      summary: 'Memberikan izin Bluetooth untuk printer dan masuk ke sesi kerja.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Saat membuka aplikasi Komazi POS untuk pertama kali, Android akan meminta izin akses perangkat:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>
              <strong>Perangkat Terdekat / Bluetooth (Nearby Devices):</strong> Wajib pilih <strong>"Izinkan"</strong> agar aplikasi dapat mendeteksi dan mengirim data cetak ke printer thermal kasir.
            </li>
            <li>
              <strong>Notifikasi:</strong> Pilih <strong>"Izinkan"</strong> untuk menerima lonceng pesanan baru dan pengingat pergantian shift.
            </li>
          </ul>
          <div className="mt-2 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs space-y-1">
            <span className="font-semibold text-neutral-200">Masuk Akun Staf:</span>
            <p className="text-neutral-400">
              Masukkan Username dan Kata Sandi yang telah didaftarkan oleh Owner/Manager. Sistem secara otomatis mengenali peran Anda (Kasir, Barista, Kitchen, Manager, atau Owner) dan menyesuaikan menu layar utama.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'pos-3',
      step: 3,
      title: 'Koneksi Printer Thermal Bluetooth & USB (58mm / 80mm)',
      role: 'CASHIER',
      roleLabel: 'Kasir & Manager',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      icon: Printer,
      summary: 'Menghubungkan printer struk kasir tanpa memerlukan aplikasi pihak ketiga.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Komazi POS dilengkapi native ESC/POS thermal printer driver yang kompatibel dengan printer thermal Bluetooth dan USB seperti Iware, Panda, VSC, Xprinter, Epson, dan Sunmi.
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>Nyalakan printer thermal dan pastikan kertas struk 58mm atau 80mm telah terpasang dengan benar.</li>
            <li>Di tablet Android, buka <strong>Pengaturan Bluetooth</strong> dan lakukan *Pairing* ke nama printer Anda (PIN bawaan biasanya <code>0000</code> atau <code>1234</code>).</li>
            <li>Di aplikasi Komazi POS, tekan tombol <strong>"Hubungkan Printer"</strong> di sidebar kiri bawah atau buka menu <strong>Printer</strong>.</li>
            <li>Pilih perangkat printer dari daftar yang muncul, lalu tekan <strong>Hubungkan</strong>.</li>
            <li>Tekan tombol <strong>Uji Cetak (Test Print)</strong> untuk memastikan logo, teks, dan QRIS tercetak tajam.</li>
          </ol>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>
              <strong>Auto-Reconnect Pintar:</strong> Setelah terhubung 1 kali, aplikasi akan otomatis menyambungkan kembali ke printer saat aplikasi dibuka atau kembali dari background.
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'pos-4',
      step: 4,
      title: 'Buka Shift Kasir & Modal Kas Awal (Cash Float)',
      role: 'CASHIER',
      roleLabel: 'Kasir',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: Wallet,
      summary: 'Mencatat modal kas di laci kasir sebelum melayani transaksi pelanggan.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Untuk memastikan keakuratan rekonsiliasi kas di akhir hari, kasir diwajibkan membuka sesi kasir sebelum dapat menginput penjualan:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>Saat masuk ke menu POS, sistem akan menampilkan jendela <strong>"Buka Sesi Kasir Baru"</strong>.</li>
            <li>Masukkan jumlah <strong>Kas Modal Awal</strong> yang ada di laci uang (contoh: <code>Rp 200.000</code> untuk uang kembalian pagi).</li>
            <li>Masukkan catatan opsional jika ada (misal: "Shift Pagi - Kasir Rina").</li>
            <li>Tekan tombol <strong>Buka Shift</strong>.</li>
          </ol>
          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-neutral-400">
            <span className="text-komazi-coral font-bold block mb-1">🔔 Notifikasi Otomatis:</span>
            Bot Telegram Owner & Manager akan langsung menerima pemberitahuan instan lengkap dengan nama kasir yang bertugas, tanggal, dan nominal modal awal di laci.
          </div>
        </div>
      ),
    },
    {
      id: 'pos-5',
      step: 5,
      title: 'Alur Transaksi Kasir, Dine-In / Take-Away, & Catatan Menu',
      role: 'CASHIER',
      roleLabel: 'Kasir',
      badgeColor: 'bg-komazi-coral/15 text-komazi-coral border-komazi-coral/30',
      icon: Coffee,
      summary: 'Memilih kategori, varian suhu/gula, nomor meja, dan data pelanggan.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Alur cepat melayani pelanggan di meja kasir:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>
              <strong>Pilih Tipe Pesanan:</strong> Klik tombol <strong>Dine-In</strong> (lalu masukkan nomor meja tamu) atau <strong>Take-Away</strong> (pesanan bungkus bawa pulang).
            </li>
            <li>
              <strong>Pilih Menu & Kustomisasi:</strong> Sentuh menu kopi atau makanan. Jika menu memiliki pilihan (seperti *Hot / Ice*, level gula *Less Sugar*, atau tambahan *Extra Shot*), pop-up opsi akan muncul.
            </li>
            <li>
              <strong>Catatan Khusus:</strong> Tambahkan catatan khusus per menu (misal: "jangan terlalu manis", "sambal dipisah").
            </li>
            <li>
              <strong>Data Pelanggan (CRM):</strong> Ketik nomor WhatsApp atau nama pelanggan untuk mengakumulasikan poin selamat datang / diskon loyalty member.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'pos-6',
      step: 6,
      title: 'Fitur Tahan Nota (Open Bills) & Split Bill',
      role: 'CASHIER',
      roleLabel: 'Kasir',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      icon: FileText,
      summary: 'Menahan pesanan meja saat tamu masih ingin menambah menu sebelum membayar.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Di kedai kopi Komazi, seringkali tamu memesan dahulu dan baru membayar saat hendak pulang:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>
              Setelah memasukkan menu tamu ke keranjang, tekan tombol <strong>"Tahan Nota (Open Bill)"</strong>.
            </li>
            <li>
              Pesanan otomatis disimpan ke server dan tiket pesanan langsung terkirim ke layar dapur/barista (KDS) untuk mulai dimasak tanpa harus menunggu pelunasan.
            </li>
            <li>
              Untuk menambah menu baru ke meja yang sama: Buka tab <strong>Pesanan Aktif</strong>, sentuh nota meja tersebut, tambahkan menu baru, lalu simpan kembali.
            </li>
            <li>
              <strong>Split Bill:</strong> Jika pelanggan ingin membayar terpisah, gunakan fitur Split Bill untuk memecah nota menjadi beberapa struk pembayaran mandiri.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: 'pos-7',
      step: 7,
      title: 'Penerimaan Pembayaran, QRIS Dinamis, & Cetak Struk',
      role: 'CASHIER',
      roleLabel: 'Kasir',
      badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
      icon: Receipt,
      summary: 'Menerima pembayaran tunai, QRIS dinamis, kartu debit, atau transfer bank.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Saat pelanggan siap melunasi pesanan, tekan tombol <strong>Bayar Sekarang</strong>:</p>
          <ul className="list-disc list-inside space-y-2 pl-1 text-xs sm:text-sm">
            <li>
              <strong>Tunai:</strong> Masukkan nominal uang yang diserahkan pelanggan. Aplikasi memiliki tombol pecahan cepat (Rp 50.000, Rp 100.000, Uang Pas). Layar otomatis menampilkan nominal kembalian dengan angka besar.
            </li>
            <li>
              <strong>QRIS Dinamis:</strong> Layar tablet kasir akan menampilkan barcode QRIS resmi dengan nominal tagihan yang terkunci persis hingga rupiah terakhir. Pelanggan cukup memindai dengan BCA, Mandiri, GoPay, OVO, Dana, atau ShopeePay.
            </li>
            <li>
              <strong>Cetak Struk:</strong> Klik <strong>Selesaikan Pembayaran</strong>. Printer thermal otomatis mencetak struk belanja, dan laci kas (*Cash Drawer*) akan terbuka secara elektrik.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'pos-8',
      step: 8,
      title: 'Tutup Shift Kasir (Z-Report) & Rekonsiliasi Kas Fisik',
      role: 'CASHIER',
      roleLabel: 'Kasir & Manager',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      icon: Clock,
      summary: 'Menghitung uang kas fisik di laci dan mencetak laporan Z-Report penutupan.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Di akhir jam operasional atau saat pergantian kasir, lakukan tutup shift untuk mencegah selisih kas:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>Buka menu <strong>Kas Kasir</strong> lalu pilih <strong>Tutup Sesi (Close Shift)</strong>.</li>
            <li>
              Hitung uang fisik yang ada di laci uang, masukkan jumlah lembar uang pecahan (Rp 100.000, Rp 50.000, Rp 20.000, dst.).
            </li>
            <li>
              Sistem secara otomatis membandingkan total uang fisik aktual dengan perhitungan sistem (Modal Awal + Penjualan Tunai - Pengeluaran Kas Kecil).
            </li>
            <li>Status selisih kas akan tertera jelas: <strong>Pas (Sesuai)</strong>, <strong>Selisih Lebih</strong>, atau <strong>Selisih Kurang</strong>.</li>
            <li>Tekan <strong>Tutup Shift & Cetak Struk</strong>. Printer akan mencetak struk audit Z-Report, dan rekapan lengkap dikirimkan ke Telegram Owner!</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'pos-9',
      step: 9,
      title: 'Ketahanan Mode Offline (Offline-Resilience)',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
      icon: Radio,
      summary: 'Tetap bisa melayani transaksi kasir saat Wi-Fi atau koneksi internet mati.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Komazi POS dilengkapi arsitektur tangguh berbasis IndexedDB lokal. Jika internet kedai mendadak terputus di tengah antrean padat:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>Indikator di pojok atas akan beralih menjadi <strong>"Mode Offline"</strong> berwarna oranye.</li>
            <li>Kasir tetap dapat memilih menu, mencetak struk thermal ke printer, dan menerima pembayaran tunai tanpa hambatan.</li>
            <li>Semua transaksi diantrekan secara aman di memori tablet.</li>
            <li>Begitu koneksi internet pulih, aplikasi secara otomatis menyinkronkan seluruh antrean transaksi ke cloud database tanpa perlu tindakan manual.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'pos-10',
      step: 10,
      title: 'Kitchen Display System (KDS) & Monitor Layar Dapur/Bar',
      role: 'KITCHEN',
      roleLabel: 'Barista & Kitchen',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: Tv,
      summary: 'Antrean pesanan otomatis terpisah antara stasiun dapur makanan dan bar kopi.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Aplikasi APK yang sama dapat difungsikan sebagai layar KDS tablet dapur atau monitor bar barista:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>Saat staf dengan akun <strong>BARISTA</strong> login, layar otomatis hanya menampilkan pesanan minuman kopi & non-kopi.</li>
            <li>Saat staf dengan akun <strong>KITCHEN</strong> login, layar otomatis menampilkan pesanan makanan & camilan dapur.</li>
            <li>Tiket dilengkapi pewarnaan durasi (Hijau: Baru Masuk, Kuning: 10+ Menit, Merah: 20+ Menit).</li>
            <li>Sentuh tombol <strong>Mulai Racik</strong> saat pesanan diproses, dan <strong>Siap Saji</strong> saat pesanan selesai. Kasir akan segera diberitahu untuk mengantarkan ke meja tamu!</li>
          </ul>
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // PANDUAN BOT TELEGRAM DATA
  // ─────────────────────────────────────────────────────────────────────────────
  const botGuides = [
    {
      id: 'bot-1',
      step: 1,
      title: 'Cara Menautkan Akun Staf dengan Kode Tautan (/start KODE)',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-komazi-coral/15 text-komazi-coral border-komazi-coral/30',
      icon: Terminal,
      summary: 'Menghubungkan akun Telegram staf secara aman ke sistem kasir Komazi POS.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Bot Telegram Komazi POS bersifat privat dan hanya dapat digunakan oleh staf yang telah diberi otorisasi resmi:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>
              Minta <strong>Kode Tautan (6 digit)</strong> kepada Owner kedai, atau Owner dapat membuatnya via perintah <code>/tautkan</code> di bot.
            </li>
            <li>Buka aplikasi Telegram di HP Anda dan cari username bot Komazi POS outlet Anda.</li>
            <li>
              Kirimkan pesan dengan format:
              <div className="mt-1 font-mono text-xs p-2 rounded-lg bg-black/60 text-komazi-teal-light border border-komazi-border">
                /start KODE_TAUTAN
              </div>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Contoh: <code>/start A7X9K2</code></span>
            </li>
            <li>
              Bot akan memverifikasi kode, menyapa Anda sesuai nama & peran terdaftar, serta memunculkan tombol menu pintasan di bagian bawah obrolan.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: 'bot-2',
      step: 2,
      title: 'Navigasi Tombol Keyboard Bawah & Cara Menutupnya',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      icon: Layers,
      summary: 'Menggunakan tombol pintasan cepat 2 kolom dan menyembunyikannya kapan saja.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Di bagian bawah layar chat Telegram Anda tersedia tombol pintasan cepat 2 kolom yang disesuaikan dengan peran Anda:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li>
              <strong>Menutup Tombol Menu:</strong> Tekan tombol <strong>"❌ Sembunyikan Menu"</strong> di kanan bawah, atau ketik <code>/tutup_menu</code> agar layar chat lebih luas.
            </li>
            <li>
              <strong>Memunculkan Kembali:</strong> Ketik perintah <code>/menu</code> kapan saja, atau tekan ikon kotak keyboard bawaan aplikasi Telegram Anda.
            </li>
            <li>
              <strong>Membatalkan Pengisian:</strong> Ketik <code>/batal</code> jika ingin membatalkan pengisian formulir interaktif di bot.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'bot-3',
      step: 3,
      title: 'Fitur & Perintah Khusus Owner (Pemilik Kedai)',
      role: 'OWNER',
      roleLabel: 'Khusus Owner',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: ShieldCheck,
      summary: 'Memantau omzet realtime, laba rugi, HPP, analitik AI, dan kesehatan server.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Owner memiliki akses pengawasan bisnis dan eksekutif penuh:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/ringkasan</code>
              <p className="text-neutral-400 mt-1">Omzet realtime hari ini vs kemarin, persentase pertumbuhan, jumlah struk, dan rincian Tunai vs QRIS.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/profit</code>
              <p className="text-neutral-400 mt-1">Laporan estimasi laba bersih, HPP (COGS), pengeluaran operasional, dan margin keuntungan.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/prediksi</code>
              <p className="text-neutral-400 mt-1">Proyeksi kecerdasan buatan Komazi AI mengenai jam-jam paling sibuk (*peak hours*) hari ini.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/cek_stok_kritis</code>
              <p className="text-neutral-400 mt-1">Analisis laju pemakaian bahan baku dan perkiraan sisa hari sebelum bahan habis.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/tautkan</code>
              <p className="text-neutral-400 mt-1">Membuat kode tautan unik 6 digit untuk staf baru agar dapat mengakses bot.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-komazi-coral font-bold">/sentinel</code>
              <p className="text-neutral-400 mt-1">Cek kesehatan server, konektivitas database cloud, dan latensi websocket realtime.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bot-4',
      step: 4,
      title: 'Fitur & Perintah Khusus Manager (Pengelola Operasional)',
      role: 'MANAGER',
      roleLabel: 'Manager & Owner',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      icon: Users,
      summary: 'Persetujuan void nota/diskon, kelola stok bahan baku, dan menu habis.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Manager mengontrol stok barang dan memberikan persetujuan operasional kasir:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/approval</code>
              <p className="text-neutral-400 mt-1">Melihat daftar permohonan void nota kasir atau diskon manual, dilengkapi tombol <strong>Setujui</strong> / <strong>Tolak</strong>.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/stok</code>
              <p className="text-neutral-400 mt-1">Cek sisa stok seluruh bahan baku, batas minimum, dan tombol pesan ulang via WhatsApp distributor.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/stok_masuk</code>
              <p className="text-neutral-400 mt-1">Catat kiriman bahan baku yang baru dibeli dari supplier agar stok otomatis bertambah.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/waste</code>
              <p className="text-neutral-400 mt-1">Catat bahan baku terbuang, basi, tumpah, atau terpakai untuk kalibrasi grinder espresso.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/habis</code>
              <p className="text-neutral-400 mt-1">Tandai menu makanan/minuman yang habis (*Sold Out*) atau aktifkan kembali dalam 1 klik.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-purple-400 font-bold">/laporan</code>
              <p className="text-neutral-400 mt-1">Rekap omzet harian beserta daftar 5 menu paling laris (*Top 5 Best Seller*).</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bot-5',
      step: 5,
      title: 'Fitur & Perintah Khusus Kasir (Cashier)',
      role: 'CASHIER',
      roleLabel: 'Kasir',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      icon: Wallet,
      summary: 'Buka/tutup shift via Telegram, quick order, dan manajemen tamu workspace.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Kasir dapat melakukan aksi kilat tanpa harus selalu berdiri di depan komputer:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/buka_shift</code>
              <p className="text-neutral-400 mt-1">Buka shift kasir dan input modal awal kas laci langsung via Telegram.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/tutup_shift</code>
              <p className="text-neutral-400 mt-1">Tutup shift kasir, input uang fisik aktual, dan kirimkan laporan Z-report otomatis.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/order</code>
              <p className="text-neutral-400 mt-1">Buat pesanan kilat interaktif dari chat Telegram (pilih Dine-In / Take-Away, meja, & menu).</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/pesanan</code>
              <p className="text-neutral-400 mt-1">Lihat daftar nota aktif yang belum dibayar (*Open Bills*) atau ajukan void ke manager.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/workspace</code>
              <p className="text-neutral-400 mt-1">Cek ketersediaan meja coworking space, durasi tamu, dan sisa waktu paket.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <code className="text-emerald-400 font-bold">/checkin & /checkout</code>
              <p className="text-neutral-400 mt-1">Daftarkan tamu baru ke area workspace atau selesaikan durasi sewa meja.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bot-6',
      step: 6,
      title: 'Fitur Khusus Barista & Dapur (Kitchen)',
      role: 'KITCHEN',
      roleLabel: 'Barista & Kitchen',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: Coffee,
      summary: 'Melihat antrean pesanan aktif dan mengubah status proses racik secara instan.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Didesain sangat ringkas agar barista dan koki dapat fokus pada produksi pesanan:
          </p>
          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <code className="text-amber-400 font-bold text-sm">/antrean</code>
              <span className="text-neutral-400">— Menampilkan seluruh tiket pesanan aktif yang menunggu diracik.</span>
            </div>
            <div className="pt-2 border-t border-komazi-border/60 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[11px]">▶️ Mulai Racik</span>
                <span className="text-neutral-300">Ubah status tiket menjadi <em>"Sedang Diracik ⏳"</em>.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">✅ Siap Saji</span>
                <span className="text-neutral-300">Tandai pesanan telah selesai, bot otomatis memberi tahu kasir untuk mengantar ke meja.</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bot-7',
      step: 7,
      title: 'Asisten Cerdas Komazi AI & Mode Chat Bebas',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      icon: Sparkles,
      summary: 'Tanya jawab seputar performa kedai menggunakan bahasa percakapan sehari-hari.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Komazi POS dilengkapi mesin AI yang mengerti bahasa manusia sehari-hari tanpa perlu menghafal kode:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-1 text-xs sm:text-sm">
            <li>
              <strong>Tanya Langsung (/ai):</strong>
              <div className="font-mono text-xs p-2 rounded-lg bg-black/60 text-indigo-300 border border-komazi-border mt-1">
                /ai bagaimana performa omzet penjualan hari ini?
              </div>
            </li>
            <li>
              <strong>Mode Chat Bebas (/ai on):</strong> Mengaktifkan mode mengobrol bebas. Anda bisa langsung mengetik pertanyaan layaknya mengobrol dengan rekan kerja tanpa awalan <code>/ai</code>.
            </li>
            <li>
              <strong>Matikan Mode Chat Bebas:</strong> Ketik <code>/ai off</code> untuk kembali ke mode perintah normal.
            </li>
            <li>
              <strong>Bersihkan Riwayat Obrolan:</strong> Ketik <code>/ai reset</code> untuk memulai topik baru dari awal.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'bot-8',
      step: 8,
      title: 'Pengaturan Tugas Otomatis & Pengingat (/cron & /jobs)',
      role: 'MANAGER',
      roleLabel: 'Manager & Owner',
      badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      icon: Clock,
      summary: 'Mengatur pengiriman laporan omzet tutup buku dan pengingat tugas berkala.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>
            Kelola tugas otomatis kedai menggunakan bahasa sehari-hari tanpa perlu sintaks cron bintang-bintang (* * *):
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <span className="font-bold text-cyan-400 block mb-1">Contoh Mengubah Waktu (/cron ubah):</span>
              <ul className="list-disc list-inside space-y-1 text-neutral-300 font-mono text-[11px]">
                <li>/cron ubah 1 tiap jam 22.00 <span className="text-neutral-500 font-sans">(Laporan tutup buku jam 10 malam)</span></li>
                <li>/cron ubah 1 08:30 <span className="text-neutral-500 font-sans">(Pengingat pagi jam 08:30 WIB)</span></li>
                <li>/cron ubah 1 tiap senin 09:00 <span className="text-neutral-500 font-sans">(Briefing mingguan tiap Senin)</span></li>
                <li>/cron ubah 1 tiap 30 menit <span className="text-neutral-500 font-sans">(Pengecekan berkala)</span></li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-komazi-surface-2 border border-komazi-border">
                <code>/cron buat</code> — Buat jadwal baru
              </div>
              <div className="p-2 rounded-lg bg-komazi-surface-2 border border-komazi-border">
                <code>/cron saya</code> — Lihat semua jadwal aktif
              </div>
              <div className="p-2 rounded-lg bg-komazi-surface-2 border border-komazi-border">
                <code>/cron jeda &lt;id&gt;</code> — Matikan sementara
              </div>
              <div className="p-2 rounded-lg bg-komazi-surface-2 border border-komazi-border">
                <code>/cron jalankan &lt;id&gt;</code> — Kirim sekarang juga
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bot-9',
      step: 9,
      title: 'Sistem Notifikasi Peringatan Instan (Proactive Alerts)',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      icon: Bell,
      summary: 'Menerima pemberitahuan proaktif tanpa harus mengetik perintah.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Bot akan secara otomatis mengirim pesan peringatan penting ke Telegram Anda saat kejadian berikut berlangsung:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm">
            <li><strong>Tiket Pesanan Masuk:</strong> Dikirim instan ke Barista & Kitchen begitu kasir menekan simpan nota.</li>
            <li><strong>Pesanan Siap Saji:</strong> Dikirim ke Kasir saat barista menekan tombol Siap Saji.</li>
            <li><strong>Permintaan Void / Diskon:</strong> Dikirim ke Manager & Owner saat kasir meminta persetujuan pembatalan transaksi.</li>
            <li><strong>Peringatan Stok Menipis:</strong> Peringatan otomatis jika bahan baku kritis berada di bawah batas minimum.</li>
            <li><strong>Buka & Tutup Shift:</strong> Laporan modal kas awal dan audit rekonsiliasi kas Z-Report ke Owner.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'bot-10',
      step: 10,
      title: 'Pertanyaan Umum & Tips Pemecahan Masalah Bot',
      role: 'ALL',
      roleLabel: 'Semua Staf',
      badgeColor: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
      icon: HelpCircle,
      summary: 'Solusi cepat jika bot tidak merespons atau tombol bawah hilang.',
      content: (
        <div className="space-y-3 text-sm text-neutral-300">
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <span className="font-bold text-neutral-200 block mb-0.5">Q: Tombol menu bawah saya hilang, bagaimana memunculkannya?</span>
              <p className="text-neutral-400">Ketik perintah <code>/menu</code> di chat atau klik ikon keyboard 4-titik di samping kotak input teks Telegram.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <span className="font-bold text-neutral-200 block mb-0.5">Q: Bot macet saat mengisi formulir, bagaimana membatalkannya?</span>
              <p className="text-neutral-400">Ketik <code>/batal</code> kapan saja untuk keluar dari formulir dan kembali ke menu utama.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <span className="font-bold text-neutral-200 block mb-0.5">Q: Bisakah kasir melihat laporan keuntungan kedai?</span>
              <p className="text-neutral-400">Tidak bisa. Data finansial, HPP, dan laporan profit hanya dapat diakses oleh akun Owner.</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Filtered guides based on search query and role filter
  const currentGuides = activeTab === 'pos' ? posGuides : botGuides;

  const filteredGuides = useMemo(() => {
    return currentGuides.filter((item) => {
      const matchRole =
        selectedRole === 'ALL' ||
        item.role === 'ALL' ||
        item.role === selectedRole;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.roleLabel.toLowerCase().includes(q);

      return matchRole && matchQuery;
    });
  }, [currentGuides, selectedRole, searchQuery]);

  // Frequently Asked Questions Data
  const faqs = [
    {
      q: 'Apakah data transaksi di tablet akan hilang jika tablet mati mendadak?',
      a: 'Tidak. Setiap pesanan tersimpan secara realtime di database SQLite lokal perangkat serta disinkronkan langsung ke server cloud utama. Jika tablet kehabisan baterai atau mati mendadak, buka kembali aplikasi dan data shift serta transaksi Anda akan tetap utuh.',
    },
    {
      q: 'Bagaimana cara menghubungkan printer thermal jika menggunakan kabel USB OTG?',
      a: 'Cukup colokkan kabel USB printer ke port tablet menggunakan adaptor USB OTG. Berikan izin akses perangkat USB saat diminta oleh Android, lalu buka menu Printer di Komazi POS dan pilih koneksi USB. Driver native akan otomatis mengenali printer Anda.',
    },
    {
      q: 'Berapa banyak staff yang bisa menautkan akun bot Telegram?',
      a: 'Tidak ada batasan jumlah staf. Seluruh staf kedai (Kasir, Barista, Kitchen, Manager, dan Owner) dapat memiliki akun bot masing-masing yang terhubung dengan akun POS resmi mereka.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] text-neutral-100 flex flex-col font-sans selection:bg-komazi-coral selection:text-white">
      {/* Ambient background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[550px] h-[550px] bg-gradient-to-br from-komazi-coral/15 to-amber-600/5 rounded-full blur-[130px]" />
        <div className="absolute top-[35%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-bl from-teal-500/10 to-emerald-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[25%] w-[600px] h-[600px] bg-gradient-to-tr from-purple-600/10 to-indigo-600/5 rounded-full blur-[150px]" />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0B0F14]/80 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" title="Komazi Coffee &amp; Workspace POS">
            <img
              src="/komazi-logo-transparent.png"
              alt="Logo Komazi Coffee &amp; Workspace"
              className="h-11 w-auto object-contain drop-shadow-[0_2px_8px_rgba(249,115,22,0.3)] transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1 font-display leading-tight">
                KOMAZI <span className="text-komazi-coral">POS</span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-semibold text-neutral-300 hover:text-white px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all flex items-center gap-1.5"
            >
              <span>Buka Web POS</span>
              <ExternalLink className="w-3.5 h-3.5 text-komazi-coral" />
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-display text-white leading-tight">
              Aplikasi Kasir<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-komazi-coral to-amber-400">
                Coffee Shop Komazi
              </span>
            </h1>

            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed max-w-xl">
              Komazi POS dirancang secara eksklusif untuk operasional <strong>Komazi Coffee &amp; Workspace</strong> — alur kerja barista, manajemen pesanan kopi &amp; varian rasa, sewa meja coworking/workspace, printer thermal Bluetooth &amp; USB ESC/POS, Barista Display (BDS/KDS), serta integrasi bot Telegram asisten operasional kedai.
            </p>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={primaryDownloadUrl}
                download="komazi-pos.apk"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-komazi-coral to-[#ea580c] hover:from-[#ff7368] hover:to-komazi-coral text-white font-bold text-sm sm:text-base shadow-lg shadow-komazi-coral/30 border border-white/20 transition-all flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Unduh APK</span>
              </a>

              <a
                href={mirrorApkUrl}
                download="komazi-pos.apk"
                className="px-4 py-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 hover:text-white font-semibold text-xs sm:text-sm border border-white/[0.1] transition-all flex items-center gap-2"
                title="Unduh langsung dari server lokal jika CDN lambat"
              >
                <RefreshCw className="w-4 h-4 text-komazi-teal-light" />
                <span>Link Cadangan</span>
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs sm:text-sm font-medium border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-neutral-400" />
                    <span>Salin Tautan</span>
                  </>
                )}
              </button>
            </div>

            {/* QUICK SPECS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.08]">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[11px] text-neutral-400 font-medium block">Ukuran File</span>
                <span className="text-xs sm:text-sm font-bold text-neutral-100 font-mono">~19.1 MB</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[11px] text-neutral-400 font-medium block">Kompatibilitas</span>
                <span className="text-xs sm:text-sm font-bold text-neutral-100">Android 7.0+</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[11px] text-neutral-400 font-medium block">Thermal Printer</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-400">ESC/POS 58 &amp; 80</span>
              </div>
            </div>
          </div>

          {/* QR CODE SCAN CARD */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#182232] to-[#111822] border border-white/[0.1] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                  <QrCode className="w-4 h-4 text-komazi-coral" />
                  <span>Pindai Kamera Tablet</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                  Instalasi Instan
                </span>
              </div>

              {/* QR Image Box */}
              <div className="flex justify-center p-3 rounded-2xl bg-white shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code Unduh APK Komazi POS"
                    className="w-52 h-52 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-neutral-400 text-xs">
                    Membuat kode QR...
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-neutral-400 leading-relaxed">
                Arahkan aplikasi kamera atau Google Lens di tablet kasir atau bar barista Komazi ke QR di atas untuk langsung mengunduh APK tanpa kabel USB.
              </p>

              {/* SHA-256 Checksum Verification */}
              <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 font-medium">SHA-256 Checksum:</span>
                  <button
                    type="button"
                    onClick={handleCopySha}
                    className="text-komazi-coral hover:underline text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSha ? 'Tersalin' : 'Salin Hash'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-neutral-400 bg-black/40 p-2 rounded-xl border border-white/[0.06] break-all leading-tight">
                  {sha256Checksum}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* PREVIEW LAYAR APLIKASI TABLET (SCREENSHOT SHOWCASE)              */}
        {/* ================================================================= */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-white/[0.08]">
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
                Tampilan Antarmuka Komazi POS
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                Antarmuka bertema gelap eksklusif, kontras tinggi, dan minim distraksi mata. Dioptimalkan khusus untuk tablet Android 10" ke atas pada operasional bar kopi &amp; kasir.
              </p>
            </div>
          </div>

          {/* SCREEN SELECTOR TABS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {previewScreens.map((screen, idx) => {
              const ScreenIcon = screen.icon || Coffee;
              const isSelected = selectedPreview === idx;
              return (
                <button
                  key={screen.id}
                  type="button"
                  onClick={() => setSelectedPreview(idx)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-start gap-3 relative overflow-hidden group ${isSelected
                      ? 'bg-gradient-to-br from-[#1d2736] to-[#131b26] border-komazi-coral/60 shadow-lg shadow-komazi-coral/10 ring-1 ring-komazi-coral/40'
                      : 'bg-[#111822]/80 hover:bg-[#182232]/80 border-white/[0.08] hover:border-white/20'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${isSelected
                        ? 'bg-komazi-coral text-white border-komazi-coral shadow-md shadow-komazi-coral/30'
                        : 'bg-white/[0.05] text-neutral-400 border-white/[0.08] group-hover:text-neutral-200 group-hover:bg-white/[0.08]'
                      }`}
                  >
                    <ScreenIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {screen.category}
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral animate-ping" />
                      )}
                    </div>
                    <div className={`text-xs sm:text-sm font-bold truncate mt-0.5 ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                      {screen.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ACTIVE PREVIEW STAGE (MOCKUP & DETAILS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center rounded-3xl bg-gradient-to-br from-[#141b25] via-[#101620] to-[#0d121a] border border-white/[0.1] p-4 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Ambient backlight glow */}
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-komazi-coral/10 rounded-full blur-[100px] pointer-events-none" />

            {/* LEFT / CENTER: TABLET MOCKUP FRAME */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-2xl relative group">
                {/* Tablet Outer Bezel */}
                <div className="rounded-[28px] p-2.5 sm:p-3.5 bg-gradient-to-b from-[#253244] via-[#18202c] to-[#121720] border border-white/[0.15] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                  {/* Tablet Camera dot */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0a0f16] border border-white/20 hidden sm:block" />

                  {/* Tablet Screen Area */}
                  <div className="relative rounded-[20px] overflow-hidden bg-black aspect-[16/10] flex items-center justify-center border border-white/[0.08]">
                    <img
                      src={previewScreens[selectedPreview].image}
                      alt={previewScreens[selectedPreview].alt}
                      className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
                      onClick={() => setIsZoomOpen(true)}
                    />

                    {/* Overlay Zoom Action Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsZoomOpen(true);
                        }}
                        className="pointer-events-auto px-4 py-2.5 rounded-xl bg-[#0B0F14]/90 hover:bg-black text-white text-xs font-bold border border-white/30 backdrop-blur-md shadow-2xl flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform cursor-pointer"
                      >
                        <Maximize2 className="w-4 h-4 text-komazi-coral" />
                        <span>Perbesar Layar Penuh (Zoom)</span>
                      </button>
                    </div>

                    {/* Quick navigation arrows on tablet */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPreview((prev) => (prev > 0 ? prev - 1 : previewScreens.length - 1));
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-70 hover:opacity-100 cursor-pointer shadow-lg"
                      title="Layar sebelumnya"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPreview((prev) => (prev < previewScreens.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-70 hover:opacity-100 cursor-pointer shadow-lg"
                      title="Layar berikutnya"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: FEATURE DETAILS & VALUE PROPOSITION */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${previewScreens[selectedPreview].roleColor}`}>
                  {previewScreens[selectedPreview].roleBadge}
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  &bull; {previewScreens[selectedPreview].category}
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-white">
                  {previewScreens[selectedPreview].title}
                </h3>
                <p className="text-xs text-komazi-coral font-medium mt-0.5">
                  {previewScreens[selectedPreview].subtitle}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                {previewScreens[selectedPreview].description}
              </p>

              {/* HIGHLIGHT CHECKPOINTS */}
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Keunggulan Pada Layar Ini:
                </span>
                <div className="space-y-2">
                  {previewScreens[selectedPreview].highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-neutral-200 hover:text-white text-xs font-semibold border border-white/[0.12] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-komazi-coral" />
                  <span>Lihat Ukuran Asli</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE GUIDE TAB SELECTOR & SEARCH */}
        <section className="space-y-6 pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            {/* Tab Buttons (Self-contained, NO nested routes!) */}
            <div className="flex p-1 rounded-2xl bg-[#111822] border border-white/[0.08] w-full md:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'pos'
                    ? 'bg-gradient-to-r from-komazi-coral to-[#ea580c] text-white shadow-md shadow-komazi-coral/25'
                    : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Panduan APK POS Android</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bot')}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'bot'
                    ? 'bg-gradient-to-r from-komazi-coral to-[#ea580c] text-white shadow-md shadow-komazi-coral/25'
                    : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <Bot className="w-4 h-4" />
                <span>Panduan Asisten Bot Telegram</span>
              </button>
            </div>
          </div>
          {/* GUIDE CARDS LIST */}
          <div className="space-y-4">
            {filteredGuides.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#111822] border border-white/[0.08] text-neutral-400 space-y-2">
                <Search className="w-8 h-8 mx-auto text-neutral-500" />
                <p className="text-sm font-semibold">Tidak menemukan panduan untuk kata kunci "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRole('ALL');
                  }}
                  className="text-xs text-komazi-coral hover:underline"
                >
                  Reset Pencarian & Filter
                </button>
              </div>
            ) : (
              filteredGuides.map((item) => {
                const IconComponent = item.icon || Sparkle;
                return (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#182232]/80 to-[#111822]/90 border border-white/[0.08] hover:border-komazi-coral/30 transition-all shadow-lg space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral font-extrabold text-sm flex items-center justify-center shrink-0">
                          {item.step}
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                            <span>{item.title}</span>
                          </h3>
                          <p className="text-xs text-neutral-400 mt-0.5">{item.summary}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${item.badgeColor}`}>
                          {item.roleLabel}
                        </span>
                      </div>
                    </div>

                    {/* Step Body Content */}
                    <div className="pt-3 border-t border-white/[0.06]">
                      {item.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) */}
        <section className="space-y-4 pt-6">
          <div className="text-center max-w-xl mx-auto space-y-2 mb-6">
            <h2 className="text-2xl font-bold font-display text-white">Pertanyaan Sering Diajukan (FAQ)</h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Jawaban seputar pemasangan aplikasi kasir dan penggunaan asisten Telegram.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#111822] border border-white/[0.08] space-y-2 hover:border-white/[0.15] transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-komazi-coral shrink-0 mt-0.5" />
                  <h4 className="text-sm font-bold text-neutral-200">{faq.q}</h4>
                </div>
                <p className="text-xs text-neutral-400 pl-6 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#090D12] py-8 text-neutral-400 text-xs text-center">
        <div className="max-w-6xl mx-auto px-4 space-y-3">
          <p>&copy; {new Date().getFullYear()} <strong>Komazi Coffee & Workspace</strong>.</p>
        </div>
      </footer>

      {/* FULLSCREEN LIGHTBOX ZOOM MODAL */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-3 sm:p-6"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Top Modal Controls */}
          <div
            className="w-full max-w-5xl flex items-center justify-between py-2 px-3 text-white mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${previewScreens[selectedPreview].roleColor}`}>
                {previewScreens[selectedPreview].roleBadge}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {previewScreens[selectedPreview].title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 hidden sm:inline">
                Tekan <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">ESC</kbd> untuk menutup
              </span>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Main Image Container */}
          <div
            className="relative max-w-5xl w-full max-h-[82vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewScreens[selectedPreview].image}
              alt={previewScreens[selectedPreview].alt}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
            />

            {/* Prev / Next buttons inside modal */}
            <button
              type="button"
              onClick={() =>
                setSelectedPreview((prev) => (prev > 0 ? prev - 1 : previewScreens.length - 1))
              }
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/30 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-2xl"
              title="Layar sebelumnya"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedPreview((prev) => (prev < previewScreens.length - 1 ? prev + 1 : 0))
              }
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/30 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-2xl"
              title="Layar berikutnya"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Caption underneath modal */}
          <div
            className="w-full max-w-5xl text-center pt-3 text-xs text-neutral-300"
            onClick={(e) => e.stopPropagation()}
          >
            {previewScreens[selectedPreview].subtitle} &bull; Layar {selectedPreview + 1} dari {previewScreens.length}
          </div>
        </div>
      )}
    </div>
  );
}
