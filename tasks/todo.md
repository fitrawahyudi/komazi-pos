# Task Breakdown Checklist: Sistem Promo Transaksi Kasir

- [x] **Task 1: Promo Service & Validator Engine (Backend)**
  - **Description:** Membangun core engine promosi untuk mengelola preset diskon dan validasi kode voucher (kuota, min spend, batas potongan, masa aktif) dengan persistensi aman di tabel Setting.
  - **Acceptance criteria:**
    - [x] Menyediakan preset awal: `Diskon Karyawan 20%`, `Mitra Komunitas 10%`, `Komplimen Minuman Rp 25.000`.
    - [x] Menyediakan voucher awal: `KOMAZI10` (10% min Rp 50rb), `HEMAT15K` (Rp 15rb min Rp 75rb).
    - [x] Fungsi `validateVoucher(code, subtotal, customerId)` menguji aktif, rentang tanggal, min belanja, kuota, dan mengembalikan nominal diskon presisi.
    - [x] Fungsi `consumeVoucher(code)` menambah `usedCount` secara aman.
  - **Verification:**
    - [x] `node backend/tests/test-promo-service.js` lulus 100%.
  - **Dependencies:** None
  - **Files likely touched:**
    - `backend/src/services/promoService.js`
    - `backend/tests/test-promo-service.js`
  - **Estimated scope:** S (2 files)

- [x] **Task 2: API Endpoints & Order Recording (Backend)**
  - **Description:** Menyediakan REST API controller & routes untuk presets dan voucher, serta mencatat pemakaian promo saat pembuatan order di `orderController.js`.
  - **Acceptance criteria:**
    - [x] `GET /api/promos/presets` mengembalikan daftar preset diskon aktif.
    - [x] `POST /api/promos/validate-voucher` menerima `{ code, subtotal }` dan mengembalikan detail potongan jika valid.
    - [x] `GET /api/promos/vouchers` (Role: OWNER/MANAGER) mengembalikan seluruh voucher & statistik.
    - [x] `createOrder` di `orderController.js` menerima `promoCode`/`promoName` opsional dan memicu pemotongan kuota jika voucher valid.
  - **Verification:**
    - [x] Unit & route test via `test-promo-api.js`.
  - **Dependencies:** Task 1
  - **Files likely touched:**
    - `backend/src/controllers/promoController.js`
    - `backend/src/routes/promoRoutes.js`
    - `backend/src/routes/index.js`
    - `backend/src/controllers/orderController.js`
  - **Estimated scope:** M (3-4 files)

## Checkpoint: Backend Engine & API Complete
- [x] Backend API untuk preset dan validasi voucher siap dikonsumsi POS frontend.

- [x] **Task 3: Cart Store Promo State (Frontend)**
  - **Description:** Mengintegrasikan status promo aktif ke dalam Zustand `cartStore`, menangani perhitungan diskon reaktif, dan mencegah konflik dengan penukaran poin loyalty member.
  - **Acceptance criteria:**
    - [x] State `appliedPromo`: `{ code, name, type, value, discountAmount, isPreset }`.
    - [x] Action `applyPresetDiscount(preset)` memasang preset diskon instan.
    - [x] Action `applyVoucher(voucherData)` memasang voucher yang sudah tervalidasi.
    - [x] Action `removePromo()` mereset promo dan diskon ke 0.
    - [x] `getCartSummary()` menghitung total dengan akurat dan menyertakan rincian promo.
  - **Verification:**
    - [x] Automated test and store verification.
  - **Dependencies:** Task 2
  - **Files likely touched:**
    - `frontend/src/store/cartStore.js`
  - **Estimated scope:** S (1 file)

- [x] **Task 4: CartSidebar Discount Popover UI (Frontend)**
  - **Description:** Mendesain ulang popover diskon di sidebar keranjang kasir POS dengan chips preset 1-klik, input voucher promo instan, dan kartu status promo aktif.
  - **Acceptance criteria:**
    - [x] Menampilkan chip tombol preset cepat (`[Karyawan 20%]`, `[Mitra 10%]`, `[Komplimen Rp25rb]`) yang langsung memotong total saat diklik.
    - [x] Kolom input kode voucher dengan tombol "Terapkan" dan indikator validasi real-time.
    - [x] Kartu hijau estetik saat promo terpasang, menunjukkan nama promo, hemat berapa Rupiah, dan tombol [Hapus].
    - [x] Tetap menyediakan tab input nominal/persen manual sebagai opsi cadangan kasir.
  - **Verification:**
    - [x] Visual verification & interaksi di CartSidebar.
  - **Dependencies:** Task 3
  - **Files likely touched:**
    - `frontend/src/components/pos/CartSidebar.jsx`
  - **Estimated scope:** M (1 file)

- [x] **Task 5: End-to-End Verification (Backend & POS)**
  - **Description:** Menguji alur menyeluruh mulai dari pemilihan preset di POS, validasi voucher promo, checkout order di backend, hingga pemakaian kuota voucher.
  - **Acceptance criteria:**
    - [x] `node backend/tests/test-promo-e2e.js` lulus 100%.
    - [x] Struk atau order payload mencantumkan detail promo yang digunakan secara transparan.
  - **Verification:**
    - [x] E2E script run passed.
  - **Dependencies:** Task 4
  - **Files likely touched:**
    - `backend/tests/test-promo-e2e.js`
  - **Estimated scope:** S (1 file)
