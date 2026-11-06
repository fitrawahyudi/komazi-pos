# Task Breakdown Checklist: Fitur QR Order Meja (Customer Self-Order)

- [x] **Task 1: Backend Setting & Konfigurasi Feature Flag QR Order**
  - **Description:** Menyediakan persistensi konfigurasi QR Order (status saklar aktif/nonaktif, nomor rekening bank, nama pemilik rekening, dan gambar QRIS statis) di tabel `Setting`, serta menyediakan endpoint publik untuk diakses browser pelanggan dan endpoint manajemen untuk kasir/owner.
  - **Acceptance criteria:**
    - [x] Nilai default `qrOrderEnabled` adalah `'false'` (Non-Aktif untuk masa percobaan).
    - [x] `GET /api/public/qr-order/config` mengembalikan `{ enabled, bankName, accountNo, accountHolder, qrisUrl }` tanpa butuh token auth.
    - [x] `PUT /api/settings/qr-order` (Auth: Owner/Manager) memperbarui status saklar dan detail pembayaran kedai.
  - **Verification:**
    - [x] API test script verifikasi baca/tulis konfigurasi sukses.
  - **Dependencies:** None
  - **Files likely touched:**
    - `backend/src/controllers/qrOrderController.js`
    - `backend/src/routes/settingRoutes.js`
    - `backend/src/routes/publicRoutes.js`
  - **Estimated scope:** S (2-3 files)

- [x] **Task 2: Backend API Validasi Real-time Stok & Checkout QR Order Meja**
  - **Description:** Membangun endpoint validasi stok sebelum pembayaran dan endpoint checkout pesanan meja lengkap dengan penerimaan upload foto bukti transfer, pencatatan order berstatus `PENDING_PAYMENT`, serta controller aksi kasir untuk konfirmasi/tolak pembayaran.
  - **Acceptance criteria:**
    - [x] `POST /api/public/qr-order/validate-cart`: memvalidasi ketersediaan menu dan stok bahan baku terkait; mengembalikan `{ valid: true }` atau daftar item yang habis/kurang.
    - [x] `POST /api/public/qr-order/checkout`: menerima data order (`tableNo`, `customerName`, `items`, `paymentMethod`, file `proof`), membuat pesanan berstatus `PENDING_PAYMENT` tanpa memotong stok bahan terlebih dahulu.
    - [x] `POST /api/orders/:id/confirm-qr-payment`: kasir mengonfirmasi pesanan meja lunas -> status berubah `PAID`, stok bahan dipotong via `deltaInventoryService`, payment dicatat, dan event disiarkan ke KDS barista & dapur.
    - [x] `POST /api/orders/:id/reject-qr-payment`: kasir menolak pesanan meja yang bukti transfernya tidak valid -> status menjadi `VOIDED`.
  - **Verification:**
    - [x] Test script verifikasi checkout dan konfirmasi/tolak pembayaran lulus.
  - **Dependencies:** Task 1
  - **Files likely touched:**
    - `backend/src/controllers/qrOrderController.js`
    - `backend/src/routes/publicRoutes.js`
    - `backend/src/routes/orderRoutes.js`
    - `backend/src/services/paymentProofService.js`
  - **Estimated scope:** M (3-4 files)

## Checkpoint 1: Backend Configuration & Order API Ready
- [x] Endpoint publik konfigurasi, validasi stok, dan checkout order meja teruji via script test.
- [x] Aksi konfirmasi kasir berhasil memotong stok bahan dan mencatat payment secara atomik.

- [x] **Task 3: Frontend Halaman Publik Customer Self-Order (`/meja/:tableNo`)**
  - **Description:** Membuat halaman web responsif khusus smartphone pelanggan untuk memesan langsung dari meja tanpa navigasi POS kasir.
  - **Acceptance criteria:**
    - [x] Route publik `/meja/:tableNo` (bebas akses tanpa login kasir).
    - [x] Jika fitur non-aktif (`enabled === false`), menampilkan pesan ramah: *"Pemesanan mandiri di meja sedang dinonaktifkan. Silakan pesan langsung di kasir."*
    - [x] Jika aktif:
      - Menampilkan nomor meja otomatis dan kolom input nama pelanggan.
      - Katalog menu dengan tab kategori, opsi varian (suhu/ukuran), badge "Sold Out" abu-abu untuk menu kosong.
      - Keranjang pesanan & perhitungan subtotal.
      - Tombol "Lanjut Bayar" memvalidasi ketersediaan menu secara real-time ke backend.
      - Tampilan nomor rekening bank (dengan tombol 1-klik salin) dan gambar QRIS kedai.
      - Kolom unggah foto struk/bukti transfer dari kamera/galeri HP.
      - Layar status pasca-checkout: *"Pesanan Terkirim! Mohon tunggu konfirmasi kasir."*
  - **Verification:**
    - [x] Halaman terbuka rapi di mobile viewport, validasi berjalan, dan formulir checkout sukses dikirim.
  - **Dependencies:** Task 2
  - **Files likely touched:**
    - `frontend/src/App.jsx`
    - `frontend/src/pages/CustomerTableOrderPage.jsx`
    - `frontend/src/services/qrOrderService.js`
  - **Estimated scope:** M (3 files)

- [x] **Task 4: Frontend Antarmuka Verifikasi Kasir & Saklar Feature Flag**
  - **Description:** Menambahkan kontrol saklar (Feature Flag) di Pengaturan POS serta banner / modal notifikasi di Web POS Kasir untuk meninjau foto bukti transfer dan memproses pesanan meja yang masuk.
  - **Acceptance criteria:**
    - [x] Di menu Settings POS terdapat saklar *"Fitur QR Order Meja (Uji Coba)"* dengan input nomor rekening & upload QRIS statis.
    - [x] Di layar POS kasir terdapat indikator / badge notifikasi pesanan meja yang menunggu konfirmasi (misal: *"🔔 1 Pesanan Meja Menunggu"*).
    - [x] Modal Review Bukti Bayar:
      - Menampilkan foto struk transfer yang bisa diperbesar (*zoom/preview*).
      - Rincian meja, nama pemesan, rincian menu, dan total transfer.
      - Tombol `[ ✅ Konfirmasi Lunas ]` (langsung update pesanan, cetak struk, kirim ke KDS).
      - Tombol `[ ❌ Tolak Bukti ]` (batalkan pesanan jika palsu/nominal tidak sesuai).
  - **Verification:**
    - [x] Kasir dapat membuka modal, melihat foto bukti bayar, dan menekan konfirmasi lunas dengan lancar.
  - **Dependencies:** Task 3
  - **Files likely touched:**
    - `frontend/src/pages/SettingsPage.jsx`
    - `frontend/src/components/pos/CartSidebar.jsx`
    - `frontend/src/components/orders/PendingQrOrdersModal.jsx`
    - `frontend/src/store/qrOrderStore.js`
  - **Estimated scope:** M (3-4 files)

- [x] **Task 5: Generator QR Code Meja & Pengujian End-to-End**
  - **Description:** Menyediakan fitur cetak stiker QR code per meja untuk ditempel di meja kafe, serta pengujian terpadu (*End-to-End*) dari awal hingga akhir.
  - **Acceptance criteria:**
    - [x] Tombol "Cetak / Unduh QR Meja" di POS yang menghasilkan kode QR siap print untuk setiap meja (misal Meja 1 sampai Meja 20).
    - [x] Skenario Uji 1 (Saklar OFF): Buka `/meja/1` -> halaman menolak dan mengarahkan ke kasir.
    - [x] Skenario Uji 2 (Menu Habis): Menu sold out tidak bisa dipesan / dibayar di HP.
    - [x] Skenario Uji 3 (Alur Normal): Tamu scan -> pesan -> transfer -> upload foto bukti -> kasir verifikasi lunas -> tiket otomatis masuk antrean KDS Barista & Kitchen.
  - **Verification:**
    - [x] Seluruh skenario uji lulus 100%.
  - **Dependencies:** Task 4
  - **Files likely touched:**
    - `frontend/src/pages/SettingsPage.jsx`
    - `frontend/src/components/settings/TableQrCodeModal.jsx`
    - `backend/tests/test-qr-order-e2e.js`
  - **Estimated scope:** S (2-3 files)

## Checkpoint 2: Full End-to-End Verification Passed
- [x] Seluruh alur pemesanan mandiri meja terverifikasi siap pakai untuk tahap uji coba kedai.
