# Spesifikasi Teknis: Ekosistem Impor & Ekspor Spreadsheet Komazi POS

## 1. Arsitektur & Tujuan

Spesifikasi ini mengatur implementasi teknis sistem impor dan ekspor spreadsheet (`.xlsx`, `.xls`, `.csv`) untuk seluruh modul operasional pada Komazi POS.

Arsitektur sistem dibagi menjadi 3 pilar utama:
1. **Spreadsheet Utility Engine (`frontend/src/utils/excel.js`)**: Pembuat berkas template resmi berformat `.xlsx`, pembaca berkas (*parser*) berbasis library `xlsx` (SheetJS), dan generator ekspor data tabel aktif.
2. **Komponen Antarmuka Interaktif (`frontend/src/components/common/ExcelImportModal.jsx`)**: Modal dialog tunggal serbaguna (*reusable*) dengan validasi baris di peramban, tabel pratinjau status baris, dan penanganan galat mandiri.
3. **Endpoint Transaksi Massal Backend**: Rute API yang memproses larik (*array*) data dalam transaksi atomik Prisma `$transaction` dengan proteksi peran pengguna (*Role-Based Access Control*).

---

## 2. Struktur Generator Template (`frontend/src/utils/excel.js`)

Modul utilitas menyediakan fungsi unduh template resmi untuk 9 modul:

| Modul | Fungsi Generator | Nama Berkas Keluaran | Nama Sheet |
| :--- | :--- | :--- | :--- |
| Menu & Produk | `downloadMenuTemplate()` | `template_import_menu_komazi.xlsx` | `Template Menu` |
| Bahan Baku | `downloadIngredientTemplate()` | `template_import_bahan_komazi.xlsx` | `Template Bahan` |
| Resep (BOM) | `downloadRecipeTemplate()` | `template_import_resep_komazi.xlsx` | `Template Resep` |
| Pelanggan & CRM | `downloadCustomerTemplate()` | `template_import_pelanggan_komazi.xlsx` | `Template Pelanggan` |
| Staf HRIS | `downloadStaffTemplate()` | `template_import_staf_komazi.xlsx` | `Template Staf` |
| Jadwal Sif | `downloadScheduleTemplate()` | `template_import_jadwal_komazi.xlsx` | `Template Jadwal` |
| Presensi | `downloadAttendanceTemplate()` | `template_import_absensi_komazi.xlsx` | `Template Presensi` |
| Pembelian Stok | `downloadInboundTemplate()` | `template_import_pembelian_komazi.xlsx` | `Template Pembelian` |
| Stock Opname | `downloadStockOpnameTemplate()` | `template_import_opname_komazi.xlsx` | `Template Opname` |

---

## 3. Logika Validasi & Normalisasi di Peramban

Sebelum data dikirim ke peladen (*server*), fungsi validasi memproses tiap baris secara berurutan:

1. **Pembersihan String ke Numerik:**
   - Menghapus karakter non-digit selain tanda minus dan titik desimal (misal: `"Rp 25.000"` menjadi `25000`).
   - Baris bernilai kosong pada kolom numerik bertoleransi diubah menjadi angka `0`.
2. **Normalisasi Tanggal & Jam:**
   - Memastikan format tanggal mengikuti pola ISO `YYYY-MM-DD`.
   - Memastikan format waktu mengikuti pola 24 jam `HH:mm`.
3. **Preservasi Nomor Telepon:**
   - Membersihkan tanda hubung, spasi, atau tanda kurung.
   - Memastikan digit awalan `0` atau `62` tidak terpotong.
4. **Pemisahan Varian & Harga Varian:**
   - Kolom teks yang dipisahkan tanda koma dipetakan menjadi larik objek varian dengan harga masing-masing.

---

## 4. Spesifikasi Kontrak Endpoint Backend

Seluruh endpoint berikut dilindungi middleware autentikasi JWT (`authenticate`) dan pembatasan peran (`requireRole(['MANAGER', 'OWNER'])`):

| Aksi | Metode & Rute API | Payload Permintaan | Tanggapan Sukses |
| :--- | :--- | :--- | :--- |
| Impor Produk | `POST /api/products/bulk` | `{ products: ProductInput[] }` | `201 Created` `{ count: number, data: Product[] }` |
| Impor Bahan | `POST /api/ingredients/bulk` | `{ ingredients: IngredientInput[] }` | `201 Created` `{ count: number, data: Ingredient[] }` |
| Impor Resep | `POST /api/recipes/bulk` | `{ recipes: RecipeInput[] }` | `200 OK` `{ count: number }` |
| Impor Pelanggan | `POST /api/customers/bulk` | `{ customers: CustomerInput[] }` | `201 Created` `{ count: number, data: Customer[] }` |
| Impor Staf | `POST /api/hris/staff/bulk` | `{ staff: StaffInput[] }` | `201 Created` `{ count: number }` |
| Impor Jadwal | `POST /api/hris/schedules/bulk` | `{ schedules: ScheduleInput[] }` | `201 Created` `{ count: number }` |
| Impor Presensi | `POST /api/hris/attendance/bulk` | `{ attendances: AttendanceInput[] }` | `201 Created` `{ count: number }` |
| Impor Pembelian | `POST /api/inventory/inbound/bulk` | `{ inbounds: InboundInput[] }` | `201 Created` `{ count: number }` |
| Impor Opname | `POST /api/inventory/stock-opname/bulk` | `{ opnames: OpnameInput[] }` | `200 OK` `{ count: number }` |

---

## 5. Keamanan & Penanganan Transaksi Basis Data

1. **Atomisitas Transaksi (`$transaction`):**
   - Tiap operasi penyimpanan massal dibungkus dalam blok transaksi Prisma. Jika salah satu baris memicu kegagalan integritas foreign key atau pelanggaran constraint unik, seluruh mutasi dibatalkan.
2. **Batas Ukuran Beban Permintaan (Payload Limit):**
   - Middleware Express membatasi ukuran body JSON maksimal `10MB` untuk mencegah serangan penolakan layanan (*Denial of Service*).
3. **Pencatatan Log Audit:**
   - Setiap keberhasilan impor massal otomatis mencatat aktivitas ke tabel `AuditLog` atau `HrisAuditLog`, memuat ID pengguna pelaksana, jumlah baris yang berhasil diproses, dan cap waktu kejadian.
