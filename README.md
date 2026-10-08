<div align="center">

# ☕ KOMAZI POS & WORKSPACE
### *Next-Generation Point of Sale, Multi-Station KDS/BDS, Coworking Hub & AI Sales Intelligence*

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

> **KOMAZI POS** adalah sistem kasir modern (*Point of Sale*) dan manajemen ruang kerja (*Coworking & Workspace*) terintegrasi yang dirancang khusus untuk kedai kopi spesialisasi, cafe-resto, dan hub kolaboratif masa kini. Dibangun dengan arsitektur fullstack berbasis cloud, dukungan cetak printer thermal nirkabel, sistem dapur real-time (KDS/BDS), notifikasi instan Telegram bot, kalkulasi HPP otomatis, serta asisten analisis bisnis AI.

<br />

</div>

---

## 🌟 Fitur Unggulan (Key Features)

### 1. ⚡ Kasir POS Pintar (Point of Sale)
- **Menu & Variasi Fleksibel:** Manajemen ukuran (Regular/Large), suhu (Hot/Iced), dan modifier bahan baku (Extra Shot, Oat Milk, Topping, Less Sugar) dengan catatan khusus ke dapur/bar.
- **Tipe Pesanan Terpadu:** Dukungan **Dine-In** (dengan input nomor meja) dan **Take-Away**.
- **Kalkulasi Finansial Otomatis:** Perhitungan subtotal, diskon (nominal / persentase), service charge (5%), pajak resto PB1/PPN (10%), serta pembulatan cerdas ke nominal terdekat.
- **Hold & Split Bills:** Kemampuan menyimpan transaksi tertahan (*Open Bills*) dan membagi tagihan per pelanggan (*Split Bill*).
- **Multi-Metode Pembayaran:**
  - 💵 **Tunai (Cash):** Tombol pecahan cepat (50k, 100k, 200k), uang pas, dan perhitungan kembalian otomatis.
  - 📱 **QRIS Statis & Dinamis:** Pengurai payload QRIS dengan validasi CRC16 dan render QR otomatis.
  - 🏦 **Transfer Bank:** Nomor rekening bank dengan tombol salin 1-klik dan catatan referensi pembayaran.
- **Efek Konfeti & Audio:** Animasi visual dan efek suara interaktif saat transaksi berhasil diselesaikan.

---

### 2. 🏢 Manajemen Workspace (Coworking Space)
- **Live Monitoring Grid:** Pelacakan status meja komunal, focus pod, dan private meeting room secara real-time.
- **Visual Status Tracker:**
  - 🟢 **Tersedia (Available)**
  - 🔴 **Terisi (Active / Occupied)**
  - 🟡 **Menjelang Habis (< 15 Menit)**
  - 🚨 **Overtime (Melebihi durasi paket)**
- **Check-In Cepat:** Registrasi pelanggan, no. WhatsApp, serta paket waktu (1 Jam, 3 Jam Flow, Full Day Pass, Meeting Room).
- **Penggabungan Tagihan (Bill Merging):** Tagihan sewa workspace dapat digabungkan langsung ke keranjang F&B kasir POS dalam **1 nomor invoice struk yang sama**.

---

### 3. 🍳 Multi-Station KDS & BDS (Kitchen / Barista Display)
- **Station Routing Otomatis:** Pesanan minuman otomatis diteruskan ke layar **Barista (BDS)**, dan pesanan makanan ke layar **Kitchen (KDS)** secara independen.
- **Real-Time WebSocket Sync:** Pembaruan status tiket tanpa perlu refresh halaman melalui Socket.io.
- **Item & Ticket Bumping:** Status progress pesanan (*Menunggu $\rightarrow$ Dimasak $\rightarrow$ Siap Saji $\rightarrow$ Disajikan*) dengan lonceng audio notifikasi saat pesanan baru masuk.

---

### 4. 📊 Analisis HPP / COGS (Cost of Goods Sold) & Resep (BOM)
- **Bill of Materials (BOM):** Penentuan takaran resep bahan baku per porsi (misal: 18g espresso blend, 180ml fresh milk, 25g gula aren).
- **Pemotongan Stok Otomatis:** Bahan baku di gudang otomatis terpotong saat transaksi lunas diselesaikan.
- **Laporan Laba Kotor Real-Time:** Menghitung total omzet, biaya modal terpakai (HPP), keuntungan kotor (*Gross Profit*), dan persentase gross margin menu terlaris.
- **Khusus Hak Akses Owner/Manager:** Keamanan data biaya modal terproteksi dengan verifikasi role.

---

### 5. 🔔 Notifikasi Real-Time Telegram Bot
- **Pemberitahuan Transaksi Lunas:** Setiap kali ada pesanan lunas di kasir, bot Telegram otomatis mengirimkan notifikasi rincian pembayaran, kasir bertugas, nama pelanggan, dan daftar menu ke akun Telegram Owner/Manager.
- **Ringkasan Buka & Tutup Shift:** Laporan modal awal, kas fisik aktual, dan deteksi selisih kas (*Surplus/Defisit*) dikirimkan ke Telegram saat shift ditutup.
- **Otorisasi Permintaan Void:** Fitur integrasi persetujuan pembatalan nota kasir langsung melalui bot.

---

### 6. 🤖 Komazi AI Sales Intelligence
- **Multi-Tier AI LLM Failover:**
  1. ⚡ **Tier 1 (Utama):** Groq Cloud LPU (*ultra-fast response ~300ms*)
  2. 🧠 **Tier 2 (Fallback 1):** Google Gemini 1.5 Flash
  3. 🌐 **Tier 3 (Fallback 2):** OpenRouter AI
  4. 💻 **Tier 4 (Offline):** Mesin analitik deterministik lokal tanpa perlu koneksi internet.
- **Asisten Bisnis:** Tanya jawab interaktif mengenai menu paling laris, proyeksi pendapatan, evaluasi jam ramai (*peak hours*), dan analisis stok bahan baku.

---

### 7. 🖨️ Cetak Struk Kasir Thermal (Hardware Engine)
- **Pilihan Koneksi Printer Lengkap:**
  - 🔵 **Bluetooth Low Energy (BLE)** via Web Bluetooth API
  - 🔌 **Kabel USB / Serial COM Port** via Web Serial API
  - 📱 **Android Native Bluetooth** via Plugin Capacitor Android
  - 🖥️ **Driver Windows / Mac** via dialog cetak browser (Ctrl + P)
- **Format Struk Autentik:** Mendukung ukuran kertas thermal **58mm** dan **80mm** dengan logo outlet, rincian biaya, catatan footer, dan kredensial WiFi tamu.

---

### 8. 📥 Ekspor Laporan Bisnis (Excel & CSV)
- **Microsoft Excel (.xlsx) Resmi:**
  - Header judul outlet & metadata rapi.
  - Lebar kolom otomatis (*auto-width*) agar teks tidak terpotong.
  - Format angka nominal mata uang dan kartu ringkasan KPI.
- **File CSV (.csv) Kompatibel Excel Indonesia:**
  - Menggunakan pemisah titik-koma (`;`) dan direktif `sep=;`.
  - Encoding **UTF-8 dengan BOM (`\uFEFF`)** sehingga langsung otomatis terbagi rapi ke Kolom A–O di Excel Windows.
  - Tanggal terformat dalam waktu lokal (WIB) dan baris total keseluruhan.

---

## 🛠️ Arsitektur & Teknologi (Tech Stack)

| Bagian | Teknologi / Library | Keterangan |
|---|---|---|
| **Frontend Framework** | React 19, Vite 6 | Antarmuka pengguna cepat dan modern |
| **Styling** | Tailwind CSS 3 | Desain responsif bertema dark mode premium |
| **State Management** | Zustand (Persist) | Manajemen state lokal dan sinkronisasi tab |
| **Komunikasi Real-time** | Socket.io Client | WebSocket dua arah untuk KDS/BDS |
| **Visualisasi Data** | Recharts | Grafik area, bar, dan donut analitik penjualan |
| **Mobile App (Android)** | Capacitor 8 | Bundle native Android (.apk) |
| **Backend Framework** | Node.js (ESM), Express.js 4 | RESTful API cepat dan modular |
| **Database & ORM** | MySQL 8, Prisma ORM 6 | Pemodelan relasional dan migrasi skema |
| **Bot Messaging** | Grammy.js (Telegram Bot API) | Bot notifikasi dan komunikasi instan |
| **AI Inference** | Groq SDK, Google Gemini, OpenRouter | Mesin analisis cerdas berbasis AI LLM |
| **Media Cloud Storage** | Cloudinary SDK | Penyimpanan foto produk & media outlet |
| **Spreadsheet Generator**| SheetJS (xlsx) | Pembuat file Microsoft Excel & CSV |

---

## 📂 Struktur Direktori Proyek

```text
pos-komazi/
├── backend/                  # Server Backend REST API & Real-time Service
│   ├── prisma/
│   │   ├── schema.prisma     # Skema Database Prisma (MySQL)
│   │   └── seed.js           # Data awal pengguna, kategori, produk, & resep
│   ├── src/
│   │   ├── bot/              # Handler & Notifier Bot Telegram (Grammy)
│   │   ├── config/           # Konfigurasi Database, Socket, & Environment
│   │   ├── controllers/      # Logika Bisnis (Auth, Order, KDS, Stock, Report)
│   │   ├── middlewares/      # Proteksi JWT, Hak Akses Role, Error Handler
│   │   ├── routes/           # Endpoint Routing Express API
│   │   ├── services/         # Layanan AI, Hardware, Telegram, & WhatsApp
│   │   └── server.js         # Entry Point Server Express & Socket.io
│   ├── .env.example          # Template konfigurasi environment backend
│   └── package.json
│
├── frontend/                 # Aplikasi Web Kasir POS & Dashboard Admin
│   ├── android/              # Native Android Wrapper (Capacitor)
│   ├── public/               # Asset statis, ikon, & logo Komazi
│   ├── src/
│   │   ├── adapters/         # Printer adapter (Android Bluetooth, Web BLE)
│   │   ├── components/       # Komponen UI (POS, KDS, Reports, Settings, Modal)
│   │   ├── hooks/            # Custom React Hooks
│   │   ├── pages/            # Halaman (POS, Workspace, Orders, Menu, Reports)
│   │   ├── services/         # Client API, Socket.io, & Hardware Manager
│   │   ├── store/            # State Store Zustand (Cart, Shift, Stock, Order)
│   │   └── utils/            # Utilitas kalkulasi Rupiah, ESC-POS, Export Excel
│   ├── .env.example          # Template environment frontend
│   ├── tailwind.config.js    # Palet warna khas Komazi (Coral & Teal)
│   └── package.json
│
├── .gitignore                # Aturan isolasi file rahasia (.env, build, keys)
├── prd.md                    # Dokumen Spesifikasi Kebutuhan Produk (PRD)
└── README.md                 # Dokumentasi proyek
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
# Aplikasi aktif di https://localhost:5173 atau http://localhost:5173
```

---

## 👥 Akun Demo & Hak Akses Pengguna

Database telah dilengkapi dengan akun demo bawaan untuk kemudahan pengujian:

| Role | Username | Password | Deskripsi Hak Akses |
|---|---|---|---|
| **OWNER** | `owner` | `password123` | Akses penuh: Finansial, HPP/COGS, Pengaturan, Manajemen Staf, AI |
| **MANAGER** | `manager` | `password123` | Manajemen menu, stok bahan baku, otorisasi void/refund, laporan |
| **CASHIER** | `kasir` | `password123` | Transaksi kasir POS, check-in workspace, buka/tutup shift kas |
| **BARISTA** | `barista` | `password123` | Tampilan stasiun bar / minuman (BDS) & status antrean cup |

> **PIN Otorisasi Manager/Owner Bawaan:** `1234` *(Dapat diubah oleh Owner di menu Pengaturan).*

---

## 🎨 Palet Desain Komazi (Design System)

- **Latar Utama (`komazi-black`):** `#0A0A0A`
- **Surface Kartu (`komazi-surface`):** `#141414`
- **Surface Input/Hover (`komazi-surface-2`):** `#1E1E1E`
- **Aksen Primer Coral (`komazi-coral`):** `#FF5A4D` *(Enerjik, modern, dan hangat)*
- **Aksen Sekunder Teal (`komazi-teal`):** `#1F6F6B` *(Stabil, elegan, khas kopi)*
- **Tipografi:** *Poppins* (Brand & Judul) & *Inter* (Teks & Angka Tabular)

---

## 🛡️ Keamanan & Privasi Data
- **Zero Secrets in Git:** Seluruh API key, password database, token bot Telegram, dan kredensial JWT terlindungi di dalam `.env` dan diabaikan oleh `.gitignore`.
- **Role-Based Access Control (RBAC):** Middleware memvalidasi setiap pemanggilan rute backend berdasarkan token JWT pengguna.
- **PIN Authorization:** Pembatalan nota (*Void*) dan pengembalian dana (*Refund*) mewajibkan otorisasi PIN Manager/Owner.

---

## 📄 Lisensi
Proyek ini dilisensikan di bawah lisensi **ISC**.

---

<div align="center">
  <sub>Dikembangkan dengan cinta untuk memajukan industri F&B dan ruang kerja kolaboratif di Indonesia 🇮🇩</sub>
</div>