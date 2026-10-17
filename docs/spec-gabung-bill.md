# Spesifikasi Teknis: Fitur Gabung Bill (Merge Bill)

## 1. Objective
Menyediakan fitur bagi kasir untuk menggabungkan beberapa tagihan tertahan (*open bills*) ke dalam satu tagihan aktif di keranjang kasir POS (`CartSidebar.jsx`). Hal ini memudahkan pelayanan pesanan kelompok/rombongan atau pelanggan yang pindah/gabung meja tanpa kasir harus menghapus dan menginput ulang pesanan secara manual.

## 2. Tech Stack
- **Frontend Framework:** React 18, Vite
- **State Management:** Zustand (`cartStore.js`, `ordersStore.js`)
- **UI & Icons:** Tailwind CSS, Lucide React
- **Toast Notifications:** Custom toast store (`toastStore.js`)
- **Backend API:** Express.js + MySQL (Sequelize/Prisma)

## 3. Commands
- Run Frontend Dev Server: `npm run dev` (di folder `frontend`)
- Run Backend Dev Server: `npm run dev` (di folder `backend`)
- Run Frontend Lint / Build check: `npm run build` (di folder `frontend`)

## 4. Architecture & File Structure
```
frontend/src/
├── components/pos/
│   ├── CartSidebar.jsx         → Menambahkan tombol "Gabung Bill" di samping "Split Bill"
│   ├── MergeBillModal.jsx      → Modal multi-select open bills untuk digabungkan
│   └── SplitBillModal.jsx      → (Komponen pembanding yang sudah ada)
├── pages/
│   └── PosPage.jsx             → Mount MergeBillModal & passing props ke CartSidebar
└── store/
    ├── cartStore.js            → Aksi mergeOpenBills(sourceBillIds)
    └── ordersStore.js          → deleteHoldOrder untuk membersihkan bill sumber dari server/KDS
```

## 5. Komponen & Detail Alur Data

### 5.1 Aksi `mergeOpenBills(sourceBillIds)` di `cartStore.js`
1. **Identifikasi Tagihan Sumber:**
   Mencari semua tagihan di `openBills` yang id / billId-nya terdapat di array `sourceBillIds`.
2. **Penggabungan Item:**
   - Untuk setiap item dari tagihan sumber:
     - Cari apakah ada item yang sama persis di keranjang aktif (`itemKey` sama: `productId`, `variant`, `modifiers`, `note`).
     - Jika ada: `item.qty += sourceItem.qty`, `item.lineTotal = item.qty * item.unitPrice`.
     - Jika belum ada: masukkan sebagai item baru di array `items`.
3. **Penggabungan Nomor Meja:**
   - Kumpulkan nomor meja aktif (`state.tableNo`) dan semua `sourceBills.map(b => b.tableNo).filter(Boolean)`.
   - Pisahkan string yang mungkin sudah dipisahkan koma, hapus duplikat, dan satukan kembali menjadi format rapi (contoh: `"01, 02"`).
4. **Pembersihan Tagihan Sumber di Backend & Local Store:**
   - Panggil `useOrdersStore.getState().deleteHoldOrder(bill.billId, bill.backendOrderId)` untuk setiap tagihan yang digabungkan.
   - Hapus tagihan sumber dari array `openBills` di local state.
5. **Pembaruan Label / Indikator:**
   - Jika keranjang sedang dalam mode `isEditingOpenBill`, perbarui label agar mencerminkan meja gabungan.

### 5.2 Komponen `MergeBillModal.jsx`
- **Props:** `isOpen`, `onClose`
- **Konten:**
  - Menampilkan daftar `openBills` yang tersedia, mengecualikan tagihan yang saat ini sedang dibuka di keranjang (`currentHoldBillId` / `currentBackendOrderId`).
  - Setiap kartu/baris tagihan menampilkan:
    - Checkbox pilihan.
    - Nomor meja / nama pelanggan / label.
    - Ringkasan item dan total harga (`formatRupiah`).
    - Waktu hold disimpan (`formatDateTime` / relarif).
  - Checkbox "Pilih Semua" (Select All) untuk kemudahan kasir.
  - Ringkasan di bagian bawah: jumlah tagihan terpilih, total item yang akan ditambahkan, dan total nominal tambahan.
  - Tombol aksi: "Batal" dan "Gabungkan ke Keranjang (X tagihan)".
  - Feedback jika tidak ada tagihan lain yang bisa digabung (*empty state* informatif).

### 5.3 Integrasi di `CartSidebar.jsx`
- Menambahkan tombol **"Gabung Bill"** berdampingan dengan tombol "Split Bill".
- Tombol hanya aktif jika ada tagihan tertahan yang tersedia untuk digabung (`availableOpenBillsCount > 0`).

## 6. Testing & Validation Strategy
1. **Verifikasi Tidak Ada Tagihan Diri Sendiri:** Pastikan bill yang sedang diedit di keranjang tidak muncul di modal gabung.
2. **Verifikasi Penggabungan Item:** Coba gabung bill dengan produk yang sama (qty bertambah) dan produk berbeda (muncul baris baru).
3. **Verifikasi Sinkronisasi Server:** Pastikan tagihan sumber tidak lagi muncul di daftar *Open Bills* maupun KDS dapur.
4. **Verifikasi Total Perhitungan:** Subtotal, diskon, PPN, dan grand total otomatis terkalkulasi ulang dengan benar melalui `getCartSummary()`.

## 7. Boundaries
- **Always:** Validasi bahwa minimal 1 tagihan sumber dipilih sebelum menjalankan penggabungan. Berikan notifikasi toast sukses/gagal.
- **Ask first:** Mengubah struktur schema database backend (tidak diperlukan karena menggunakan API void/delete order yang sudah ada).
- **Never:** Menghapus atau membersihkan isi keranjang utama saat menggabungkan bill sumber.
