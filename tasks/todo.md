# Task List: Preview Kertas Thermal & Toggle Cetak Otomatis Pesanan KDS

## Phase 1: KDS Printer Modal Upgrade

### Task 1: Add Paper Preview Tab & Auto-Print Toggle in `KdsPrinterModal.jsx`
**Description:** Menambahkan tab Pratinjau Kertas (visual thermal receipt & kitchen ticket dengan pilihan 58mm/80mm) dan toggle Cetak Otomatis Pesanan Baru di dalam `KdsPrinterModal.jsx`.
**Acceptance criteria:**
- [x] Tab ke-3 "Pratinjau Kertas" tersedia dengan navigasi mulus.
- [x] Pratinjau kertas menampilkan simulasi visual kertas thermal realistis (background putih, font mono, pembatas putus-putus, dan efek tepi sobekan kertas).
- [x] Pratinjau mendukung toggle jenis dokumen: Tiket Dapur/Bar vs Struk Pembayaran, serta ukuran 58mm vs 80mm.
- [x] Tab pengaturan memiliki toggle "Cetak Otomatis saat Pesanan Masuk (Auto-Print)" yang terikat ke `autoPrintKitchenOnCheckout` di `printerStore`.
- [x] Tersedia tombol "Cetak Contoh Preview" yang mengirim dokumen simulasi ke printer Bluetooth terhubung.
**Verification:**
- [x] Buka modal printer di KDS, buka tab Pratinjau Kertas, uji ganti 58mm/80mm dan template tiket/struk.
- [x] Ubah toggle cetak otomatis dan pastikan state tersimpan.
**Dependencies:** None
**Files touched:**
- `frontend/src/components/kds/KdsPrinterModal.jsx`
**Scope:** Complete

---

## Phase 2: Realtime Auto-Print Trigger

### Task 2: Wire Auto-Print on `onOrderNew` in `KdsStandaloneScreen.jsx` and `KdsPage.jsx`
**Description:** Memastikan saat ada pesanan baru yang masuk melalui socket realtime (`onOrderNew`), jika toggle auto-print aktif dan printer terhubung, tiket dapur langsung dicetak otomatis.
**Acceptance criteria:**
- [x] `KdsStandaloneScreen.jsx` memeriksa `autoPrintKitchenOnCheckout` & `isConnected`, lalu memicu `printKitchenTicketForOrder`.
- [x] `KdsPage.jsx` juga memeriksa dan memicu pencetakan otomatis jika memenuhi kriteria.
- [x] Filter item sesuai stasiun aktif (Barista hanya cetak minuman, Dapur hanya cetak makanan, Semua cetak seluruh item).
**Verification:**
- [x] Simulasi `onOrderNew` memicu pengiriman payload tiket ke `printKitchenTicketForOrder`.
**Dependencies:** Task 1
**Files touched:**
- `frontend/src/pages/KdsStandaloneScreen.jsx`
- `frontend/src/pages/KdsPage.jsx`
**Scope:** Complete

---

## Phase 3: Verification & Build Check

### Task 3: Unit Tests & Production Build Verification
**Description:** Menjalankan unit tests dan build bundle Vite untuk memastikan kode bebas error syntax, import, dan regresi.
**Acceptance criteria:**
- [x] `npm test` lulus tanpa error (12/12 passing tests).
- [x] `npm run build` lulus tanpa error (exit code 0).
**Verification:**
- [x] Output terminal tests dan build exit code 0.
**Dependencies:** Task 1, Task 2
**Files touched:**
- `frontend/tests/frontend.test.js`
**Scope:** Complete

