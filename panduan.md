# 📖 PANDUAN PENGGUNAAN KOMAZI POS & WORKSPACE
### *Panduan Lengkap Operasional Aplikasi Dari Awal Sampai Akhir*

Selamat datang di **Komazi POS & Workspace**. Dokumen ini dirancang sebagai buku petunjuk operasional resmi bagi seluruh jajaran staf—mulai dari **Owner (Pemilik)**, **Store Manager**, **Kasir**, **Barista**, hingga **Chef Dapur**.

Panduan ini disusun secara berurutan (*step-by-step*) mulai dari persiapan awal sistem, pengaturan perangkat keras (*hardware*), alur operasional harian (buka shift, transaksi kasir, display dapur, tutup shift), manajemen inventaris bahan baku, penggajian staf (HRIS), hingga laporan analitik keuangan dan pengelolaan website kedai.

---

## 📌 Daftar Isi

1. [Ikhtisar Sistem & Hak Akses Pengguna](#1-ikhtisar-sistem--hak-akses-pengguna)
2. [Menjalankan Aplikasi & Login Pertama Kali](#2-menjalankan-aplikasi--login-pertama-kali)
3. [Tahap 1: Konfigurasi Awal Sistem (Khusus Owner)](#3-tahap-1-konfigurasi-awal-sistem-khusus-owner)
   - 3.1 [Profil Kedai & Desain Struk Thermal](#31-profil-kedai--desain-struk-thermal)
   - 3.2 [Metode Pembayaran (QRIS & Rekening Bank)](#32-metode-pembayaran-qris--rekening-bank)
   - 3.3 [Pajak Restoran (PB1) & Biaya Layanan (Service Charge)](#33-pajak-restoran-pb1--biaya-layanan-service-charge)
   - 3.4 [Koneksi Printer Thermal Kasir & Dapur](#34-koneksi-printer-thermal-kasir--dapur)
   - 3.5 [Keamanan, PIN Otorisasi Supervisor & Kelola Akun Staf](#35-keamanan-pin-otorisasi-supervisor--kelola-akun-staf)
   - 3.6 [Notifikasi Bot Telegram & Push Notification](#36-notifikasi-bot-telegram--push-notification)
4. [Tahap 2: Manajemen Master Data & Logistik Gudang](#4-tahap-2-manajemen-master-data--logistik-gudang)
   - 4.1 [Kategori Menu](#41-kategori-menu)
   - 4.2 [Katalog Produk, Varian & Modifier](#42-katalog-produk-varian--modifier)
   - 4.3 [Data Pemasok (Supplier)](#43-data-pemasok-supplier)
   - 4.4 [Bahan Baku & Nilai Persediaan](#44-bahan-baku--nilai-persediaan)
   - 4.5 [Resep Menu & HPP Otomatis (Bill of Materials)](#45-resep-menu--hpp-otomatis-bill-of-materials)
   - 4.6 [Pencatatan Stok Masuk (Inbound Stock)](#46-pencatatan-stok-masuk-inbound-stock)
   - 4.7 [Stok Opname Fisik & Penyesuaian Selisih](#47-stok-opname-fisik--penyesuaian-selisih)
   - 4.8 [Inventaris Aset & Peralatan Kedai](#48-inventaris-aset--peralatan-kedai)
5. [Tahap 3: Operasional Awal Shift (Pagi Hari)](#5-tahap-3-operasional-awal-shift-pagi-hari)
   - 5.1 [Cek Jadwal Shift Staf](#51-cek-jadwal-shift-staf)
   - 5.2 [Presensi Masuk Kerja (Clock-In)](#52-presensi-masuk-kerja-clock-in)
   - 5.3 [Buka Sesi Kasir & Setor Modal Awal](#53-buka-sesi-kasir--setor-modal-awal)
   - 5.4 [Pemeriksaan Koneksi Printer Kasir](#54-pemeriksaan-koneksi-printer-kasir)
6. [Tahap 4: Transaksi Kasir POS (Point of Sale)](#6-tahap-4-transaksi-kasir-pos-point-of-sale)
   - 6.1 [Antarmuka Kasir & Navigasi Cepat](#61-antarmuka-kasir--navigasi-cepat)
   - 6.2 [Membuat Pesanan Dine-In vs Take-Away](#62-membuat-pesanan-dine-in-vs-take-away)
   - 6.3 [Memilih Varian, Suhu, Modifier & Catatan Khusus](#63-memilih-varian-suhu-modifier--catatan-khusus)
   - 6.4 [Member Pelanggan & Poin Loyalitas (CRM)](#64-member-pelanggan--poin-loyalitas-crm)
   - 6.5 [Fitur Tahan Nota (Hold Bill), Bagi Tagihan (Split) & Gabung Meja (Merge)](#65-fitur-tahan-nota-hold-bill-bagi-tagihan-split--gabung-meja-merge)
   - 6.6 [Proses Pembayaran (Tunai, QRIS Dinamis & Transfer Bank)](#66-proses-pembayaran-tunai-qris-dinamis--transfer-bank)
   - 6.7 [Cetak Struk Kasir & Buka Laci Kas (Cash Drawer)](#67-cetak-struk-kasir--buka-laci-kas-cash-drawer)
7. [Tahap 5: Alur Dapur & Bar Real-Time (KDS & BDS)](#7-tahap-5-alur-dapur--bar-real-time-kds--bds)
   - 7.1 [Pemisahan Layar Barista (BDS) & Kitchen (KDS)](#71-pemisahan-layar-barista-bds--kitchen-kds)
   - 7.2 [Siklus Status Tiket (Menunggu → Dimasak → Siap → Disajikan)](#72-siklus-status-tiket-menunggu--dimasak--siap--disajikan)
   - 7.3 [Fitur Bumping Tiket & Notifikasi Suara](#73-fitur-bumping-tiket--notifikasi-suara)
   - 7.4 [Mode Monitor Layar TV (Standalone Screen)](#74-mode-monitor-layar-tv-standalone-screen)
8. [Tahap 6: Operasional Khusus Selama Shift](#8-tahap-6-operasional-khusus-selama-shift)
   - 8.1 [Arus Kas Keluar & Masuk Kasir (Cash In / Cash Out)](#81-arus-kas-keluar--masuk-kasir-cash-in--cash-out)
   - 8.2 [Pembatalan Transaksi (Void)](#82-pembatalan-transaksi-void)
   - 8.3 [Pengembalian Dana & Retur Transaksi (Refund)](#83-pengembalian-dana--retur-transaksi-refund)
9. [Tahap 7: Operasional Akhir Shift (Malam Hari / Tutup Toko)](#9-tahap-7-operasional-akhir-shift-malam-hari--tutup-toko)
   - 9.1 [Penghitungan Kas Fisik Aktual (Blind Cash Count)](#91-penghitungan-kas-fisik-aktual-blind-cash-count)
   - 9.2 [Rekonsiliasi Kas, Deteksi Selisih & Tutup Shift](#92-rekonsiliasi-kas-deteksi-selisih--tutup-shift)
   - 9.3 [Struk Laporan Tutup Shift & Notifikasi Telegram](#93-struk-laporan-tutup-shift--notifikasi-telegram)
   - 9.4 [Presensi Pulang (Clock-Out)](#94-presensi-pulang-clock-out)
10. [Tahap 8: Laporan Keuangan, Laba Rugi & Analisis Bisnis](#10-tahap-8-laporan-keuangan-laba-rugi--analisis-bisnis)
    - 10.1 [Laporan Penjualan, Jam Sibuk & Metode Bayar](#101-laporan-penjualan-jam-sibuk--metode-bayar)
    - 10.2 [Laporan HPP (COGS) & Margin Laba Kotor](#102-laporan-hpp-cogs--margin-laba-kotor)
    - 10.3 [Laporan Laba Rugi Bersih (P&L)](#103-laporan-laba-rugi-bersih-pl)
    - 10.4 [Ekspor Laporan ke Excel (.xlsx) & CSV](#104-ekspor-laporan-ke-excel-xlsx--csv)
    - 10.5 [Asisten Cerdas Komazi AI Sales Intelligence](#105-asisten-cerdas-komazi-ai-sales-intelligence)
11. [Tahap 9: Siklus HRIS, Cuti, Lembur & Penggajian (Payroll)](#11-tahap-9-siklus-hris-cuti-lembur--penggajian-payroll)
    - 11.1 [Pengaturan Struktur Gaji Karyawan](#111-pengaturan-struktur-gaji-karyawan)
    - 11.2 [Pengajuan & Persetujuan Cuti Staf](#112-pengajuan--persetujuan-cuti-staf)
    - 11.3 [Pengajuan & Verifikasi Jam Lembur](#113-pengajuan--verifikasi-jam-lembur)
    - 11.4 [Koreksi Absensi (Maker-Checker)](#114-koreksi-absensi-maker-checker)
    - 11.5 [Kalkulasi Gaji Otomatis, Finalisasi & Terbit Slip Gaji](#115-kalkulasi-gaji-otomatis-finalisasi--terbit-slip-gaji)
12. [Tahap 10: Pengelolaan Website Landing Page via Studio CMS](#12-tahap-10-pengelolaan-website-landing-page-via-studio-cms)
    - 12.1 [Pengaturan Hero Banner & Cerita Brand](#121-pengaturan-hero-banner--cerita-brand)
    - 12.2 [Menampilkan Menu Spotlight di Beranda](#122-menampilkan-menu-spotlight-di-beranda)
    - 12.3 [Banner Promosi & Event Spesial](#123-banner-promosi--event-spesial)
    - 12.4 [Fasilitas Kedai, Jam Buka & Lokasi Google Maps](#124-fasilitas-kedai-jam-buka--lokasi-google-maps)
    - 12.5 [Ulasan Pelanggan & Optimasi SEO](#125-ulasan-pelanggan--optimasi-seo)
13. [Tahap 11: Integrasi Asisten Bot Telegram](#13-tahap-11-integrasi-asisten-bot-telegram)
    - 13.1 [Menautkan Akun Telegram Staf](#131-menautkan-akun-telegram-staf)
    - 13.2 [Daftar Perintah Cepat Telegram Bot](#132-daftar-perintah-cepat-telegram-bot)
14. [Pemecahan Masalah & Pertanyaan Umum (Troubleshooting)](#14-pemecahan-masalah--pertanyaan-umum-troubleshooting)

---

## 1. Ikhtisar Sistem & Hak Akses Pengguna

Komazi POS menggunakan sistem **Role-Based Access Control (RBAC)** untuk memastikan setiap anggota tim fokus pada tugasnya masing-masing serta menjaga integritas keuangan dan data rahasia outlet.

### Matriks Hak Akses Peran (Roles)

| Menu / Fitur Utama | OWNER (Pemilik) | MANAGER | CASHIER (Kasir) | BARISTA (Bar) | KITCHEN (Dapur) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Transaksi Kasir POS** (`/pos`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Kas Kasir & Peti Uang** (`/cash-drawer`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Buka/Tutup Sesi Kasir** (`/cash-session`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Riwayat Pesanan & Nota** (`/orders`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Retur & Refund Transaksi** (`/refunds`) | ✅ *(Persetujuan)* | ✅ *(Persetujuan)* | ✅ *(Pengajuan)* | ❌ | ❌ |
| **Layar Barista / BDS** (`/kds?station=bar`) | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Layar Dapur / KDS** (`/kds?station=kitchen`)| ✅ | ✅ | ❌ | ❌ | ✅ |
| **Monitor Antrean TV** (`/kds-screen`) | ❌ *(Kios Dapur)*| ❌ *(Kios Dapur)*| ❌ | ✅ | ✅ |
| **Katalog Menu & Kategori** (`/menu`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventaris & Pemasok** (`/inventory/*`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Laporan Penjualan & HPP** (`/reports/*`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Studio CMS Website** (`/cms`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Pengaturan Outlet & Struk** (`/settings`)| ✅ | ❌ | ❌ | ❌ | ❌ |
| **Presensi Mandiri (HRIS)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Atur Jadwal & Cuti Staf** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Kalkulasi Payroll & Terbitkan Gaji** | ✅ | ❌ | ❌ | ❌ | ❌ |

### Akun Bawaan (Default Demo Accounts)

Untuk instalasi awal atau uji coba, gunakan akun bawaan berikut:

| Akun | Username | Password Default | Keterangan |
|---|---|---|---|
| **Owner** | `owner` | `password123` | Hak akses tertinggi ke seluruh fitur dan pengaturan |
| **Manager** | `manager` | `password123` | Hak kelola operasional, menu, stok gudang, dan approval |
| **Kasir** | `kasir` | `password123` | Khusus bertugas di meja kasir dan kas harian |
| **Barista** | `barista` | `password123` | Khusus memproses pesanan minuman di stasiun bar |
| **Dapur** | `dapur` | `password123` | Khusus memproses pesanan makanan di stasiun dapur |

> ⚠️ **Penting:** Segera ganti password bawaan dan PIN Otorisasi Supervisor di menu **Pengaturan ➡️ Keamanan & PIN** sebelum aplikasi digunakan untuk transaksi komersial sesungguhnya!

---

## 2. Menjalankan Aplikasi & Login Pertama Kali

### Menjalankan Sistem Lokal

1. **Jalankan Backend Server:**
   Buka terminal, masuk ke folder `backend`, lalu jalankan:
   ```bash
   npm run dev
   ```
   *Server backend akan aktif di port 4000 (`http://localhost:4000`).*

2. **Jalankan Frontend Client:**
   Buka terminal kedua, masuk ke folder `frontend`, lalu jalankan:
   ```bash
   npm run dev
   ```
   *Aplikasi frontend web akan aktif di port 5173 (`http://localhost:5173`).*

### Mengakses Aplikasi

- **Melalui Komputer Kasir / Laptop (Web Browser):**
  Buka browser Google Chrome atau Microsoft Edge, lalu arahkan ke `http://localhost:5173`.
  - Jika Anda mengakses dari komputer kasir lokal, Anda akan melihat halaman selamat datang atau halaman login.
  - Klik tombol **Masuk Kasir / Staf** di sudut kanan atas untuk membuka halaman login (`/login`).
- **Melalui Tablet POS Android (Aplikasi APK):**
  - Pasang file `.apk` hasil build Capacitor di tablet kasir.
  - Buka aplikasi **Komazi POS**. Aplikasi akan otomatis membuka halaman kasir POS tanpa menampilkan bilah URL browser (*kiosk mode*).

### Melakukan Login

1. Masukkan **Username** dan **Password** Anda.
2. Klik tombol **Masuk ke Sistem**.
3. Sistem akan mengenali peran Anda dan mengarahkan ke halaman yang sesuai:
   - **Owner / Manager / Kasir** diarahkan ke halaman **Transaksi Kasir (`/pos`)**.
   - **Barista / Kitchen** langsung diarahkan ke layar **Kitchen Display System (`/kds-screen`)**.

---

## 3. Tahap 1: Konfigurasi Awal Sistem (Khusus Owner)

Sebelum mulai melayani transaksi pelanggan, Owner wajib menyelesaikan pengaturan identitas gerai dan perangkat di menu **Pengaturan** (`/settings`).

```
[Pengaturan]
  ├── Tab 1: Profil & Struk (Nama gerai, alamat, logo, WiFi, footer)
  ├── Tab 2: Pembayaran & QRIS (Upload QRIS, nomor rekening transfer)
  ├── Tab 3: Pajak & Biaya (PB1 10%, Service Fee 5%, pembulatan)
  ├── Tab 4: Printer & Hardware (Bluetooth thermal, USB, drawer kick)
  ├── Tab 5: Notifikasi & Bot (Telegram bot, Android push notification)
  └── Tab 6: Keamanan & PIN (PIN void/refund 1234, daftar staf, reset password)
```

---

### 3.1 Profil Kedai & Desain Struk Thermal
*Navigasi: Pengaturan ➡️ Tab Profil & Struk (`/settings?tab=outlet`)*

1. **Nama Outlet:** Masukkan nama resmi kedai (contoh: `Komazi Coffee & Workspace`).
2. **Tagline Kedai:** Masukkan slogan outlet (contoh: `Artisan Coffee Roastery & Cozy Space`).
3. **Alamat Lengkap & Kota:** Alamat yang tercetak di bagian atas struk belanja pelanggan.
4. **Nomor Kontak / WhatsApp:** Nomor customer service kedai.
5. **Logo Outlet:** Unggah file logo kedai dalam format PNG/JPG dengan latar transparan atau putih.
6. **Informasi WiFi Tamu:**
   - Masukkan **Nama SSID WiFi** (contoh: `Komazi-Guest`).
   - Masukkan **Password WiFi** (contoh: `kopienakbanget`).
   - *Info ini akan tercetak rapi di bagian bawah struk belanja sehingga pelanggan tidak perlu bertanya ke kasir.*
7. **Pesan Footer Struk:** Kalimat penutup (contoh: `Terima kasih atas kunjungan Anda! Silakan berkunjung kembali`).
8. Klik **Simpan Pengaturan Profil**.

---

### 3.2 Metode Pembayaran (QRIS & Rekening Bank)
*Navigasi: Pengaturan ➡️ Tab Pembayaran & QRIS (`/settings?tab=payment`)*

Sistem kasir Komazi mendukung tiga kanal pembayaran utama:

1. **Uang Tunai:** Selalu aktif secara bawaan dengan kalkulasi kembalian otomatis dan tombol pecahan cepat (50k, 100k, 200k).
2. **QRIS Merchant (Dinamis & Statis):**
   - Klik **Unggah Gambar QRIS** untuk mengunggah barcode QRIS resmi dari bank atau penyedia pembayaran Anda (BCA, Mandiri, GoPay, OVO, ShopeePay, dll.).
   - Sistem akan membaca payload QRIS dan secara otomatis mengaktifkan fitur **QRIS Dinamis**: setiap kali pelanggan membayar via QRIS di kasir, sistem menyuntikkan nominal tagihan pas ke dalam kode QR sehingga pelanggan tidak perlu mengetikkan angka rupiah secara manual.
3. **Transfer Bank:**
   - Masukkan nama bank (contoh: `BCA`, `Bank Mandiri`).
   - Masukkan nomor rekening dan nama pemilik rekening.
   - *Saat kasir memilih metode Transfer, nomor rekening ini akan muncul di layar dengan tombol Salin Cepat.*
4. Klik **Simpan Pengaturan Pembayaran**.

---

### 3.3 Pajak Restoran (PB1) & Biaya Layanan (Service Charge)
*Navigasi: Pengaturan ➡️ Tab Pajak & Biaya (`/settings?tab=tax`)*

1. **Pajak Resto (PB1 / PPN):**
   - Centang **Aktifkan Pajak**.
   - Tentukan persentase pajak (standar restoran di Indonesia adalah `10%`).
2. **Biaya Layanan (Service Charge):**
   - Aktifkan jika kedai Anda mengenakan biaya servis meja (contoh: `5%`).
   - Biaya layanan dihitung dari subtotal sebelum pajak.
3. **Pembulatan Harga (Rounding):**
   - Aktifkan fitur pembulatan jika Anda ingin nominal akhir pecahan rupiah dibulatkan ke kelipatan ratusan rupiah terdekat (contoh: dibulatkan ke Rp 100 terdekat agar kasir tidak kerepotan uang receh).
4. Klik **Simpan Pengaturan Pajak**.

---

### 3.4 Koneksi Printer Thermal Kasir & Dapur
*Navigasi: Pengaturan ➡️ Tab Printer & Hardware (`/settings?tab=printer`) atau melalui ikon Bluetooth di bilah samping*

Komazi mendukung beragam koneksi printer struk thermal standar ESC/POS:

1. **Pilih Ukuran Kertas:**
   - `58mm` (lebar cetak standar mini) atau `80mm` (lebar cetak profesional restoran).
2. **Pilih Metode Koneksi:**
   - **Bluetooth Low Energy (BLE):** Cocok untuk printer thermal portable di laptop atau tablet kasir.
     - Nyalakan Bluetooth printer thermal.
     - Klik tombol **Cari & Hubungkan Printer Bluetooth**.
     - Pilih nama printer dari daftar perangkat browser Chrome (contoh: `RPP02N`, `MP-58`, `POS-80`), lalu klik *Pair*.
   - **Kabel USB / Serial COM Port:** Cocok untuk printer kasir desktop yang terhubung kabel USB ke komputer.
     - Klik **Hubungkan Printer USB**.
     - Pilih port USB printer yang terhubung.
   - **Android Native Bluetooth:** Otomatis aktif saat aplikasi dijalankan di tablet/ponsel Android.
3. **Pengaturan Otomatisasi Perangkat:**
   - **Buka Laci Uang (Open Cash Drawer):** Aktifkan opsi ini jika printer Anda terhubung ke laci kas menggunakan kabel RJ11. Printer akan mengirimkan sinyal hentakan (*kick drawer*) setiap kali pembayaran tunai diselesaikan.
   - **Auto-Cut Paper:** Aktifkan jika printer 80mm Anda memiliki pisau pemotong otomatis.
4. **Uji Coba Cetak (Test Print):**
   - Klik tombol **Cetak Struk Uji Coba**. Jika kertas keluar dan tercetak rapi, konfigurasi printer berhasil.

---

### 3.5 Keamanan, PIN Otorisasi Supervisor & Kelola Akun Staf
*Navigasi: Pengaturan ➡️ Tab Keamanan & PIN (`/settings?tab=security`)*

1. **PIN Otorisasi Supervisor (Void & Refund):**
   - PIN ini wajib dimasukkan kasir saat melakukan pembatalan nota, pemberian diskon khusus di luar sistem, atau pengembalian dana (*refund*).
   - Masukkan PIN 4 digit baru (contoh: `8899`), lalu klik **Simpan PIN**.
2. **Kelola Akun Staf:**
   - Klik tombol **Tambah Akun Staf**.
   - Masukkan Nama Lengkap, Username unik, Password, dan pilih Role (`MANAGER`, `CASHIER`, `BARISTA`, `KITCHEN`).
   - Masukkan nomor telepon staf.
3. **Reset Password Staf:**
   - Jika staf lupa kata sandi, Owner dapat menekan ikon kunci di sebelah nama staf untuk menyetel ulang kata sandi mereka secara langsung.

---

### 3.6 Notifikasi Bot Telegram & Push Notification
*Navigasi: Pengaturan ➡️ Tab Notifikasi & Bot (`/settings?tab=integrations`)*

1. **Telegram Notifier:**
   - Bot Telegram resmi Komazi akan mengirimkan laporan instan ke ponsel Owner setiap kali ada:
     - Transaksi lunas bernilai besar.
     - Pembatalan transaksi (*Void*) atau pengembalian dana (*Refund*).
     - Bahan baku menipis (*Low Stock Alert*).
     - Ringkasan tutup shift dan deteksi selisih kas.
   - Klik **Hubungkan Telegram**, salin kode PIN 6 digit yang muncul, lalu kirimkan kode tersebut ke bot Telegram outlet Anda dengan mengetik `/link <KODE>`.
2. **Android Push Notification:**
   - Untuk kasir dan manager yang menginstal aplikasi Android, aktifkan izin notifikasi saat diminta agar lonceng notifikasi transaksi dan pengingat jadwal dapat berdering di latar belakang.

---

## 4. Tahap 2: Manajemen Master Data & Logistik Gudang

Sebelum mulai berjualan, Store Manager atau Owner perlu menyiapkan katalog menu, takaran bahan baku (resep), data supplier, dan mencatat stok awal di gudang.

```
[Alur Inventaris & Resep]
  Supplier ──(Stok Masuk)──> Bahan Baku ──(Resep BOM)──> Menu Produk ──(Kasir Jual)──> Potong Stok Otomatis
```

---

### 4.1 Kategori Menu
*Navigasi: Bilah Samping ➡️ Manajemen ➡️ Kategori Menu (`/categories`)*

Kategori membantu kasir mencari menu dengan cepat di layar sentuh.
1. Klik tombol **Tambah Kategori**.
2. Masukkan nama kategori (contoh: `Espresso Based`, `Manual Brew`, `Non-Coffee & Tea`, `Snacks & Pastry`, `Main Course`).
3. Tentukan urutan tampil (*sort order*) jika ingin kategori terlaris berada di posisi paling kiri/atas.
4. Klik **Simpan Kategori**.

---

### 4.2 Katalog Produk, Varian & Modifier
*Navigasi: Bilah Samping ➡️ Manajemen ➡️ Menu & Produk (`/menu`)*

#### Langkah Menambah Produk Baru:
1. Klik tombol **Tambah Produk Baru**.
2. Isi formulir informasi menu:
   - **Nama Menu:** (contoh: `Kopi Susu Gula Aren`).
   - **Kategori:** Pilih dari kategori yang sudah dibuat (contoh: `Espresso Based`).
   - **Stasiun Penyiapan (Routing Dapur):**
     - Pilih **Bar (BARISTA)** jika produk berupa minuman.
     - Pilih **Dapur (KITCHEN)** jika produk berupa makanan/snack.
     - *Pilihan ini menentukan ke layar display mana tiket pesanan akan dikirimkan secara otomatis.*
   - **Harga Dasar:** (contoh: `Rp 22.000`).
   - **Kode SKU / Barcode (Opsional):** (contoh: `KMA-ESP-01`).
   - **Foto Produk (Opsional):** Unggah foto menu. Jika dibiarkan kosong (misal saat menu baru ditambahkan dan belum ada foto resmi), sistem kasir secara otomatis menampilkan **Inisial Nama Produk** (contoh: *KS* untuk Kopi Susu, *AM* untuk Americano) dengan kartu gradien warna elegan di layar kasir POS.
3. **Pengaturan Menu Harga Dinamis (Open Price / Fleksibel):**
   - Jika menu tidak memiliki harga tetap (contoh: pesanan katering, produk titipan/konsinyasi, menu timbangan berdasarkan gramasi, atau paket custom), aktifkan toggle **Menu Harga Dinamis (Open Price)**.
   - **Harga Saran / Acuan (Opsional):** Masukkan nominal acuan awal (contoh: `Rp 25.000`). Kasir tetap dapat menyesuaikan angka ini di kasir POS.
   - **Batas Minimum Harga (Opsional):** Masukkan batas bawah harga yang diperbolehkan (contoh: `Rp 15.000`). Kasir tidak akan dapat menginput harga di bawah angka ini. Isi `0` jika tanpa batasan.
4. **Pengaturan Varian Produk (Ukuran / Suhu):**
   - Klik **Tambah Varian**.
   - Contoh varian:
     - `Regular` (+ Rp 0)
     - `Large / Upsize` (+ Rp 5.000)
     - `Hot` (+ Rp 0)
     - `Iced` (+ Rp 2.000)
5. **Pengaturan Modifier (Pilihan Tambahan / Add-ons):**
   - Tambahkan opsi ekstra yang bisa dipilih pelanggan:
     - `Extra Espresso Shot` (+ Rp 6.000)
     - `Oat Milk Substitution` (+ Rp 8.000)
     - `Syrup Vanilla` (+ Rp 4.000)
     - Pilihan manis: `Normal Sweet`, `Less Sugar (50%)`, `No Sugar`.
6. Klik **Simpan Menu**.

#### Impor & Ekspor Menu via Excel (.xlsx) Lengkap Sekaligus Perhitungan HPP:
1. **Unduh Template:** Klik tombol **Import Excel** di bilah atas halaman Menu (`/menu`), lalu klik **Download Template (.xlsx)**. File template `template_import_menu_komazi.xlsx` berisi 4 lembar kerja (*sheet*):
   - **Sheet `Data`:** Tempat mengisi daftar produk, harga, HPP, resep, dan varian.
   - **Sheet `Petunjuk`:** Panduan aturan tiap kolom (wajib atau opsional).
   - **Sheet `Data Kategori`:** Referensi kategori yang sudah ada di sistem.
   - **Sheet `Data Bahan Baku`:** Referensi nama bahan baku, satuan (`gram`, `ml`, `pcs`), dan harga modal persediaan aktif di sistem.
2. **Kalkulasi HPP & Resep Bahan Baku via Excel:**
   - **Kolom `HPP / Modal (Rp)`:** Masukkan biaya modal langsung per porsi produk (contoh: `7500`). Jika kolom ini diisi, sistem otomatis mencatat HPP dan menghitung margin laba kotor.
   - **Kolom `Resep / Bahan Baku (Opsional)`:** Masukkan takaran resep bahan baku dengan format `"Nama Bahan: Takaran Satuan"` (pisahkan dengan koma jika lebih dari satu). Contoh: `Kopi Biji: 18 gram, Susu Fresh: 150 ml, Gula Aren: 20 ml`.
   - **Kalkulasi HPP Otomatis:**
     - Jika bahan baku sudah terdaftar di gudang stok (Sheet `Data Bahan Baku`), sistem secara otomatis mengalikan takaran dengan harga modal bahan di gudang untuk menghasilkan HPP akurat per porsi.
     - Jika bahan baku baru belum ada di gudang, sistem secara otomatis mendaftarkannya ke Master Bahan Baku inventaris.
     - Di jendela pratinjau impor (*Preview*), sistem langsung menampilkan 4 kartu ringkasan: **Total Menu**, **HPP Terhitung**, **Rata-rata Margin Laba (%)**, dan **Estimasi Laba Kotor per Porsi (Rp)**.
3. **Kolom untuk Menu Harga Dinamis:**
   - **`Harga Dinamis?`**: Isi dengan `ya` untuk produk harga fleksibel/open price, atau isi `tidak` (bisa juga dikosongkan) untuk produk dengan harga jual tetap.
   - **`Batas Harga Minimum`**: Isi angka batas harga terendah (misal: `25000`). Kosongkan atau isi `0` jika tanpa batas minimum.
   - **`Harga Jual*`**: Untuk menu dinamis, angka ini berfungsi sebagai harga acuan/rekomendasi awal di kasir.
4. **Unggah File & Pratinjau Cerdas:** Seret atau pilih file Excel yang telah diisi ke kotak upload. Anda dapat meninjau kolom **HPP (Modal)**, persentase **Margin Laba** dengan badge warna cerdas (*hijau >= 60%*, *biru 40-59%*, *kuning 20-39%*, *merah < 20%*), dan rincian resep bahan baku sebelum disimpan ke server.
5. **Ekspor Katalog:** Klik tombol **Ekspor Excel** untuk mengunduh seluruh katalog menu berjalan lengkap dengan kolom status harga dinamis dan batas minimumnya.

---

### 4.3 Data Pemasok (Supplier)
*Navigasi: Bilah Samping ➡️ Inventaris ➡️ Pemasok (`/inventory/suppliers`)*

Catat vendor penyuplai bahan baku kedai Anda:
1. Klik **Tambah Pemasok**.
2. Masukkan **Nama Pemasok** (contoh: `PT Roastery Kopi Nusantara`, `Distributor Susu Segar Jaya`).
3. Masukkan **Nama Kontak (PIC)**, **Nomor WhatsApp**, **Email**, dan **Alamat**.
4. Pilih kategori suplai (contoh: `Biji Kopi`, `Dairy / Susu`, `Kemasan / Cup`, `Sirup & Bahan Minuman`).
5. Klik **Simpan**.

---

### 4.4 Bahan Baku & Nilai Persediaan
*Navigasi: Bilah Samping ➡️ Inventaris ➡️ Sumber Persediaan (`/inventory/sources`)*

Menu ini mencatat seluruh bahan mentah yang digunakan untuk meracik menu:
1. Klik **Tambah Bahan Baku**.
2. Isi data bahan:
   - **Nama Bahan:** (contoh: `Espresso Blend Beans`, `Fresh Milk Pasteurisasi`, `Sirup Gula Aren Cair`, `Paper Cup 12oz`, `Lid Dome`).
   - **Satuan Unit:** Pilih satuan yang sesuai (contoh: `gram`, `ml`, `pcs`, `kg`, `liter`).
   - **Stok Saat Ini:** Jumlah stok fisik yang tersedia di rak/gudang.
   - **Batas Minimum Stok (Min Stock):** (contoh: `1000` gram). *Jika stok menyentuh angka ini, sistem dan bot Telegram otomatis mengirim peringatan stok menipis.*
   - **Harga Beli per Unit (Cost per Unit):** Harga modal per gram/ml (contoh: Biji kopi Rp 200.000/kg = Rp 200 per gram).
   - **Pemasok Terkait:** Hubungkan dengan supplier dari daftar.
3. Klik **Simpan**.

---

### 4.5 Resep Menu & HPP Otomatis (Bill of Materials)
*Navigasi: Bilah Samping ➡️ Manajemen ➡️ Menu & Produk ➡️ Ikon Resep / BOM pada setiap menu*

Fitur ini membuat sistem memotong stok bahan baku secara otomatis setiap kali kasir menyelesaikan transaksi, sekaligus menghitung laba kotor (*Gross Margin*) secara real-time.

#### Contoh Resep Menu: `Kopi Susu Gula Aren (Iced Regular)`
1. Buka menu `Kopi Susu Gula Aren`, lalu pilih tab **Resep / Takaran Bahan**.
2. Tambahkan komponen bahan baku per satu porsi:
   - Bahan: `Espresso Blend Beans` $\rightarrow$ Takaran: `18` gram.
   - Bahan: `Fresh Milk Pasteurisasi` $\rightarrow$ Takaran: `120` ml.
   - Bahan: `Sirup Gula Aren Cair` $\rightarrow$ Takaran: `25` ml.
   - Bahan: `Plastic Cup 12oz` $\rightarrow$ Takaran: `1` pcs.
   - Bahan: `Sedotan Kertas` $\rightarrow$ Takaran: `1` pcs.
3. Sistem otomatis menjumlahkan biaya bahan:
   - $(18 \times \text{Rp } 200) + (120 \times \text{Rp } 18) + (25 \times \text{Rp } 50) + 500 + 150 = \text{Rp } 7.660$.
4. **Kalkulasi Laba:** Jika harga jual Rp 22.000 dan HPP Rp 7.660, maka **Laba Kotor adalah Rp 14.340 (Margin 65,1%)**.
5. Klik **Simpan Resep**.

---

### 4.6 Pencatatan Stok Masuk (Inbound Stock)
*Navigasi: Bilah Samping ➡️ Inventaris ➡️ Stok Masuk (`/inventory/inbound`)*

Setiap kali barang pesanan dari supplier tiba di outlet:
1. Klik **Catat Stok Masuk**.
2. Pilih nama **Pemasok** dan masukkan **Nomor Surat Jalan / Faktur Pembelian**.
3. Pilih bahan baku yang diterima, masukkan jumlah kuantiti yang datang, dan konfirmasi harga beli per unit.
4. Klik **Konfirmasi Penerimaan Barang**.
5. Stok di gudang otomatis bertambah, dan riwayat mutasi stok tercatat lengkap beserta identitas staf penerima.

---

### 4.7 Stok Opname Fisik & Penyesuaian Selisih
*Navigasi: Bilah Samping ➡️ Inventaris ➡️ Stok Opname (`/inventory/opname`)*

Lakukan audit fisik secara berkala (mingguan atau bulanan) untuk mendeteksi kehilangan, kebocoran, atau tumpahan bahan (*waste*):
1. Klik **Mulai Sesi Stok Opname**.
2. Bawa tablet/ponsel ke gudang penyimpanan.
3. Masukkan **Jumlah Hitungan Fisik Aktual** pada kolom hitung.
4. Sistem akan langsung menampilkan selisih (*variance*):
   - Jika fisik lebih sedikit dari sistem: Selisih minus (kebocoran/tumpah).
   - Jika fisik lebih banyak dari sistem: Selisih surplus (kesalahan takaran).
5. Masukkan catatan (contoh: `Susu pecah 1 botol saat restock kulkas`).
6. Klik **Terapkan Penyesuaian Stok (Adjust Stock)**. Stok sistem akan diselaraskan dengan hitungan fisik riil.

---

### 4.8 Inventaris Aset & Peralatan Kedai
*Navigasi: Bilah Samping ➡️ Inventaris ➡️ Aset (`/inventory/assets`)*

Mencatat mesin dan aset modal outlet agar riwayat pemeliharaan terjaga:
1. Klik **Tambah Aset**.
2. Masukkan Nama Aset (contoh: `Mesin Espresso La Marzocco Linea Mini 2-Group`, `Grinder Mahlkönig EK43`, `Tablet Kasir Xiaomi Pad 6`).
3. Masukkan tanggal perolehan, nilai beli aset, masa garansi, dan jadwal servis berkala berikutnya.

---

## 5. Tahap 3: Operasional Awal Shift (Pagi Hari)

Sebelum kasir mulai melayani pelanggan pertama di pagi hari, ada serangkaian langkah persiapan wajib yang dipantau sistem melalui fitur *Shift & Attendance Gate*.

```
[Alur Buka Shift Pagi]
  1. Staf Datang ──> 2. Clock-In di HRIS ──> 3. Buka Sesi Kasir & Setor Modal ──> 4. Tes Koneksi Printer ──> Siap Jualan
```

---

### 5.1 Cek Jadwal Shift Staf
1. Buka menu **HRIS ➡️ Jadwal Kerja (`/hris/schedule`)**.
2. Pastikan staf yang bertugas hari ini sudah dijadwalkan oleh Store Manager pada shift yang sesuai (PAGI, SIANG, MALAM, atau FULL DAY).
3. Staf yang tidak memiliki jadwal resmi akan dicegah membuka transaksi kasir demi mencegah penyalahgunaan shift.

---

### 5.2 Presensi Masuk Kerja (Clock-In)
*Navigasi: HRIS ➡️ Kehadiran (`/hris/attendance`) atau otomatis melalui Pop-up Gate Absensi saat membuka halaman POS*

1. Saat staf tiba di outlet, buka menu kasir POS. Jika staf belum presensi, sistem akan menampilkan modal **Verifikasi Kehadiran Kerja**.
2. Klik tombol **Clock In Sekarang**.
3. Sistem mencatat jam datang:
   - Jika staf datang sebelum jam shift (misal shift jam 08:00 dan datang pukul 07:55): Tercatat **Hadir Tepat Waktu**.
   - Jika datang pukul 08:15: Sistem otomatis menghitung **Terlambat 15 Menit** (terkoneksi ke potongan denda kehadiran di slip gaji).

---

### 5.3 Buka Sesi Kasir & Setor Modal Awal
*Navigasi: Kasir POS (`/pos`) atau Kas Kasir (`/cash-session`)*

1. Sebelum layar pesanan kasir bisa disentuh, sistem mewajibkan kasir membuka sesi kasir melalui pop-up **Buka Sesi Kasir Baru (Open Shift)**.
2. **Pilih Mesin Register:** Pilih nomor kasir (contoh: `Kasir Utama - POS 1`).
3. **Input Modal Kas Awal (Opening Cash):**
   - Hitung uang receh dan modal awal yang ada di laci kas (contoh: `Rp 200.000`).
   - Masukkan nominal tersebut ke formulir modal kas awal.
   - Modal kas awal ini berfungsi sebagai uang kembalian untuk transaksi tunai pertama.
4. Masukkan catatan shift jika ada (contoh: `Shift pagi, cuaca cerah, uang receh 5 ribuan cukup`).
5. Klik **Buka Sesi Kasir**.
6. Bilah status kasir kini menunjukkan status hijau: **Sesi Kasir Aktif**.

---

### 5.4 Pemeriksaan Koneksi Printer Kasir
1. Periksa ikon Bluetooth/Printer di bilah samping navigasi kiri bawah.
2. Jika berstatus abu-abu (*Belum Terhubung*), klik tombol **Hubungkan Printer**.
3. Hubungkan perangkat Bluetooth thermal Anda. Pastikan kertas thermal terpasang dengan posisi gulungan tidak terbalik.
4. Laci kas dan printer kini siap melayani pesanan!

---

## 6. Tahap 4: Transaksi Kasir POS (Point of Sale)

Halaman **Transaksi POS (`/pos`)** adalah pusat aktivitas kasir sepanjang jam operasional.

```
┌──────────────────────────────────────────────────────────────┐
│  Katalog Kategori Menu (Espresso, Non-Coffee, Meals, dll.)   │
├────────────────────────────────┬─────────────────────────────┤
│                                │ KERANJANG BELANJA (CART)    │
│  Grid Kartu Produk             │ • Pilihan Meja / Take-Away  │
│  [Foto] [Nama Menu] [Harga]    │ • Data Pelanggan / Member   │
│  - Tombol Tambah               │ • Daftar Item & Modifier    │
│  - Indikator Sold-Out          │ • Subtotal, Pajak, Servis   │
│                                │ • Tombol Hold, Split, Bayar │
└────────────────────────────────┴─────────────────────────────┘
```

---

### 6.1 Antarmuka Kasir & Navigasi Cepat
- **Pencarian Cepat:** Ketik nama produk pada kolom pencarian di bagian atas atau tekan tombol shortcut keyboard `/` untuk langsung fokus ke kolom pencarian.
- **Filter Kategori:** Klik tab kategori untuk menyaring menu (misal: hanya menampilkan *Pastry*).
- **Indikator Sold Out:** Menu yang bahan bakunya habis di gudang akan otomatis bertanda abu-abu (*Sold Out*) sehingga kasir tidak akan salah menjual menu yang tidak bisa dibuat dapur.

---

### 6.2 Membuat Pesanan Dine-In vs Take-Away
Di bagian atas keranjang belanja kanan:
1. **Pilih Tipe Pesanan:**
   - **Dine-In (Makan di Tempat):** Klik tab *Dine-In*, lalu ketik nomor meja pelanggan (contoh: `Meja 07` atau `Area Outdoor 2`). Nomor meja ini akan tercetak tebal di tiket dapur agar *waiter* tidak salah mengantar pesanan.
   - **Take-Away (Bungkus Pulang):** Klik tab *Take-Away*.
2. **Nama Pelanggan:** Ketik nama panggilan pemesan (contoh: `Kak Amanda`).

---

### 6.3 Memilih Varian, Suhu, Modifier & Transaksi Menu Harga Dinamis
1. **Menu Standar dengan Varian:**
   - Klik kartu produk yang dipesan (contoh: `Caffe Latte`).
   - Jika produk memiliki pilihan, jendela opsi racikan akan terbuka:
     - **Ukuran:** Pilih `Regular` atau `Large (+Rp 5.000)`.
     - **Suhu:** Pilih `Hot` atau `Iced (+Rp 2.000)`.
     - **Tambahan (Modifier):** Centang `Extra Shot (+Rp 6.000)` atau `Oat Milk (+Rp 8.000)`.
     - **Catatan Khusus Barista/Dapur:** Ketik permintaan pelanggan (contoh: `Less sweet, es sedikit`).
   - Klik **Tambahkan ke Keranjang**.
2. **Menu Harga Dinamis (Open Price):**
   - Menu bertanda **⚡ Dinamis** akan langsung memunculkan dialog penentuan harga saat kartunya diklik.
   - **Input Harga:** Masukkan nominal melalui keypad sentuh (0-9, 00, 000, ⌫, C), tombol tambah cepat (+5k, +10k, +25k, +50k), atau numpad keyboard.
   - Sistem memvalidasi agar harga tidak berada di bawah batas minimum (*minPrice*).
   - Kasir tetap dapat menentukan varian ukuran, modifier tambahan, dan mengisi catatan pesanan (misal: *Berat 450 gram*).
   - Klik **Masukkan ke Pesanan**.
   - **Koreksi Harga di Keranjang:** Kasir dapat menekan tombol pensil di samping harga item pada keranjang belanja untuk mengubah harga satuan sebelum menyelesaikan pembayaran.

---

### 6.4 Member Pelanggan & Poin Loyalitas (CRM)
1. Di bagian atas keranjang, klik ikon **Cari / Tambah Pelanggan**.
2. Masukkan nomor WhatsApp pelanggan (contoh: `08123456789`).
   - Jika pelanggan lama: Nama, tier loyalitas (Silver, Gold, Platinum), dan saldo poin langsung terhubung.
   - Jika pelanggan baru: Ketik nama pelanggan dan nomor WA untuk didaftarkan menjadi member baru dalam 3 detik.
3. **Tukar Poin Diskon:** Jika pelanggan memiliki cukup poin reward, klik tombol **Tukar Poin** untuk memotong total tagihan belanja dengan diskon poin reward.

---

### 6.5 Fitur Tahan Nota (Hold Bill), Bagi Tagihan (Split) & Gabung Meja (Merge)

Kedai kopi dan resto sering menghadapi pelanggan yang memesan terlebih dahulu lalu ingin menambah pesanan nanti (*open bill*), atau rombongan yang ingin membayar sendiri-sendiri (*split bill*).

#### A. Simpan Tagihan Tertahan (Hold / Open Bill)
- Jika pelanggan meja 04 ingin membuka nota (belum mau membayar sekarang):
- Klik tombol **Tahan Bill (Hold)** di bawah keranjang.
- Beri label (misal: `Meja 04 - Kak Dimas`).
- Tiket pesanan langsung terkirim ke dapur agar minuman dibuat, sementara keranjang kasir kembali kosong untuk melayani antrean pelanggan berikutnya.
- Untuk membuka kembali nota tertahan: Klik tombol **Open Bills** di bilah atas kasir, lalu pilih nota meja 04.

#### B. Bagi Tagihan (Split Bill)
- Jika satu rombongan meja ingin membayar terpisah:
- Buka pesanan, lalu klik tombol **Split Bill**.
- Pilih item yang ingin dibayar oleh orang pertama (misal: 1 Kopi Susu dan 1 Croissant).
- Selesaikan pembayaran untuk kelompok pertama, lalu lanjutkan sisa tagihan untuk kelompok kedua.

#### C. Gabung Meja / Nota (Merge Bill)
- Jika dua pelanggan yang duduk terpisah memutuskan untuk pindah dan menggabungkan pesanan mereka:
- Klik tombol **Merge Bill**.
- Pilih dua nota aktif yang ingin digabungkan. Seluruh item akan disatukan ke dalam satu invoice final.

---

### 6.6 Proses Pembayaran (Tunai, QRIS Dinamis & Transfer Bank)
Setelah seluruh pesanan selesai diinput, klik tombol oranye besar: **Bayar (Rp ...)**. Modal pembayaran interaktif akan muncul:

```
┌────────────────────────────────────────────────────────┐
│ TOTAL TAGIHAN: Rp 77.000                               │
├────────────────────────────────────────────────────────┤
│ [💵 TUNAI]          [📱 QRIS]         [🏦 TRANSFER]    │
│                                                        │
│ Uang Diterima: [Rp 100.000]                            │
│ Pecahan Cepat: [Pas]  [50k]  [100k]  [200k]            │
│ Kembalian    : Rp 23.000                               │
│                                                        │
│ [             SELESAIKAN PEMBAYARAN                  ] │
└────────────────────────────────────────────────────────┘
```

1. **Metode Tunai:**
   - Klik tombol pecahan cepat (misal `100k`) atau ketik jumlah uang tunai yang diserahkan pelanggan.
   - Sistem secara otomatis menghitung nominal kembalian dengan angka besar yang jelas untuk kasir.
2. **Metode QRIS Dinamis:**
   - Klik tab **QRIS**.
   - Layar akan menampilkan QR code dengan nominal tagihan persis (misal Rp 77.000). Arahkan tablet ke pelanggan atau tunjukkan layar agar pelanggan memindai melalui GoPay, OVO, BCA Mobile, dll.
   - Pelanggan tidak perlu repot mengetikkan angka pembayaran.
3. **Metode Transfer Bank:**
   - Klik tab **Transfer Bank**.
   - Nomor rekening kedai muncul di layar dengan tombol **Salin Nomor Rekening**.
   - Kasir mengecek mutasi masuk, lalu memasukkan nomor referensi transfer (4 digit terakhir).
4. Klik tombol **Selesaikan Pembayaran**.
5. Efek konfeti visual dan audio denting kasir akan berbunyi menandakan transaksi sukses disimpan di database!

---

### 6.7 Cetak Struk Kasir & Buka Laci Kas (Cash Drawer)
1. Segera setelah pembayaran lunas, printer thermal akan mencetak struk secara otomatis (jika opsi cetak otomatis aktif).
2. Laci kas (*cash drawer*) akan terbuka otomatis untuk memudahkan kasir menaruh uang dan mengambil uang kembalian.
3. Di layar akan muncul pratinjau struk digital. Kasir memiliki opsi:
   - **Cetak Ulang Struk:** Jika kertas macet atau pelanggan meminta salinan ekstra.
   - **Kirim Struk WhatsApp:** Mengirimkan nota struk elektronik tanpa kertas langsung ke nomor WhatsApp pelanggan.
   - **Selesai / Transaksi Baru:** Klik untuk membersihkan keranjang dan menyambut pelanggan berikutnya.

---

## 7. Tahap 5: Alur Dapur & Bar Real-Time (KDS & BDS)

Komazi POS dilengkapi dengan sistem tampilan pesanan real-time berbasis WebSocket (**Kitchen Display System & Barista Display System**). Staf dapur tidak lagi membutuhkan sobekan kertas bon yang rawan tercecer atau terkena air/minyak.

---

### 7.1 Pemisahan Layar Barista (BDS) & Kitchen (KDS)
Sistem secara cerdas membedakan jenis stasiun produk:
- **Barista Display (BDS - `/kds` stasiun Bar):** Hanya menampilkan tiket minuman (*Espresso, Latte, Mocktail, Manual Brew*).
- **Kitchen Display (KDS - `/kds` stasiun Kitchen):** Hanya menampilkan tiket makanan (*Pasta, Ricebowl, Snack, Toast*).
- **Manajer / Owner:** Dapat memilih opsi **Semua Stasiun (All Stations)** untuk memantau ritme kedua divisi secara bersamaan.

---

### 7.2 Siklus Status Tiket (Menunggu → Dimasak → Siap → Disajikan)
Setiap tiket pesanan di layar KDS memiliki penanda warna status:

```
[MENUNGGU] ────────► [DIMASAK / SEDANG DIBUAT] ────────► [SIAP SAJI] ────────► [DISAJIKAN]
(Tiket Kuning)          (Tiket Biru Berjalan)              (Tiket Hijau)          (Tiket Selesai)
Pesanan baru masuk      Barista/Koki menekan tombol        Pesanan selesai dibuat Waiter mengantar
dari meja kasir         "Mulai Proses"                     Lonceng panggil bunyi  pesanan ke meja
```

1. **Timer Berjalan (Live Duration):**
   - Setiap kartu tiket memiliki indikator menit berjalan sejak pesanan dibuat.
   - Jika tiket belum selesai dalam waktu $> 15$ menit, warna kartu berubah menjadi **Merah Berkedip** untuk memberi peringatan visual bahwa pelanggan menunggu terlalu lama.

---

### 7.3 Fitur Bumping Tiket & Notifikasi Suara
- **Audio Chime:** Setiap ada transaksi baru yang dibayar di kasir, browser stasiun dapur akan membunyikan bel *chime* khas restoran agar barista langsung waspada ada pesanan baru tanpa harus terus menatap layar.
- **Bump per Item:** Jika dalam satu tiket ada 3 minuman, barista dapat mencentang satu per satu minuman yang sudah selesai diracik.
- **Bump Seluruh Tiket:** Tekan tombol **Selesai / Sajikan** untuk menyelesaikan tiket dan menghilangkannya dari daftar antrean aktif.
- **Re-Queue (Batal Selesai):** Jika ada kekeliruan menekan tiket, staf dapat membuka tab *Riwayat Selesai* dan mengembalikan tiket ke antrean aktif.

---

### 7.4 Mode Monitor Layar TV (Standalone Screen)
*Navigasi: `/kds-screen`*
- Mode ini khusus dirancang untuk browser di Smart TV Android atau tablet gantung dapur.
- Bebas bilah navigasi (sidebar tersembunyi), font ekstra besar, dan tampilan kontras tinggi (*high contrast dark mode*) yang mudah terbaca dari jarak 3-5 meter di tengah kesibukan dapur.

---

## 8. Tahap 6: Operasional Khusus Selama Shift

Selama jam operasional berlangsung, ada beberapa aktivitas non-penjualan yang memerlukan pencatatan rapi di kasir.

---

### 8.1 Arus Kas Keluar & Masuk Kasir (Cash In / Cash Out)
*Navigasi: Kas Kasir (`/cash-drawer`)*

Jangan pernah mengambil uang dari laci kasir tanpa mencatatnya di sistem, karena akan menyebabkan selisih uang saat tutup toko.
1. Klik tombol **Kas Keluar (Cash Out)**:
   - Gunakan jika kasir mengeluarkan uang untuk keperluan darurat kedai (contoh: membeli es batu kristal tambahan Rp 30.000, membeli air galon Rp 20.000, atau bensin operasional).
   - Masukkan nominal uang dan tulis alasan pengeluaran secara jelas.
2. Klik tombol **Kas Masuk (Cash In)**:
   - Gunakan jika Store Manager memasukkan uang receh tambahan untuk kembalian kasir.
3. Seluruh pergerakan uang akan langsung memengaruhi perhitungan kas harapan (*expected cash*) secara otomatis.

---

### 8.2 Pembatalan Transaksi (Void)
Jika pesanan pelanggan harus dibatalkan setelah nota tercetak (misal pelanggan membatalkan pesanan karena terburu-buru pergi):
1. Buka menu **Riwayat Pesanan (`/orders`)**.
2. Cari nomor invoice atau nama pelanggan, lalu klik tombol **Batalkan Transaksi (Void)**.
3. Kasir wajib memasukkan **Alasan Pembatalan** dan **PIN Otorisasi Supervisor (Manager/Owner)**.
4. Setelah disetujui:
   - Status pesanan berubah menjadi `VOID`.
   - Tiket di layar dapur otomatis dicoret dan bertanda merah dibatalkan.
   - Bahan baku yang sempat terpotong akan dikembalikan otomatis ke stok gudang.
   - Notifikasi pembatalan terkirim ke Telegram Owner untuk mencegah kecurangan kasir.

---

### 8.3 Pengembalian Dana & Retur Transaksi (Refund)
*Navigasi: Bilah Samping ➡️ Refund (`/refunds`)*

Jika pelanggan meminta pengembalian uang (misal makanan salah racik atau tumpah):
1. Klik **Proses Refund Baru**.
2. Masukkan nomor invoice yang bersangkutan.
3. Pilih apakah refund dilakukan **Penuh (Full Refund)** atau **Sebagian (Partial Refund)**.
4. Masukkan alasan retur barang dan minta Manager memasukkan PIN supervisor.
5. Uang dikembalikan kepada pelanggan, dan sistem kasir memotong angka pendapatan tunai harian.

---

## 9. Tahap 7: Operasional Akhir Shift (Malam Hari / Tutup Toko)

Tutup shift adalah proses paling penting untuk memastikan uang hasil penjualan hari itu sesuai dan tidak ada kebocoran dana.

```
[Alur Tutup Shift Malam]
  1. Hitung Uang Fisik ──> 2. Input Cash Count ──> 3. Sistem Cocokkan Selisih ──> 4. Cetak Struk ──> 5. Clock-Out
```

---

### 9.1 Penghitungan Kas Fisik Aktual (Blind Cash Count)
1. Kasir membuka laci uang dan menghitung seluruh uang tunai yang ada secara manual:
   - Pisahkan uang modal awal dan uang hasil penjualan.
   - Hitung lembaran uang Rp 100.000, Rp 50.000, Rp 20.000, dst.
2. Catat total nominal uang tunai yang ada di depan mata Anda.

---

### 9.2 Rekonsiliasi Kas, Deteksi Selisih & Tutup Shift
*Navigasi: Sesi Kas Terbuka (`/cash-session`) ➡️ Klik tombol "Tutup Sesi Kasir"*

1. Masukkan angka total uang fisik pada kolom **Kas Fisik Aktual (Closing Cash)**.
2. Sistem akan membandingkannya dengan **Kas Harapan Sistem (Expected Cash)**:
   $$\text{Kas Harapan} = \text{Modal Awal} + \text{Penjualan Tunai} + \text{Kas Masuk} - \text{Kas Keluar} - \text{Refund Tunai}$$
3. Hasil Rekonsiliasi Kas:
   - **SEIMBANG (MATCH - Hijau):** Uang fisik pas sesuai dengan perhitungan sistem.
   - **SURPLUS (LEBIH - Biru):** Uang fisik lebih banyak dari pencatatan sistem.
   - **DEFISIT (KURANG - Merah):** Uang fisik kurang dari pencatatan sistem (ada potensi salah kembalian atau kehilangan).
4. Masukkan catatan penjelasan (misal: `Selisih pas, uang tunai disimpan di brankas manager`).
5. Klik **Konfirmasi Tutup Sesi Kasir**.

---

### 9.3 Struk Laporan Tutup Shift & Notifikasi Telegram
1. Printer kasir otomatis mencetak **Struk Ringkasan Tutup Shift (End of Shift Receipt)** yang berisi:
   - Nama kasir bertugas & jam buka/tutup.
   - Modal kas awal.
   - Total omzet per metode bayar (Tunai, QRIS, Transfer).
   - Rekap pengeluaran kas kecil (Cash Out).
   - Nilai kas fisik aktual dan angka selisih (*Variance*).
2. Laporan tutup shift ini otomatis dikirimkan ke akun Telegram Owner dalam hitungan detik.

---

### 9.4 Presensi Pulang (Clock-Out)
1. Buka menu **HRIS ➡️ Kehadiran (`/hris/attendance`)**.
2. Klik tombol **Clock Out**.
3. Sistem menghitung total jam kerja staf hari itu (*work duration*) dan mencatat kepulangan staf. Operasional hari itu selesai!

---

## 10. Tahap 8: Laporan Keuangan, Laba Rugi & Analisis Bisnis

Store Manager dan Owner dapat memantau kesehatan bisnis melalui menu **Laporan (`/reports`)**.

---

### 10.1 Laporan Penjualan, Jam Sibuk & Metode Bayar
*Navigasi: `/reports/sales`*
- **Kartu Metrik KPI:** Total Omzet Penjualan Bersih, Total Tiket Transaksi, Rata-rata Nilai Belanja (*Average Basket Size*), dan Total Diskon.
- **Grafik Tren Penjualan:** Grafik area yang memperlihatkan naik-turunnya omzet per jam atau per hari.
- **Analisis Jam Sibuk (Peak Hours):** Menampilkan grafik jam berapa kedai paling ramai pelanggan (misal jam 14:00 - 17:00 dan jam 19:00 - 21:00), sangat berguna untuk mengatur jumlah barista yang bertugas.
- **Komposisi Metode Bayar:** Diagram lingkaran persentase pembayaran (misal 55% QRIS, 35% Tunai, 10% Transfer).

---

### 10.2 Laporan HPP (COGS) & Margin Laba Kotor
*Navigasi: `/reports/cogs`*
- Menghitung nilai modal bahan baku yang keluar dari resep menu terjual.
- **Top Product Margins:** Menampilkan menu mana yang memberikan keuntungan kotor terbesar dan menu mana yang marginnya tipis sehingga perlu dievaluasi harga jual atau porsi resepnya.

---

### 10.3 Laporan Laba Rugi Bersih (P&L)
*Navigasi: `/reports/profit-loss`*
- Menghitung ringkasan:
  $$\text{Omzet Kotor} - \text{Diskon} - \text{HPP Bahan Baku} - \text{Beban Operasional Kas Kecil} = \text{Laba Kotor / Operasional}$$
- Memberikan gambaran nyata apakah kedai mencetak keuntungan riil pada periode tersebut.

---

### 10.4 Ekspor Laporan ke Excel (.xlsx) & CSV
1. Klik tombol **Ekspor Laporan** di pojok kanan atas halaman laporan.
2. Pilih format:
   - **Microsoft Excel (.xlsx):** Format file Excel rapi dengan header warna Komazi, auto-width kolom, dan formula nominal rupiah.
   - **File CSV (.csv):** Format tabel dengan pemisah titik-koma (`;`) dan encoding UTF-8 BOM yang langsung terbuka rapi dalam kolom A-Z di Microsoft Excel Windows tanpa berantakan.

---

### 10.5 Asisten Cerdas Komazi AI Sales Intelligence
Di pojok bawah laporan terdapat fitur konsultasi AI. Owner dapat menanyakan pertanyaan analitis seperti:
- *"Menu apa yang penjualannya paling lesu di hari kerja dan butuh promo bundling?"*
- *"Berapa estimasi kebutuhan biji kopi espresso untuk akhir pekan ini?"*
- *"Bagaimana perbandingan omzet minggu ini dibanding minggu lalu?"*
- Sistem AI Komazi akan menganalisis database transaksi Anda dan memberikan saran bisnis strategis.

---

## 11. Tahap 9: Siklus HRIS, Cuti, Lembur & Penggajian (Payroll)

Fitur HRIS terintegrasi langsung dengan absensi dan sistem kasir POS untuk mengotomatisasi perhitungan gaji karyawan kedai.

```
[Siklus Payroll Bulanan]
  Data Karyawan & Gaji ──> Presensi Riil Staf ──> Cuti & Lembur Disetujui ──> Kalkulasi Payroll ──> Finalisasi & Slip Gaji
```

---

### 11.1 Pengaturan Struktur Gaji Karyawan
*Navigasi: HRIS ➡️ Staf & Karyawan (`/hris/staff`)*

Saat mendaftarkan staf baru atau mengubah upah:
1. Klik **Tambah Karyawan**.
2. Masukkan data identitas, departemen, dan peran POS.
3. Atur 3 pilar finansial upah:
   - **Gaji Pokok Bulanan (*baseSalary*):** Gaji dasar (contoh: `Rp 2.500.000`).
   - **Uang Kehadiran Harian (*dailyAllowance*):** Tunjangan makan/transport per hari hadir (contoh: `Rp 25.000/hari`). Jika staf tidak hadir, tunjangan tidak keluar.
   - **Tarif Lembur per Jam (*hourlyOvertimeRate*):** Upah lembur per jam yang disetujui (contoh: `Rp 20.000/jam`).
4. Klik **Simpan**.

---

### 11.2 Pengajuan & Persetujuan Cuti Staf
*Navigasi: HRIS ➡️ Pengajuan Cuti (`/hris/leaves`)*

1. Staf memilih jenis izin (Cuti Tahunan, Sakit dengan Surat Dokter, atau Izin Pribadi).
2. Tentukan tanggal mulai, tanggal selesai, dan alasan cuti.
3. Store Manager atau Owner meninjau pengajuan cuti:
   - Klik **Setujui (Approve)** atau **Tolak (Reject)**.
   - Staf yang cuti sakit/tahunan yang disetujui tidak akan terkena penalti absensi.

---

### 11.3 Pengajuan & Verifikasi Jam Lembur
*Navigasi: HRIS ➡️ Kehadiran ➡️ Tab Lembur*

1. Jika barista atau staf dapur diminta lembur saat kedai ramai di akhir pekan:
2. Staf atau Manager mengajukan lembur dengan mengisi tanggal, durasi lembur (contoh: `2.5 jam`), dan alasan (contoh: `Restock bahan baku & deep cleaning mesin espresso`).
3. Owner/Manager menyetujui lembur. Sistem otomatis menghitung:
   $$\text{Upah Lembur} = 2.5 \text{ jam} \times \text{Rp } 20.000 = \text{Rp } 50.000$$

---

### 11.4 Koreksi Absensi (Maker-Checker)
Jika staf lupa menekan tombol *Clock-In* karena langsung terburu-buru melayani antrean:
1. Staf membuka menu koreksi absensi dan mengajukan jam datang sebenarnya.
2. Pengajuan ini wajib disetujui oleh Store Manager atau Owner.
3. *Sistem menerapkan prinsip Maker-Checker: Manager tidak dapat menyetujui pengajuan absensi miliknya sendiri.*

---

### 11.5 Kalkulasi Gaji Otomatis, Finalisasi & Terbit Slip Gaji
*Navigasi: HRIS ➡️ Payroll & Gaji (`/hris/payroll`)*

Di akhir bulan, Owner memproses gaji tim:
1. **Buka Periode Payroll Baru:** Masukkan nama periode (contoh: `Oktober 2026`), tanggal awal (01/10/2026), dan tanggal akhir (31/10/2026).
2. **Kalkulasi Otomatis (Calculate Payroll):** Klik tombol **Hitung Gaji Otomatis**. Sistem menarik seluruh data kehadiran riil:
   $$\text{Gaji Bersih} = \text{Gaji Pokok} + (\text{Hari Hadir} \times \text{Uang Harian}) + \text{Upah Lembur} + \text{Bonus} - \text{Potongan Terlambat}$$
3. **Review Total Pengeluaran Kedai (Total Payout):** Owner memeriksa slip gaji draft tiap staf. Jika ada bonus prestasi barista, tambahkan pada kolom bonus.
4. **Finalisasi (Finalize):** Kunci data gaji agar tidak bisa diubah lagi.
5. **Publikasikan Slip Gaji (Publish Payslips):**
   - Klik tombol **Publikasikan**.
   - Setiap staf dapat langsung membuka menu HRIS di akun masing-masing untuk melihat rincian dan mengunduh **Slip Gaji Digital Pribadi**.

---

## 12. Tahap 10: Pengelolaan Website Landing Page via Studio CMS

Komazi POS dilengkapi dengan **Studio CMS Terintegrasi (`/cms`)** untuk mengelola website publik kedai kopi Anda tanpa perlu menyewa web developer luar.

```
[Navigasi Studio CMS]
  ├── Beranda CMS: Status tayang website & metrik profil
  ├── Hero Banner: Judul utama, slogan, foto jagoan & tombol kontak
  ├── Menu Spotlight: Menampilkan produk terlaris di halaman depan
  ├── Promosi: Banner diskon, promo weekend, & event live music
  ├── Fasilitas: WiFi, colokan listrik, AC, musholla
  ├── Testimoni: Ulasan pelanggan & penilaian bintang 5
  ├── Outlet & Kontak: Alamat, jam buka Senin-Minggu, peta Google Maps & WhatsApp
  └── SEO: Judul Google & deskripsi pencarian
```

---

### 12.1 Pengaturan Hero Banner & Cerita Brand
*Navigasi: Studio CMS ➡️ Hero Banner (`/cms/hero`)*
1. **Headline Utama:** Kalimat pemikat pengunjung web (contoh: `Kopi Spesialisasi & Suasana Nyaman di Pusat Kota Medan`).
2. **Subheadline:** Penjelasan konsep kedai dan ruang kerja kolaboratif.
3. **Foto Banner Jagoan:** Unggah foto interior kedai atau cangkir kopi terbaik Anda.
4. **Tombol Call to Action (CTA):** Tentukan tujuan klik pengunjung (misal mengarahkan ke daftar menu atau chat WhatsApp reservasi).

---

### 12.2 Menampilkan Menu Spotlight di Beranda
*Navigasi: Studio CMS ➡️ Menu Unggulan (`/cms/menu-spotlight`)*
1. Klik **Tambah Menu Sorotan**.
2. Pilih produk dari katalog POS (contoh: `Signature Aren Latte`, `Croissant Almond`).
3. Beri lencana badge khusus (contoh: `Best Seller`, `Chef's Pick`, atau `New Arrival`). Menu ini akan terpampang megah di halaman depan website.

---

### 12.3 Banner Promosi & Event Spesial
*Navigasi: Studio CMS ➡️ Promosi (`/cms/promos`)*
1. Tambahkan promo aktif (contoh: `Beli 2 Kopi Gratis 1 Donat - Tiap Jumat`, `Live Music Acoustic Saturday Night`).
2. Pasang tanggal masa berlaku promo agar banner otomatis turun saat promo berakhir.

---

### 12.4 Fasilitas Kedai, Jam Buka & Lokasi Google Maps
*Navigasi: Studio CMS ➡️ Fasilitas (`/cms/facilities`) dan Informasi Outlet (`/cms/outlet`)*
1. **Fasilitas:** Tambahkan ikon fasilitas (WiFi 100 Mbps, Colokan di Setiap Meja, Ruang AC Bebas Rokok, Musholla, Parkir Luas).
2. **Jam Operasional:** Tulis jam buka Senin-Jumat dan Sabtu-Minggu.
3. **Peta Google Maps:** Tempelkan link Google Maps dan kode semat (*embed*) agar calon pengunjung bisa langsung membuka rute navigasi Google Maps dari ponsel mereka.

---

### 12.5 Ulasan Pelanggan & Optimasi SEO
*Navigasi: Studio CMS ➡️ Testimoni (`/cms/testimonials`) dan SEO (`/cms/seo`)*
1. Tampilkan ulasan positif pelanggan setia beserta foto profil dan rating bintang 5.
2. Di tab **SEO**, masukkan judul meta dan deskripsi penelusuran agar kedai kopi Anda mudah ditemukan di halaman pertama pencarian Google.

---

## 13. Tahap 11: Integrasi Asisten Bot Telegram

Bot Telegram resmi Komazi POS memungkinkan Owner dan tim memantau operasional outlet langsung dari aplikasi Telegram ponsel.

---

### 13.1 Menautkan Akun Telegram Staf
1. Buka aplikasi Telegram di ponsel Anda, lalu cari akun bot resmi Komazi POS Anda.
2. Tekan tombol `/start`.
3. Buka menu **Profil Saya** di aplikasi web POS Komazi, lalu klik tombol **Tautkan Akun Telegram**.
4. Dapatkan kode PIN unik 6 digit (contoh: `KMZ882`).
5. Kirimkan pesan di Telegram bot: `/link KMZ882`.
6. Bot akan membalas: *"Selamat, akun Telegram Anda berhasil terhubung dengan akun Kasir Komazi!"*. Hak akses bot akan otomatis mengikuti role akun Anda.

---

### 13.2 Daftar Perintah Cepat Telegram Bot

| Perintah Bot | Peran yang Berhak | Fungsi & Tindakan |
|---|---|---|
| `/today` | Owner, Manager | Menampilkan total omzet penjualan hari ini, jumlah tiket, dan produk terlaris |
| `/stock` | Owner, Manager | Memeriksa daftar bahan baku gudang yang sudah menipis (*low stock*) |
| `/shift` | Semua Staf | Memeriksa status sesi kasir yang sedang aktif dan kasir yang bertugas |
| `/voids` | Owner, Manager | Melihat riwayat pembatalan transaksi terakhir hari ini |
| `/attendance` | Semua Staf | Mengecek status presensi kehadiran kerja staf hari ini |
| `/help` | Semua Staf | Menampilkan seluruh bantuan perintah bot |

---

## 14. Pemecahan Masalah & Pertanyaan Umum (Troubleshooting)

### 1. Printer Bluetooth Thermal Tidak Terdeteksi di Browser
- **Penyebab:** Bluetooth di laptop/tablet belum menyala, atau printer sedang terhubung (*paired*) ke perangkat lain.
- **Solusi:**
  1. Matikan printer thermal selama 5 detik, lalu nyalakan kembali.
  2. Pastikan lampu indikator Bluetooth di printer berkedip (tanda siap pairing).
  3. Buka browser Chrome, buka alamat `chrome://bluetooth-internals` untuk memastikan izin Bluetooth aktif.
  4. Klik ikon Bluetooth di bilah samping Komazi POS dan pilih printer Anda kembali.

---

### 2. Layar Dapur (KDS) Tidak Memperbarui Pesanan Secara Otomatis
- **Penyebab:** Koneksi WebSocket Socket.io terputus akibat fluktuasi jaringan WiFi.
- **Solusi:**
  1. Perhatikan indikator di pojok kanan atas KDS: jika bertanda merah (*Terputus*), klik tombol **Refresh Antrean**.
  2. Pastikan server backend (`PORT 4000`) tetap berjalan normal.
  3. Muat ulang halaman browser (*Ctrl + F5*).

---

### 3. Layar Kasir Terkunci Pop-up "Sesi Kasir Belum Dibuka"
- **Penyebab:** Kasir mencoba menekan menu belanja sebelum menyetor modal kas awal.
- **Solusi:** Ini adalah fitur pengaman wajib. Kasir harus mengisi jumlah modal kas awal (Opening Cash) terlebih dahulu pada pop-up yang muncul agar setiap rupiah uang kembalian dapat terlacak dengan benar.

---

### 4. Terjadi Selisih Kas (Defisit / Kurang) Saat Tutup Shift
- **Penyebab:** Kasir lupa mencatat pengeluaran kas kecil (Cash Out), salah memberikan uang kembalian ke pelanggan, atau ada transaksi tunai yang tidak diinput.
- **Solusi:**
  1. Buka menu **Kas Kasir (`/cash-drawer`)**.
  2. Periksa daftar *Mutasi Kas Masuk / Keluar* hari itu. Apakah ada pembelian es batu atau galon yang belum dicatat? Jika ada, input sekarang.
  3. Periksa menu **Riwayat Pesanan (`/orders`)**, pastikan tidak ada transaksi yang salah memilih metode bayar (misal dibayar QRIS tetapi kasir memilih Tunai).

---

### 5. Staf Lupa Kata Sandi Akun
- **Solusi:**
  1. Minta **Owner** login ke akunnya.
  2. Masuk ke menu **Pengaturan ➡️ Keamanan & PIN (`/settings?tab=security`)**.
  3. Cari nama staf yang lupa password pada daftar pengguna.
  4. Klik ikon **Kunci (Reset Password)**, ketik kata sandi baru untuk staf tersebut, lalu klik Simpan.

---

### 6. Tabel Pintasan Keyboard POS (Shortcuts Cheat Sheet)

Untuk kasir profesional yang ingin bertransaksi dengan kecepatan tinggi:

| Tombol Pintasan | Fungsi Aksi Kasir |
|---|---|
| `/` | Langsung fokus ke kolom pencarian produk |
| `Ctrl + B` atau `Cmd + B` | Buka / tutup bilah samping (*Toggle Sidebar*) |
| `Esc` | Menutup modal atau pop-up yang sedang terbuka |
| `Enter` (pada modal bayar) | Konfirmasi dan selesaikan pembayaran tunai uang pas |

---

<div align="center">
  <sub>Buku Panduan Resmi Komazi POS & Workspace — Versi 2.0</sub><br />
  <sub>Dirancang untuk efisiensi, akurasi finansial, dan pengalaman pelanggan terbaik ☕</sub>
</div>
