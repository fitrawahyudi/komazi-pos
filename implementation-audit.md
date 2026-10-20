# Laporan Audit Arsitektur: Modul Biaya & Aset Tetap Komazi POS

Tanggal Audit: 20 Oktober 2026  
Status: Selesai — Siap Eksekusi  
Penanggung Jawab: AI Engineering Pair  

---

## 1. Arsitektur Source Code Aktual

### Backend (`/backend`)
- **Runtime & Framework**: Node.js v26 (ES Modules, `"type": "module"`), Express.js 4.21.
- **ORM & Database**: Prisma 6.4.1 terhubung ke MySQL 8.x (`DATABASE_URL=mysql://root:@localhost:3306/komazi_pos`).
- **Autentikasi & Otorisasi**: JWT Bearer token via `authenticate` middleware (`src/middlewares/auth.js`) dan role checking `requireRole(['OWNER', 'MANAGER'])` via `src/middlewares/role.js`.
- **Response Format**: Standar terpusat via `src/utils/response.js`:
  - `successResponse(res, data, message, statusCode, meta)` -> `{ success: true, message, data, meta? }`
  - `errorResponse(res, message, statusCode, errors)` -> `{ success: false, message, errors? }`
- **Audit Logging**: Model `AuditLog` di Prisma (`id`, `userId`, `action`, `detail` [JSON], `createdAt`), digunakan oleh auth, shift, password reset, approval, dan KDS.
- **Upload File**: Endpoint `/api/upload` dengan Multer memory storage & integrasi Cloudinary (`uploadController.js`).

### Frontend (`/frontend`)
- **Runtime & UI**: React 18, Vite, Tailwind CSS, Lucide React, Recharts.
- **Desain & Tema**: Dark Theme konsisten Komazi (`#0A0A0A`, `#141414`, `#1E1E1E`, coral `#FF5A4D`, border `#2D3748`).
- **API Client**: `src/services/api.js` membungkus `fetch` dengan base URL resolver aman, handling Bearer token, timeout 12s, dan progress loader.
- **State Management**: Zustand stores (`authStore`, `uiStore`, `toastStore`, `inventoryStore`, dll.).
- **Klien Platform**: Web Desktop, Tablet POS, dan Android via Capacitor (`isInstalledApp` di `platform.js`).

---

## 2. Model Database yang Relevan

### Model yang Sudah Ada
- `User`: Memiliki `role` (`OWNER`, `MANAGER`, `CASHIER`, `KITCHEN`, `BARISTA`), relasi `auditLogs`.
- `Order`, `OrderItem`, `Payment`: Transaksi POS, penghitungan omzet, dan metode bayar.
- `CashMovement`: Mencatat `CASH_IN` dan `CASH_OUT` (petty cash kasir).
- `Ingredient`, `StockMovement`: HPP bahan baku dan waste mutasi.
- `Shift`: Sesi kerja kasir & uang awal/akhir.
- `AuditLog`: Log aktivitas pengguna untuk jejak audit.

### Model Baru yang Akan Ditambahkan
1. **`ExpenseCategory`**:
   - `id` (Int, autoincrement, PK)
   - `name` (String, unique)
   - `description` (String?)
   - `isDefault` (Boolean, default true)
   - `createdAt`, `updatedAt` (DateTime)
   - Relasi: `expenses Expense[]`

2. **`Expense`**:
   - `id` (Int, autoincrement, PK)
   - `referenceNo` (String, unique) — format `EXP-YYYYMM-XXXX`
   - `date` (DateTime) — tanggal pengeluaran (Asia/Jakarta)
   - `categoryId` (Int, FK ke `ExpenseCategory`)
   - `description` (String)
   - `amount` (Decimal(12, 2)) — presisi desimal tanpa floating point loss
   - `paymentMethod` (String, default `CASH`) — `CASH`, `TRANSFER`, `QRIS`, `OTHER`
   - `paymentStatus` (String, default `PAID`) — `PAID`, `UNPAID`
   - `recipientVendor` (String?) — nama vendor / penerima
   - `sourceType` (String?) — misal `MANUAL`, `PETTY_CASH`, `PURCHASE_ORDER`
   - `sourceRef` (String?) — referensi unik eksternal untuk cegah duplikasi
   - `notes` (String? @db.Text)
   - `receiptUrl` (String? @db.LongText) — tautan bukti bayar Cloudinary
   - `createdById` (Int, FK ke `User`)
   - `updatedById` (Int?, FK ke `User`)
   - `isCancelled` (Boolean, default false)
   - `cancelledAt` (DateTime?)
   - `cancelledReason` (String?)
   - `createdAt`, `updatedAt` (DateTime)
   - Indeks: `[date]`, `[categoryId]`, `[paymentStatus]`, `[isCancelled]`, `[sourceRef]`

3. **`FixedAsset`**:
   - `id` (Int, autoincrement, PK)
   - `code` (String, unique) — format `AST-XXXX`
   - `name` (String)
   - `category` (String) — misal `Mesin Espresso & Grinder`, `Refrigerasi`, `Elektronik & POS`, `Furniture`
   - `description` (String?)
   - `purchaseDate` (DateTime)
   - `startDate` (DateTime) — mulai disusutkan
   - `purchasePrice` (Decimal(12, 2))
   - `residualValue` (Decimal(12, 2), default 0)
   - `usefulLifeMonths` (Int) — masa manfaat dalam bulan (misal 60 bulan)
   - `depreciationMethod` (String, default `STRAIGHT_LINE`)
   - `accumulatedDepreciation` (Decimal(12, 2), default 0)
   - `bookValue` (Decimal(12, 2)) — `purchasePrice - accumulatedDepreciation`
   - `location` (String, default `Station Barista`)
   - `condition` (String, default `EXCELLENT`) — `EXCELLENT`, `GOOD`, `FAIR`, `MAINTENANCE`
   - `status` (String, default `ACTIVE`) — `ACTIVE`, `IDLE`, `MAINTENANCE`, `DISPOSED`, `ARCHIVED`
   - `serialNumber` (String?)
   - `vendor` (String?)
   - `receiptUrl` (String? @db.LongText)
   - `disposedAt` (DateTime?)
   - `disposalPrice` (Decimal(12, 2)?)
   - `disposalNotes` (String?)
   - `createdById` (Int, FK ke `User`)
   - `createdAt`, `updatedAt` (DateTime)
   - Indeks: `[status]`, `[category]`, `[code]`

4. **`AssetDepreciation`**:
   - `id` (Int, autoincrement, PK)
   - `assetId` (Int, FK ke `FixedAsset`)
   - `year` (Int) — misal 2026
   - `month` (Int) — 1..12
   - `depreciationAmount` (Decimal(12, 2))
   - `status` (String, default `PROCESSED`) — `PROCESSED`, `CANCELLED`
   - `processedAt` (DateTime, default now)
   - `processedById` (Int?, FK ke `User`)
   - `notes` (String?)
   - `createdAt` (DateTime)
   - **Unique Constraint**: `@@unique([assetId, year, month])` (idempoten & cegah double-dip)
   - Indeks: `[year, month]`, `[status]`

---

## 3. Endpoint & Komponen yang Dapat Digunakan Kembali

- `backend/src/routes/reportRoutes.js`:
  - `GET /api/reports/profit-loss` -> akan diperkaya dengan komponen Biaya Operasional dan Penyusutan Aset.
- `backend/src/services/profitService.js`:
  - `calculateProfitAndLoss({ period, startDate, endDate })` sudah menangani Omzet dan HPP, diperluas memasukkan agregasi `Expense` dan `AssetDepreciation`.
- `backend/src/controllers/uploadController.js`:
  - Upload bukti nota/kuitansi ke Cloudinary via `POST /api/upload`.
- `frontend/src/components/reports/ProfitLossView.jsx`:
  - Komponen visual laporan P&L berbasis Recharts, tinggal dihubungkan dengan kartu detail beban baru.
- `frontend/src/services/api.js`:
  - Helper `request` dan helper query string siap pakai.

---

## 4. Perhitungan Laporan Laba Rugi yang Berjalan & Ekstensi

### Rumus Terkini:
```text
Gross Revenue = Sum(Orders total)
COGS (HPP)    = Sum(OrderItems lineCost)
Gross Profit  = Gross Revenue - COGS
Petty Cash    = Sum(CashMovement CASH_OUT)
Waste Cost    = Sum(StockMovement WASTE totalCost)
Labor Cost    = Sum(Shift unique cashier allowances)
Total Beban   = Petty Cash + Waste + Labor
Net Profit    = Gross Profit - Total Beban
```

### Rumus Ekstensi (Terintegrasi Penuh):
```text
Operating Expenses (Beban Operasional) = Sum(Expense aktif, status PAID)
Asset Depreciation (Beban Penyusutan)  = Sum(AssetDepreciation periode berjalan)
Total Beban Operasional Lengkap:
  = Petty Cash + Waste + Labor + Operating Expenses + Asset Depreciation
Net Profit (Laba Bersih Operasional):
  = Gross Profit - Total Beban Operasional Lengkap
```
*Catatan akuntansi*: Jika suatu pengeluaran kas dicatat via `Expense` dengan flag `sourceType: 'PETTY_CASH'`, sistem memvalidasi agar tidak terjadi double-counting dengan `CashMovement`.

---

## 5. Analisis Risiko & Mitigasi Integrasi

| Risiko | Dampak | Strategi Mitigasi |
|---|---|---|
| Penurunan / reset data MySQL | Kehilangan data penjualan dan user | Larang mutlak `prisma db push --force-reset`. Gunakan migrasi aditif non-destruktif. |
| Perhitungan floating-point tidak presisi | Selisih nominal pada laporan keuangan | Gunakan Prisma `Decimal(12, 2)` dan pembulatan standard di service backend. |
| Double posting penyusutan aset bulanan | Beban penyusutan membengkak ganda | Terapkan constraint unik `@@unique([assetId, year, month])` dan Prisma interactive transaction `$transaction`. |
| Akses tidak berwenang dari kasir | Kasir dapat melihat/mengubah biaya/aset | Terapkan `requireRole(['OWNER', 'MANAGER'])` di semua endpoint biaya, aset, dan penyusutan. |
| Gangguan tampilan Capacitor / mobile | UI rusak di tablet kasir/dapur | Pertahankan desain responsif, dark theme token Komazi, padding bawah aman untuk tab bar. |

---

## 6. Daftar File yang Dibuat dan Diubah

### Dibuat:
- `backend/src/controllers/expenseController.js`
- `backend/src/controllers/assetController.js`
- `backend/src/controllers/depreciationController.js`
- `backend/src/routes/expenseRoutes.js`
- `backend/src/routes/assetRoutes.js`
- `backend/src/routes/depreciationRoutes.js`
- `backend/src/services/expenseService.js`
- `backend/src/services/assetService.js`
- `backend/src/services/depreciationService.js`
- `frontend/src/pages/finance/ExpensesPage.jsx`
- `frontend/src/pages/finance/DepreciationPage.jsx`
- `frontend/src/store/expenseStore.js`
- `frontend/src/store/assetStore.js`

### Diubah:
- `backend/prisma/schema.prisma` (tambah 4 model & relasi User)
- `backend/src/routes/index.js` (mount routes `/expenses`, `/assets`, `/depreciations`)
- `backend/src/services/profitService.js` (integrasikan `Expense` dan `AssetDepreciation` ke P&L)
- `frontend/src/pages/inventory/AssetsPage.jsx` (migrasi dari store lokal ke API backend penuh)
- `frontend/src/components/layout/Sidebar.jsx` (tambahkan grup navigasi Manajemen Keuangan)
- `frontend/src/App.jsx` (tambahkan route `/finance/*` dan update `/inventory/assets`)
- `frontend/src/services/api.js` (tambahkan namespace `expenses`, `assets`, `depreciations`)
- `frontend/src/components/reports/ProfitLossView.jsx` (tampilkan breakdown biaya & depresiasi)

---

## 7. Migration yang Diperlukan
Migrasi Prisma murni aditif:
- Membuat tabel baru `ExpenseCategory`, `Expense`, `FixedAsset`, `AssetDepreciation`.
- Menambahkan relasi foreign key ke tabel `User`.
- Menjalankan `npx prisma db push` atau `prisma migrate dev` tanpa opsi force reset, kemudian mengeksekusi seeder kategori standar: Listrik, Air, Internet & Telekomunikasi, Sewa Tempat, Kebersihan, Perawatan & Perbaikan, Perlengkapan Operasional, Transportasi, Administrasi, Biaya Lainnya.

---

## 8. Strategi Rollback
- Jika terjadi kendala deployment backend, seluruh tabel baru bersifat independen (tabel lama `Order`, `User`, `Shift` tidak diubah struktur kolomnya).
- Rollback kode backend dan frontend dapat dilakukan tanpa merusak data transaksi lama.
- Data aset dan biaya tidak akan menghapus data lama jika endpoint dicabut sementara.

---

## 9. Daftar Pengujian Regresi
1. Login dan navigasi role Owner, Manager, Kasir, Kitchen, Barista.
2. Transaksi POS, pembayaran kas & QRIS, cetak struk kasir.
3. Buka/tutup shift kasir dan riwayat sesi kasir.
4. CRUD dan filter Biaya Operasional (nominal nol ditolak, role kasir ditolak 403).
5. Pembatalan biaya (status `isCancelled: true`, kontribusi ke P&L ditarik kembali).
6. CRUD Aset Tetap, validasi residual value tidak melebihi harga perolehan, umur manfaat > 0.
7. Pratinjau & pemrosesan penyusutan bulanan (uji idempoten: eksekusi ulang bulan yang sama tidak menambah beban).
8. Laporan Laba Rugi: verifikasi sinkronisasi angka Omzet, HPP, Biaya, Penyusutan, hingga Laba Bersih.
9. Build frontend (`npm run build`) dan backend syntax/type validation.

---
---

# Laporan Audit Arsitektur: Hak Akses dan Keamanan Riwayat Pesanan Komazi POS

Tanggal Audit: 20 Oktober 2026  
Status: Selesai — Terimplementasi Penuh  
Penanggung Jawab: AI Engineering Pair  

---

## 1. Model dan Relasi Aktual
- **`Order`**: Menyimpan referensi `cashierId` (FK ke `User`), `shiftId` (FK ke `Shift`), `status` (`OPEN`, `PAID`, `VOIDED`, `REFUNDED`), `total`, `subtotal`, `discount`, `tax`, `serviceFee`, `paidAt`, `voidReason`, relasi `items` (`OrderItem[]`), `payments` (`Payment[]`), `customer` (`Customer?`).
- **`User`**: Memiliki `role` (`OWNER`, `MANAGER`, `CASHIER`, `KITCHEN`, `BARISTA`), relasi `orders`, `auditLogs`.
- **`AuditLog`**: Menyimpan riwayat perubahan, termasuk aksi `UPDATE_OPEN_ORDER`, `VOID_ORDER`, `REFUND_ORDER`, dan `REQUEST_REFUND`.
- **`ApprovalRequest`**: Mengatur alur persetujuan refund jika diajukan oleh kasir/manager ke owner tanpa silent bypass.

## 2. Status Pesanan dan Transisi Status yang Sah
- `OPEN`: Pesanan terbuka/tertahan (Hold Bill/Dine In). Hanya boleh diubah oleh kasir pembuat (`cashierId === req.user.id`) atau `OWNER`/`MANAGER`.
- `PAID`: Pesanan selesai/lunas. Transaksi finansial immutable (tidak dapat diedit item, total, diskon, atau waktu transaksi). Tidak dapat dibayar ulang.
- `VOIDED`: Pesanan dibatalkan resmi. Mengembalikan stok bahan baku delta BOM, menandai seluruh item `CANCELLED`, mencatat `voidReason` dan audit log permanen. Memerlukan role `OWNER`/`MANAGER` atau PIN supervisor jika dilakukan kasir.
- `REFUNDED`: Pengembalian dana resmi. Memulihkan stok bahan baku, mencatat alasan dan nominal refund, disetujui langsung oleh Owner atau melalui approval queue. Tidak dapat di-void atau di-refund ganda.

## 3. Endpoint & Komponen yang Disesuaikan
- **`backend/src/controllers/orderController.js`**:
  - `updateOrder`: Menegakkan validasi kepemilikan kasir (`403 Pesanan milik kasir lain hanya dapat dilihat.`), memvalidasi `existingOrder.status === 'OPEN'`, re-verifikasi `lockedOrder.status === 'OPEN'` di dalam transaksi `$transaction`, dan mencatat audit log `UPDATE_OPEN_ORDER`.
  - `payOrder`: Menolak pembayaran pesanan `VOIDED` atau `REFUNDED`, dan mengunci order di transaksi untuk mencegah double payment.
  - `voidOrder`: Menolak void terhadap pesanan `REFUNDED`, mengunci order di transaksi.
  - `refundOrder`: Menolak refund jika status bukan `PAID`, menolak refund pesanan `REFUNDED` atau `VOIDED`, memvalidasi nominal refund `0 < amount <= total`, mencegah duplikasi permohonan refund `PENDING`, dan mengunci order di transaksi.
- **`backend/src/routes/orderRoutes.js`**:
  - Menambahkan guard eksplisit `DELETE /api/orders/:id` dan `DELETE /api/orders` dengan response HTTP 403: `"Transaksi tidak dapat dihapus. Gunakan prosedur pembatalan (void) atau refund resmi yang tersedia."`
- **`frontend/src/pages/OrdersPage.jsx`**:
  - Menampilkan kolom **Kasir** untuk semua role pengguna (bukan hanya Owner/Manager).
  - Menampilkan filter opsi Kasir dan Shift untuk semua pengguna untuk pencarian transparan.
  - Menambahkan tombol aksi eksplisit **Lihat Detail Pesanan & Struk** (icon `Eye`) di baris tabel transaksi.
- **`backend/tests/order-access-control.test.js`**:
  - Suite pengujian otomatis yang memverifikasi visibilitas antar-kasir, penolakan edit pesanan kasir lain, penolakan edit transaksi PAID, penolakan hapus endpoint DELETE, validasi nominal refund, dan pencegahan duplikasi refund.

## 4. Analisis Risiko & Mitigasi
- **Risiko Manipulasi Kasir**: Dicegah secara menyeluruh di layer middleware & controller backend, bukan hanya di frontend.
- **Risiko Hilangnya Jejak Pembatalan/Refund**: Tidak ada hard delete atau soft delete sembunyi-sembunyi; data finansial tetap utuh di tabel `Order`, `Payment`, dan `AuditLog`.
- **Risiko Race Condition**: Menggunakan Prisma interactive transaction `$transaction` dan re-evaluasi status terkini (`lockedOrder.status`).

## 5. Migration Database
- **Tidak diperlukan migration skema baru**: Semua kolom relasi (`cashierId`, `shiftId`, `status`, `voidReason`) dan model `AuditLog` sudah tersedia di skema Prisma MySQL.

## 6. Hasil Pengujian Regresi
- Backend: `npm test` lulus 100% (semua 59 test suite lama + 7 test suite keamanan riwayat pesanan baru lulus).
- Frontend: `npm test` lulus 100% (7 test suite unit dan export excel/csv).
- Build Bundle: `npx vite build` selesai sukses tanpa error.
