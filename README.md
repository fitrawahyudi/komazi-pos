<div align="center">

# ☕ KOMAZI POS & WORKSPACE
### *Next-Generation Point of Sale, Multi-Station KDS/BDS, HRIS & Payroll, Coworking Hub & AI Sales Intelligence*

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js_20-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js_4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-00758F?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Capacitor](https://img.shields.io/badge/Capacitor_Android-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-FF5A4D.svg?style=for-the-badge)](LICENSE)

<br />

> **KOMAZI POS** adalah platform ekosistem bisnis terpadu (*All-in-One F&B Management System*) yang menggabungkan sistem kasir modern (**Point of Sale**), manajemen ruang kerja (**Coworking & Workspace**), sistem pesanan dapur real-time (**KDS & BDS**), sistem manajemen SDM terintegrasi (**HRIS, Presensi Anti-Fraud & Payroll**), integrasi printer thermal nirkabel, bot Telegram instan, pengelolaan inventaris & HPP otomatis, serta asisten analisis penjualan berbasis kecerdasan buatan (**AI Sales Intelligence**).

<br />

</div>

---

## 🌟 Fitur Unggulan (Key Features)

### 1. ⚡ Kasir POS Pintar (Point of Sale)
- **Menu & Variasi Fleksibel:** Manajemen ukuran (Regular/Large), suhu (Hot/Iced), modifier bahan baku (Extra Shot, Oat Milk, Topping, Less Sugar) beserta catatan khusus untuk dapur/bar.
- **Harga Menu Dinamis (Dynamic Price):** Mendukung menu dengan harga fleksibel/terbuka (*open price*) dengan batas minimum harga (`minPrice`), memudahkan produk kustom atau donasi.
- **Tipe Pesanan Terpadu:** Pilihan **Dine-In** (lengkap dengan input nomor meja) dan **Take-Away**.
- **Kalkulasi Finansial Otomatis:** Perhitungan subtotal, diskon (nominal / persentase), service charge (5%), pajak resto PB1/PPN (10%), serta pembulatan cerdas ke kelipatan terdekat.
- **Hold & Split Bills & Merge Bill:** Kemampuan menahan nota transaksi (*Open Bills*), membagi tagihan per pelanggan (*Split Bill*), serta menggabungkan beberapa meja (*Merge Bills*).
- **Multi-Metode Pembayaran:**
  - 💵 **Tunai:** Tombol pecahan cepat (50k, 100k, 200k), uang pas, dan perhitungan kembalian otomatis.
  - 📱 **QRIS Statis & Dinamis:** Pengurai payload QRIS dengan validasi CRC16 dan render QR otomatis.
  - 🏦 **Transfer Bank:** Nomor rekening bank dengan tombol salin 1-klik dan catatan referensi transfer.
- **Mode Layar Penuh (Fullscreen):** Tombol layar penuh di navbar atas (dan tombol F11) untuk pengalaman kasir tanpa distraksi browser.
- **Efek Audio & Konfeti:** Efek suara dan animasi visual interaktif saat transaksi berhasil diselesaikan.

---

### 2. 👥 Modul HRIS & Penggajian Terpadu (Human Resource Information System)
- **Employee Management:** Pengelolaan profil pegawai, departemen (Operasional, Bar, Dapur, Manajemen), tipe kontrak kerja (*Full Time, Part Time, Contract*), dan struktur upah.
- **Presensi Selfie & Geolocation (Anti-Fraud):** Pencatatan *Clock In* dan *Clock Out* menggunakan kamera selfie dan koordinat GPS radius outlet kedai untuk mencegah titip absen.
- **Jadwal Shift Roster:** Penjadwalan giliran kerja harian (Pagi, Siang, Malam, Full Day) terhubung ke pembatasan akses sesi kasir.
- **Manajemen Cuti & Lembur:** Pengajuan cuti/izin tahunan serta lembur dengan verifikasi bertingkat (*Maker-Checker*).
- **Payroll & Slip Gaji Digital Otomatis:** Kalkulasi penggajian otomatis berbasis kehadiran aktual, potongan keterlambatan, tunjangan makan harian, dan jam lembur menjadi slip gaji digital transparan.
- **Registrasi & Impor Staf:** Pendaftaran akun staf baru dengan generator kata sandi acak dan dukungan impor massal via file Excel.

---

### 3. 🏢 Manajemen Workspace & Coworking Space
- **Live Monitoring Grid:** Pemantauan status meja komunal, focus pod, dan private meeting room secara real-time.
- **Visual Status Tracker:**
  - 🟢 **Tersedia (Available)**
  - 🔴 **Terisi (Active / Occupied)**
  - 🟡 **Menjelang Habis (< 15 Menit)**
  - 🚨 **Overtime (Melebihi durasi paket)**
- **Check-In Cepat:** Registrasi pelanggan, no. WhatsApp, serta paket waktu (1 Jam, 3 Jam Flow, Full Day Pass, Meeting Room).
- **Penggabungan Tagihan (Bill Merging):** Tagihan sewa workspace dapat digabungkan langsung ke keranjang kasir POS F&B dalam **1 nomor nota struk yang sama**.

---

### 4. 🍳 Multi-Station KDS & BDS (Kitchen / Barista Display System)
- **Station Routing Otomatis:** Pesanan minuman otomatis diarahkan ke stasiun **Barista (BDS)**, dan pesanan makanan ke stasiun **Kitchen (KDS)** secara mandiri.
- **Real-Time WebSocket Sync:** Pembaruan status tiket tanpa perlu me-refresh halaman melalui Socket.io.
- **Item & Ticket Bumping:** Status progress pesanan (*Menunggu $\rightarrow$ Dimasak $\rightarrow$ Siap Saji $\rightarrow$ Disajikan*) dengan lonceng notifikasi audio saat pesanan baru masuk.
- **Mode TV Standalone:** Layar KDS khusus layar penuh untuk dipasang pada Android TV atau tablet dapur tanpa menu navigasi kasir.

---

### 5. 📊 Analisis HPP / COGS (Cost of Goods Sold) & Resep (BOM)
- **Bill of Materials (BOM):** Penentuan takaran resep bahan baku per porsi (misal: 18g espresso blend, 180ml fresh milk, 25g gula aren).
- **Pemotongan Stok Otomatis:** Bahan baku di gudang otomatis terpotong saat transaksi kasir lunas.
- **Kalkulator HPP Impor Menu:** Saat mengimpor menu dari Excel, HPP otomatis terhitung berdasarkan komponen resep dan harga bahan baku master.
- **Laporan Laba Kotor Real-Time:** Menghitung total omzet, biaya modal terpakai (HPP), keuntungan kotor (*Gross Profit*), dan persentase *Gross Margin* menu terlaris.

---

### 6. 📥 Ekspor & Impor Spreadsheet Excel Pintar (SheetJS)
- **Format Excel Resmi Komazi:**
  - Dilengkapi template standar untuk: Menu Produk, Bahan Baku Gudang, Resep BOM, Pegawai/Staf, Jadwal Shift, Absensi, dan Pelanggan.
  - Tabel pratinjau data interaktif dengan validasi error baris sebelum diunggah ke database.
- **Laporan Laba Rugi & Riwayat Transaksi:** Ekspor laporan penjualan, kas sesi register (Z-Report), dan ringkasan audit log ke format `.xlsx` dan `.csv` UTF-8 dengan BOM (langsung rapi di Microsoft Excel Windows).

---

### 7. 🔔 Notifikasi Real-Time Telegram Bot & Push Notification
- **Notifikasi Pesanan Lunas:** Bot Telegram otomatis mengirimkan notifikasi rincian pembayaran, kasir bertugas, nama pelanggan, dan daftar item belanja ke Telegram Owner/Manager.
- **Ringkasan Shift Register:** Laporan modal awal, kas fisik aktual, dan deteksi selisih kas (*Surplus/Defisit*) dikirimkan ke Telegram saat shift kasir ditutup.
- **Otorisasi Void & Refund:** Permintaan pembatalan nota kasir dapat diverifikasi langsung melalui bot Telegram.
- **Web Push Notifications & Sound:** Pemberitahuan lonceng di browser kasir dan perangkat mobile.

---

### 8. 🤖 Komazi AI Sales Intelligence
- **Multi-Tier AI LLM Failover:**
  1. ⚡ **Tier 1 (Utama):** Groq Cloud LPU (*ultra-fast response ~300ms*)
  2. 🧠 **Tier 2 (Fallback 1):** Google Gemini 1.5 Flash
  3. 🚀 **Tier 3 (Fallback 2):** Ezkielyna AI Cloud (*DeepSeek v4.1 Flash, pembayaran QRIS*)
  4. 🌐 **Tier 4 (Fallback 3):** OpenRouter AI
  5. 💻 **Tier 5 (Offline):** Mesin analitik deterministik lokal tanpa perlu koneksi internet.
- **Asisten Penjualan:** Tanya jawab interaktif mengenai menu terlaris, proyeksi pendapatan, jam ramai (*peak hours*), dan estimasi belanja bahan baku.

---

### 9. 🖨️ Cetak Struk Kasir Thermal (Hardware Engine)
- **Dukungan Konektivitas Luas:**
  - 🔵 **Bluetooth Low Energy (BLE)** via Web Bluetooth API
  - 🔌 **Kabel USB / Serial COM Port** via Web Serial API
  - 📱 **Android Native Bluetooth** via Plugin Capacitor Android
  - 🖥️ **Driver Windows / Mac** via dialog cetak browser (Ctrl + P)
- **Format Struk Autentik:** Ukuran kertas thermal **58mm** dan **80mm** dengan logo kedai, rincian pembayaran, QRIS mini, catatan footer, dan kredensial WiFi tamu.

---

### 10. 🌐 CMS Website Kedai (Landing Page Builder)
- Pengaturan konten website profil kedai langsung dari aplikasi: Banner Utama (*Hero*), Cerita Kedai (*Story & Outlet Info*), Menu Andalan (*Menu Spotlight*), Promo Berjalan, Fasilitas (*Coworking, High-Speed WiFi, Smoking Area*), dan Testimoni Pelanggan.

---

## 🛠️ Arsitektur & Teknologi (Tech Stack)

| Bagian | Teknologi / Library | Keterangan |
|---|---|---|
| **Frontend Framework** | React 19, Vite 6 | Antarmuka pengguna responsif, cepat, dan modern |
| **Styling** | Tailwind CSS 3 | Desain bertema dark mode premium khas Komazi |
| **State Management** | Zustand (Persist) | State management modular dengan sinkronisasi local storage |
| **Real-time Engine** | Socket.io Client | Komunikasi WebSocket dua arah untuk KDS/BDS |
| **Data Visualization** | Recharts | Grafik area, batang, dan lingkaran untuk analitik penjualan |
| **Mobile App (Android)**| Capacitor 8 | Bundle native Android (.apk) & printer ESC/POS plugin |
| **Backend Framework** | Node.js (ESM), Express.js 4 | RESTful API terstruktur dan modular |
| **Database & ORM** | MySQL 8, Prisma ORM 6 | Pemodelan data relasional, transaksi aman & migrasi |
| **Bot Messaging** | Grammy.js (Telegram Bot API) | Bot notifikasi dan komunikasi instan dua arah |
| **AI Inference** | Groq SDK, Google Gemini, OpenRouter | Mesin analitik cerdas multi-tier |
| **Spreadsheet Engine** | SheetJS (xlsx) | Pengurai dan pembuat dokumen Excel & CSV |

---

## 📂 Struktur Direktori Proyek

```text
pos-komazi/
├── backend/                      # Server Backend REST API & Real-time Service
│   ├── prisma/
│   │   ├── schema.prisma         # Skema Database Prisma (MySQL)
│   │   ├── seed.js               # Data awal pengguna, kategori, produk, & resep
│   │   └── data/                 # Data master menu & bahan bawaan
│   ├── src/
│   │   ├── bot/                  # Handler & Notifier Bot Telegram (Grammy)
│   │   ├── config/               # Konfigurasi Database, Socket, & Environment
│   │   ├── controllers/          # Logika Bisnis (Auth, Order, HRIS, Stock, KDS, Report)
│   │   ├── middlewares/          # JWT Auth, RBAC Role Guard, Logger, Validation
│   │   ├── routes/               # Routing Endpoint Express API
│   │   ├── services/             # Layanan AI, Hardware, HRIS, Inventory, Notifikasi
│   │   └── server.js             # Entry Point Server Express & Socket.io
│   ├── .env.example              # Template konfigurasi environment backend
│   └── package.json
│
├── frontend/                     # Aplikasi Web Kasir POS & Dashboard Admin
│   ├── android/                  # Proyek Native Android (Capacitor)
│   ├── public/                   # Asset statis, ikon, logo, template Excel resmi
│   ├── src/
│   │   ├── adapters/             # Adapter printer (Android Bluetooth, Web BLE)
│   │   ├── components/           # Komponen UI (POS, KDS, HRIS, Reports, Settings, Modal)
│   │   ├── hooks/                # Custom React Hooks
│   │   ├── pages/                # Halaman aplikasi (POS, Workspace, Menu, Orders, HRIS, Reports)
│   │   ├── services/             # Client API, Socket.io, & Hardware Manager
│   │   ├── store/                # Store Zustand (Cart, Shift, Stock, HRIS, Order, Auth)
│   │   └── utils/                # Utilitas Rupiah, ESC-POS, Export/Import Excel
│   ├── .env.example              # Template environment frontend
│   ├── tailwind.config.js        # Konfigurasi tema & palet warna Komazi
│   └── package.json
│
├── docs/                         # Spesifikasi fitur teknis & arsitektur modul
├── templates/                    # Template resmi Microsoft Excel impor data Komazi
├── alur.md                       # Panduan alur kerja modul HRIS & Payroll
├── panduan.md                    # Buku panduan lengkap operasional dari awal sampai akhir
├── .gitignore                    # Aturan isolasi file rahasia (.env, build, uploads)
└── README.md                     # Dokumentasi utama proyek
```

---

## 🚀 Panduan Instalasi & Menjalankan Proyek

### 1. Prasyarat Sistem
- **Node.js** v18.x atau lebih baru (direkomendasikan v20+)
- **MySQL Database Server** (XAMPP, Laragon, Docker, atau MySQL Server lokal)
- **Git**

---

### 2. Kloning Repositori
```bash
git clone https://github.com/fitrawahyudi/komazi-pos.git
cd komazi-pos
```

---

### 3. Konfigurasi Backend Server
Masuk ke direktori backend:
```bash
cd backend
npm install
```

Salin file environment:
```bash
cp .env.example .env
```

Buka file `.env` dan sesuaikan koneksi database MySQL serta kunci rahasia Anda:
```env
DATABASE_URL="mysql://root:@localhost:3306/komazi_pos"
PORT=4000
JWT_SECRET="komazi_jwt_secret_key_2026"
JWT_REFRESH_SECRET="komazi_jwt_refresh_secret_key_2026"

# Opsional: Telegram Bot Notifier
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"

# Opsional: AI Sales Intelligence (Groq / Gemini)
GROQ_API_KEY="gsk_your_groq_api_key"
GEMINI_API_KEY="your_gemini_api_key"
```

Setup database & migrasi data bawaan (*seeding*):
```bash
npm run db:setup
```

Jalankan server backend:
```bash
npm run dev
# Server aktif di http://localhost:4000
```

---

### 4. Konfigurasi Frontend Client
Buka terminal baru dan masuk ke direktori frontend:
```bash
cd frontend
npm install
```

Salin file environment frontend:
```bash
cp .env.example .env
```

Jalankan aplikasi frontend:
```bash
npm run dev
# Aplikasi aktif di http://localhost:5173
```

---

## 👥 Akun Demo & Hak Akses Pengguna

Database telah dilengkapi dengan akun bawaan untuk kemudahan pengujian seluruh peran:

| Role | Username | Password | Deskripsi Hak Akses Utama |
|---|---|---|---|
| **OWNER** | `owner` | `password123` | Akses penuh: Finansial, HPP/COGS, Pengaturan, Otorisasi Supervisor, Payroll, Audit Log |
| **MANAGER** | `manager` | `password123` | Supervisi operasional: Jadwal shift, persetujuan cuti/lembur, stok gudang, otorisasi void |
| **CASHIER** | `kasir` | `password123` | Transaksi kasir POS, check-in workspace, buka/tutup sesi register, presensi shift |
| **BARISTA** | `barista` | `password123` | Tampilan stasiun minuman (BDS), status antrean cup, presensi shift |
| **KITCHEN** | `dapur` | `password123` | Tampilan stasiun dapur (KDS), antrean makanan, presensi shift |

> **PIN Otorisasi Supervisor / Owner Default:** `1234` *(Dapat disesuaikan di menu Pengaturan).*

---

## 📚 Dokumentasi Panduan Pengguna

- 🤖 **[Panduan Lengkap Fitur & Perintah Bot Telegram](docs/PANDUAN_FITUR_BOT_TELEGRAM.md)**: Buku panduan lengkap perintah bot Telegram, fungsi setiap tombol, notifikasi otomatis, dan asisten AI Komazi untuk setiap peran staf (Owner, Manager, Kasir, Barista, Kitchen).
- 📖 **[Panduan Sistem Komazi POS](panduan.md)**: Alur operasional sistem kasir POS, meja kerja, dan manajemen kedai.

---

## 🎨 Palet Desain Komazi (Design System)

- **Latar Utama (`komazi-black`):** `#0A0A0A`
- **Surface Kartu (`komazi-surface`):** `#141414`
- **Surface Input/Hover (`komazi-surface-2`):** `#1E1E1E`
- **Aksen Primer Coral (`komazi-coral`):** `#FF5A4D` *(Hangat, energik, dan modern)*
- **Aksen Sekunder Teal (`komazi-teal`):** `#1F6F6B` *(Stabil, elegan, khas kopi)*
- **Tipografi:** *Poppins* (Brand & Judul) & *Inter* (Teks & Angka Tabular)

---

## 🛡️ Keamanan & Privasi Data
- **Zero Secrets in Git:** Kunci API, password database, token bot Telegram, dan token JWT diisolasi aman di dalam file `.env` dan diabaikan oleh `.gitignore`.
- **Role-Based Access Control (RBAC):** Middleware memvalidasi setiap pemanggilan rute backend berdasarkan peran akun pada token JWT pengguna.
- **PIN Otorisasi Kasir:** Pembatalan nota (*Void*) dan pengembalian uang (*Refund*) mewajibkan otorisasi PIN Manager/Owner.
- **Maker-Checker Protocol:** Pengajuan cuti, lembur, dan koreksi presensi tidak dapat disetujui oleh pembuat pengajuan itu sendiri.

---

## 📄 Lisensi
Proyek ini dilisensikan di bawah lisensi **ISC**.

---

<div align="center">
  <sub>Dikembangkan dengan cinta untuk memajukan industri F&B dan ruang kerja kolaboratif di Indonesia 🇮🇩</sub>
</div>