# Implementation Plan: Sistem Promo Transaksi Kasir (Preset Diskon 1-Klik & Voucher Promo)

## Overview
Membangun sistem promosi dan diskon terstruktur di POS Kasir Komazi Coffee yang menggantikan input angka manual bebas menjadi:
1. **Tombol Preset Diskon Cepat (1-klik)** di kasir (seperti Diskon Karyawan 20%, Mitra Komunitas 10%, Komplimen Minuman).
2. **Validasi Kode Voucher Promo** (seperti `KOMAZI10`, `HEMAT15K`) dengan pengecekan backend otomatis (minimal belanja, kuota, tanggal kedaluwarsa).
3. **Pencatatan Audit & Struk Transaksi** yang rapi mencantumkan nama promo yang digunakan.

## Architecture Decisions
1. **Non-Breaking Dynamic Setting Storage**: Vouchers dan Preset Diskon dikelola melalui layanan `promoService.js` yang memanfaatkan tabel `Setting` (key: `promo_presets` dan `promo_vouchers`). Ini memungkinkan update instan dan nol migrasi database (zero database migration risk) pada lingkungan produksi.
2. **Robust Validation Pipeline**: Validasi voucher di backend memeriksa secara ketat: status aktif, tanggal berlaku (`startDate` - `endDate`), batas minimal belanja (`minSpend`), kuota pemakaian tersisa (`quota` vs `usedCount`), dan kalkulasi batas potongan maksimal (`maxDiscount`).
3. **Reactive Frontend State (`cartStore`)**: Menambahkan `appliedPromo` pada keranjang belanja POS, yang terintegrasi langsung dengan kalkulasi subtotal, pajak, biaya layanan, dan grand total. Penukaran poin loyalty tetap dapat berjalan berdampingan atau saling eksklusif dengan pesan yang jelas.
4. **Fast-Paced Cashier UX**: Popover diskon di [CartSidebar.jsx](file:///d:/pos-komazi/frontend/src/components/pos/CartSidebar.jsx) dirombak dengan UI modern: chips preset 1-klik di bagian atas, form input kode kupon dengan tombol verifikasi instan, dan kartu status promo aktif dengan tombol batal.

## Task List

### Phase 1: Backend Foundation & Promo Engine
- [ ] **Task 1: Promo Service & Validator Engine (`backend/src/services/promoService.js`)**
  - Penyediaan default presets & voucher awal.
  - Implementasi fungsi `getPresets()`, `savePresets()`, `getVouchers()`, `validateVoucher(code, subtotal, customerId)`, dan `consumeVoucher(code)`.
  - Unit test validator di `backend/tests/test-promo-service.js`.

### Checkpoint 1: Engine & Rules
- [ ] Validator berhasil menguji syarat min. belanja, tanggal, kuota, dan kalkulasi persen/nominal.

### Phase 2: REST API & Order Integration
- [ ] **Task 2: API Endpoints & Order Recording (`promoRoutes.js`, `promoController.js`, `orderController.js`)**
  - Endpoint `GET /api/promos/presets` (Kasir/Staff).
  - Endpoint `POST /api/promos/validate-voucher` (Kasir/Staff).
  - Endpoint CRUD `/api/promos/vouchers` (Role: OWNER/MANAGER).
  - Integrasi pencatatan nama voucher & penambahan `usedCount` saat order dibuat di `orderController.js`.

### Checkpoint 2: API Ready
- [ ] Kasir dapat memanggil API validasi voucher dan order berhasil dibuat dengan referensi promo.

### Phase 3: Frontend Store & UI Integration
- [ ] **Task 3: Cart Store Promo State (`frontend/src/store/cartStore.js`)**
  - Tambahkan state `appliedPromo` (detail kode/nama promo, tipe, nilai, dan potongan).
  - Action `applyPresetDiscount(preset)`, `applyVoucher(voucherData)`, dan `removePromo()`.
  - Sinkronisasi dengan `getCartSummary()` dan reset saat keranjang dibersihkan.
- [ ] **Task 4: CartSidebar Discount Popover UI (`frontend/src/components/pos/CartSidebar.jsx`)**
  - Tampilkan tombol chips Preset Diskon Cepat 1-klik di atas.
  - Input teks Kode Voucher Promo dengan tombol "Terapkan" & feedback loading/error.
  - Kartu hijau status promo aktif dengan rincian potongan dan tombol hapus promo.
  - Tab manual input tetap tersedia sebagai opsi cadangan.

### Phase 4: E2E Verification & Reporting
- [ ] **Task 5: End-to-End Test & Struk Verification (`backend/tests/test-promo-e2e.js`)**
  - Uji alur lengkap: ambil preset -> pasang diskon karyawan -> validasi voucher -> checkout order -> kuota berkurang.
  - Pastikan struk dan canvas image mencatat nama promo secara transparan.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Kasir memasukkan voucher yang kuotanya sudah habis | Medium | Backend menolak dengan pesan error jelas: "Kuota voucher telah habis terpakai" |
| Minimal belanja belum tercapai tapi voucher dimasukkan | Low | Validasi real-time mencantumkan syarat minimal belanja (misal: "Minimal belanja Rp 50.000") |
| Double discount (Voucher + Tukar Poin Member bertumpuk liar) | Medium | Aturan prioritas yang jelas: saat voucher/preset dipasang, penukaran poin dikonfirmasi/direset |
