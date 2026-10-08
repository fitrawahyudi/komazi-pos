# KOMAZI POS — Coffee & Workspace (Frontend)

Frontend Web Application Point of Sale (POS) & Workspace Management System untuk **Komazi Coffee & Workspace**, dibangun sesuai spesifikasi teknis dan desain pada [`prd.md`](../prd.md).

---

## ☕ Fitur Utama yang Telah Diimplementasikan

### 1. Transaksi Kasir (POS)
- **Kategori & Menu Grid**: Filter kategori (Semua, Kopi, Non-Kopi, Makanan, Snack) dengan live search (Shortcut `F2`).
- **Modal Varian & Modifiers**: Pemilihan ukuran (Regular/Large), suhu (Hot/Iced), serta add-on (Extra Shot, Oat Milk, Topping) dan catatan khusus barista/kitchen.
- **Keranjang Pintar**:
  - Tipe pesanan: **Dine-in** (dengan input nomor meja) & **Take-away**.
  - Kontrol kuantitas (`+` / `-`), edit catatan item, dan hapus item.
  - Perhitungan otomatis: Subtotal, Diskon (Nominal / Persen), Service Charge (5%), PB1/PPN Resto (10%), serta Pembulatan ke Rp 100 terdekat.
  - **Hold Bill / Open Bills**: Fitur simpan pesanan tertahan dan lanjutkan nanti.
- **Multi-Metode Pembayaran (Shortcut `F9`)**:
  - **Tunai (Cash)**: Tombol uang pas, pecahan cepat (50k, 100k, 200k, 500k), input kustom, serta kalkulasi uang kembalian otomatis.
  - **QRIS Statis**: Simulasi QR code dinamis NMID dengan panduan scan e-wallet / mobile banking.
  - **Transfer Bank**: Nomor rekening BCA / Mandiri dengan tombol salin 1-klik dan input nomor referensi.
  - **Efek Konfeti Perayaan**: Animasi visual saat transaksi pembayaran berhasil diselesaikan.
- **Preview & Cetak Struk (Thermal Receipt)**:
  - Tampilan struk kertas thermal format 80mm/58mm autentik.
  - Nomor invoice sequential harian (`KMZ-YYYYMMDD-NNNN`).
  - Info kasir, rincian produk, pajak & service charge, kembalian, info WiFi tamu, dan footer promosi.
  - Integrasi tombol cetak langsung browser (`window.print()`).

### 2. Modul Workspace (Coworking Space)
- **Live Status Grid**: Meja Komunal, Focus Pod, dan Meeting Room dengan indikator visual:
  - 🟢 **Tersedia (Available)**
  - 🔴 **Terisi (Occupied / Active)**
  - 🟡 **Segera Berakhir (< 15 Menit)**
  - 🚨 **Overtime (Melebihi durasi paket)**
- **Real-time Countdown Timer**: Timer berjalan real-time dengan progress bar durasi.
- **Check-In Pelanggan**: Input nama pelanggan, no. WhatsApp, serta paket durasi (1 Jam, 3 Jam Flow, Full Day Pass, Meeting Room).
- **Check-Out Pintar**:
  - Kalkulasi otomatis durasi aktual dan biaya overtime per jam.
  - **Gabung ke Kasir POS**: Mengintegrasikan tagihan workspace ke keranjang kasir dalam 1 invoice struk pembayaran yang sama dengan pesanan F&B (sesuai FR-34).
  - Opsi Bayar Langsung hanya untuk tagihan workspace.

### 3. Riwayat Transaksi (Orders) & Audit
- Tabel pencatatan riwayat seluruh transaksi penjualan dengan filter status (**PAID**, **VOIDED**, **REFUNDED**).
- **Cetak Ulang Struk**: Cetak kembali struk untuk transaksi lama kapan saja.
- **Void Transaksi**: Membatalkan transaksi dengan alasan wajib dan otorisasi PIN Manager (Default PIN demo: `1234`).
- **Refund Transaksi**: Pengembalian dana transaksi dengan pencatatan nominal refund dan alasan.

### 4. Manajemen Shift Kasir
- **Buka Shift**: Input modal kas awal (uang kembalian) saat membuka laci kasir.
- **Tutup Shift**:
  - Perhitungan otomatis kas yang seharusnya (*Opening Cash + Penjualan Tunai*).
  - Input kas fisik aktual di laci.
  - Deteksi dan kalkulasi otomatis selisih kas (*Surplus / Defisit*).
  - Ringkasan penerimaan per metode pembayaran.

### 5. Manajemen Menu & Kategori (Manager / Owner)
- CRUD Kategori dan Menu Produk (nama, SKU, kategori, harga dasar, URL foto, deskripsi).
- Toggle switch cepat ketersediaan stok produk (**Tandai Habis / Tersedia**).

### 6. Inventori & Stok Bahan Baku (Manager / Owner)
- Monitoring stok biji kopi, fresh milk, oat milk, gula aren, cup lid, sirup, dll.
- Indikator peringatan dini stok menipis di bawah batas minimum (*Low Stock Alert*).
- Pencatatan log mutasi: **Stok Masuk (Pembelian)**, **Stock Opname (Penyesuaian Fisik)**, dan **Pencatatan Waste**.

### 7. Laporan & Dashboard Analitik (Manager / Owner)
- Kartu KPI: Total Omzet, Jumlah Transaksi, Rata-rata Nilai Order (AOV), Omzet Workspace.
- Grafik interaktif Recharts:
  - Kurva Area Chart Omzet Penjualan per Jam (*Coral accent*).
  - Donut Chart komposisi metode pembayaran (*QRIS, Tunai, Transfer*).
  - Bar Chart 6 Menu Terlaris (*Teal accent*).
- **Export Data ke CSV** (FR-63).

### 8. Pengaturan Outlet (Owner)
- Konfigurasi profil outlet (Nama toko, Alamat, No WhatsApp).
- Pengaturan WiFi tamu (SSID & Password) dan pesan footer struk kasir.
- Pengaturan persentase Pajak PB1/PPN (%) dan Service Charge (%).
- Manajemen pengguna & hak akses role (*Owner, Manager, Cashier*).

---

## 🎨 Design System Komazi

Sesuai panduan visual pada PRD Bagian 9:
- **Tema**: Modern Dark Mode
- **Latar Utama (`komazi-black`)**: `#0A0A0A`
- **Surface Kartu (`komazi-surface`)**: `#141414`
- **Surface Input/Hover (`komazi-surface-2`)**: `#1E1E1E`
- **Border (`komazi-border`)**: `#2A2A2A`
- **Warna Primer Coral (`komazi-coral`)**: `#FF5A4D` (Hover: `#E0453A`, Soft: `rgba(255, 90, 77, 0.15)`)
- **Warna Sekunder Teal (`komazi-teal`)**: `#1F6F6B` (Light: `#2FA39C`)
- **Tipografi**: Poppins (Headings/Brand) & Inter (Body/Angka tabular)

---

## 👤 Akun Demo & Role Switcher

Untuk mempermudah pengujian seluruh fitur dan hak akses tanpa perlu login berulang kali, telah disediakan:
1. **Dropdown Role Switcher di Navbar**: Dapat berpindah instan antara **Kasir**, **Manager**, dan **Owner**.
2. **Akun Login Bawaan**:
   - **Kasir**: `kasir` / `password123` (Hak akses: POS Kasir, Workspace, Shift)
   - **Manager**: `manager` / `password123` (Hak akses: Semua fitur kasir + Menu, Stok, Laporan, Otorisasi Void/Refund)
   - **Owner**: `owner` / `password123` (Hak akses penuh termasuk Pengaturan & Akun Staf)

---

## 🚀 Cara Menjalankan Project

Masuk ke folder `frontend/` dan jalankan:

```bash
# 1. Masuk ke folder frontend
cd frontend

# 2. Install dependensi (jika belum)
npm install

# 3. Jalankan development server
npm run dev
```

Aplikasi dapat dibuka di browser pada:
👉 **`http://localhost:5173`**
