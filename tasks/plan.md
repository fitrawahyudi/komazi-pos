# Implementation Plan: Fitur QR Order Meja (Customer Self-Order & Manual Verification)

## Overview
Membangun fitur Customer Self-Order berbasis QR Code meja dengan proteksi ketersediaan menu bertingkat, pembayaran non-tunai langsung via Transfer Bank/QRIS Statis, verifikasi foto bukti transfer oleh kasir di Web POS, serta tombol saklar kendali (*Feature Flag*) untuk masa uji coba.

---

## Architecture Decisions

1. **Feature Flag & Konfigurasi Toko di Tabel Setting:**
   * Menggunakan model `Setting` yang sudah ada untuk menyimpan konfigurasi:
     * `qrOrderEnabled`: `'true'` | `'false'` (Default: `'false'`)
     * `qrOrderBankName`: Nama Bank (e.g., `'BCA'`)
     * `qrOrderAccountNo`: Nomor Rekening (e.g., `'1234567890'`)
     * `qrOrderAccountHolder`: Atas Nama Rekening (e.g., `'Komazi Coffee'`)
     * `qrOrderQrisUrl`: URL Gambar QRIS Statis kedai (opsional)

2. **Siklus Hidup Pesanan (Order Lifecycle) QR Meja:**
   * Saat tamu submit pesanan & upload bukti bayar:
     * Dibuat pesanan dengan status `status: 'PENDING_PAYMENT'`, tipe `type: 'DINE_IN'`, nomor meja `tableNo`, dan bukti transfer tersimpan di `paymentProofUrl` (atau metadata).
     * Stok bahan **belum dipotong** dan tiket antrean KDS **belum dikirim**.
   * Saat kasir klik `[Konfirmasi Lunas]`:
     * Status order diperbarui menjadi `status: 'PAID'`, `paidAt: new Date()`.
     * `Payment` record dibuat dengan `method: 'TRANSFER'` atau `'QRIS'`.
     * Memanggil pemotongan stok bahan baku via `deltaInventoryService.deductOrderInventory`.
     * Memanggil event notifikasi `events.emit('order.created', { order })` agar tiket otomatis muncul di KDS Barista/Dapur dan notifikasi Telegram terkirim.
   * Saat kasir klik `[Tolak Pesanan]`:
     * Status order menjadi `status: 'VOIDED'`, dicatat alasan penolakan, tidak ada pemotongan stok.

3. **Routing Publik & Frontend Self-Order:**
   * Rute publik baru di frontend: `/meja/:tableNo` (responsif untuk tampilan mobile smartphone tamu).
   * Membaca konfigurasi via API publik: `GET /api/public/qr-order/config`.
   * Jika `qrOrderEnabled` bernilai `false`, halaman menampilkan tampilan *friendly error*: "Pemesanan via meja sedang dinonaktifkan sementara. Silakan pesan langsung di meja kasir."

---

## Task Breakdown Index
- [x] Task 1: Backend Setting & Konfigurasi Feature Flag QR Order
- [x] Task 2: Backend API Validasi Real-time Stok & Checkout QR Order Meja
- [x] Checkpoint 1: Backend Configuration & Order API Ready
- [x] Task 3: Frontend Halaman Publik Customer Self-Order (`/meja/:tableNo`)
- [x] Task 4: Frontend Antarmuka Verifikasi Kasir & Kontrol Saklar (Feature Flag)
- [x] Task 5: Generator QR Code Meja & Pengujian End-to-End
- [x] Checkpoint 2: Full End-to-End Verification Passed
