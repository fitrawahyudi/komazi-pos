# Intent: Sistem Impor & Ekspor Spreadsheet Excel/CSV Komazi POS

## 1. Latar Belakang & Masalah

Pengelola gerai F&B yang bermigrasi ke Komazi POS umumnya membawa ratusan data dari aplikasi kasir lama, catatan spreadsheet mandiri, atau pembukuan fisik. Mengisi data satu per satu melalui formulir antarmuka memakan waktu berjam-jam dan rentan salah ketik.

Kendala utama saat pengelola gerai menyiapkan data spreadsheet:
- **Format data tidak seragam:** Kolom harga sering kali memuat teks `"Rp"`, titik ribuan, atau spasi; nomor WhatsApp kehilangan angka nol di depan karena format angka otomatis pada Excel; dan tanggal dicatat dalam berbagai format non-standar.
- **Ketiadaan validasi awal:** Berkas spreadsheet yang langsung diunggah ke server tanpa pengecekan awal di peramban (*browser*) sering menggagalkan seluruh transaksi atau menghasilkan data setengah tersimpan yang sulit dilacak.
- **Kesulitan melacak baris bermasalah:** Pengguna tidak mendapat petunjuk jelas mengenai nomor baris dan nama kolom yang menyebabkan impor gagal.
- **Struktur kolom tidak baku:** Tanpa panduan warna dan baris contoh, pengguna kerap mengubah judul kolom atau menukar urutan data.

Sistem membutuhkan mekanisme impor dan ekspor data massal yang cepat, aman, dan memandu pengguna sejak tahap pengisian berkas hingga konfirmasi penyimpanan.

---

## 2. Pengguna Sasaran & Hak Akses (RBAC)

| Peran Pengguna | Hak Akses Impor | Hak Akses Ekspor | Modul yang Dapat Dikelola |
| :--- | :---: | :---: | :--- |
| `OWNER` | Penuh | Penuh | Seluruh modul (Menu, Bahan Baku, Resep, Pelanggan, Staf, Jadwal, Presensi, Pembelian, Stock Opname, Laporan). |
| `MANAGER` | Terbatas | Penuh | Menu, Bahan Baku, Resep, Pelanggan, Jadwal Sif, Presensi, Pembelian, dan Stock Opname (tidak dapat mengimpor akun bertingkat Owner). |
| `CASHIER` / `BARISTA` / `KITCHEN` | Ditolak | Terbatas | Hanya ekspor laporan sesi sif kasir mandiri atau tiket pesanan harian. |

---

## 3. Hasil yang Ditetapkan (Confirmed Outcomes)

1. **Pengunduhan Template Resmi Berkode Warna:**
   - Pengguna dapat mengunduh berkas template `.xlsx` resmi langsung dari setiap modul terkait.
   - Header kolom menggunakan kode warna standar industri untuk membedakan kolom wajib, referensi master data, numerik, dan opsional.
   - Berkas menyertakan baris contoh data nyata agar pengguna memahami format tanpa perlu membaca panduan terpisah.

2. **Validasi Mandiri di Peramban (*Client-Side Pre-validation*):**
   - Berkas `.xlsx`, `.xls`, atau `.csv` dibaca dan divalidasi langsung di sisi klien menggunakan library `xlsx` sebelum dikirim ke server.
   - Sistem otomatis membersihkan format angka (menghapus karakter `"Rp"`, spasi, dan titik ribuan) serta memastikan nomor telepon tetap mempertahankan angka nol di depan.

3. **Pratinjau Interaktif dengan Toleransi Parsial (*Partial Tolerance*):**
   - Modal menampilkan tabel pratinjau status baris: jumlah baris valid (badge hijau) dan jumlah baris bermasalah (badge merah beserta alasan galatnya).
   - Pengguna dapat memilih untuk tetap memproses baris yang valid dan melewati (*skip*) baris bermasalah tanpa membatalkan seluruh proses.

4. **Transaksi Basis Data Atomik:**
   - Server memproses data massal dalam transaksi Prisma (`$transaction`). Jika terjadi kegagalan integritas basis data, seluruh perubahan pada batch tersebut dibatalkan secara bersih.

5. **Ekspor Instan Sesuai Karakteristik Excel Indonesia:**
   - Data aktif pada tabel dapat diekspor langsung ke berkas `.xlsx` atau `.csv`.
   - Format CSV menyertakan UTF-8 BOM dan pemisah titik-koma (`;`) agar kolom terbuka terpisah rapi saat diakses langsung pada Microsoft Excel berbahasa Indonesia.

---

## 4. Cakupan Modul Operasional

Sistem impor dan ekspor spreadsheet mencakup 9 modul operasional:

| No | Modul | Rute Halaman | Entitas Data Utama | Kolom Validasi Kritis |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Katalog Menu & Produk** | `/menu` | `Product`, `ProductVariant` | Nama produk, kategori, harga jual, SKU unik, varian, stasiun dapur (`BAR`/`KITCHEN`). |
| 2 | **Stok Bahan Baku** | `/stock` | `Ingredient`, `StockMovement` | Nama bahan, satuan (`gram`/`ml`/`pcs`/`kg`), stok awal, stok minimum, harga modal satuan. |
| 3 | **Resep & Komposisi (BOM)** | `/menu` (Resep) | `ProductRecipeItem` | Relasi produk, varian target, bahan baku, jumlah takaran per porsi. |
| 4 | **Pelanggan & Loyalty CRM** | `/customers` | `Customer` | Nama lengkap, nomor WhatsApp unik, saldo poin awal, tier (`SILVER`/`GOLD`/`PLATINUM`). |
| 5 | **Data Pegawai HRIS** | `/hris/staff` | `User` | Nama lengkap, username unik, password awal, peran sistem, gaji pokok, uang makan, tarif lembur. |
| 6 | **Jadwal Sif Staf** | `/hris/schedule` | `StaffSchedule` | Username staf, tanggal penugasan (`YYYY-MM-DD`), nama sif (`PAGI`/`SIANG`/`MALAM`/`LIBUR`), jam mulai, jam selesai. |
| 7 | **Presensi Retroaktif** | `/hris/attendance` | `StaffAttendance` | Username staf, tanggal, jam masuk, jam pulang, status kehadiran (`PRESENT`/`LATE`/`OVERTIME`/`ABSENT`). |
| 8 | **Pemasok & Pembelian** | `/inventory/inbound` | `StockMovement` | Nama supplier, nomor surat jalan, tanggal pembelian, bahan baku, jumlah masuk, harga beli satuan. |
| 9 | **Stock Opname Fisik** | `/inventory/stock-opname` | `StockMovement` | Nama bahan baku, jumlah fisik riil, alasan selisih (`WASTE`/`LOSS`/`COUNT_ERROR`), catatan audit. |

---

## 5. Kriteria Keberhasilan Terukur

1. **Kinerja Parsing:** Berkas dengan 500 baris data selesai diparsing dan divalidasi di peramban dalam waktu kurang dari 1 detik.
2. **Koreksi Otomatis String ke Angka:** Nilai seperti `"25.000"` atau `"Rp 25000"` otomatis dinormalisasi menjadi angka murni `25000` tanpa memicu galat `NaN`.
3. **Preservasi Nomor Telepon:** Format nomor telepon seperti `'081234567890` atau `6281234567890` tersimpan utuh tanpa kehilangan digit nol di awal.
4. **Kejelasan Pesan Kesalahan:** Bila baris gagal divalidasi, antarmuka menyebutkan secara spesifik nomor baris dan nama kolom yang salah (contoh: *"Baris 4: Harga Jual tidak boleh bernilai negatif"*).
5. **Penyegaran Data Tanpa Muat Ulang Halaman:** Setelah impor berhasil, tabel data di antarmuka langsung diperbarui menggunakan pemanggilan *state store* lokal tanpa memuat ulang seluruh halaman peramban.

---

## 6. Batasan & Hal di Luar Lingkup (Out of Scope)

- **Formula Dinamis Excel:** Sistem hanya membaca nilai hasil evaluasi akhir sel. Formula rumit seperti `=VLOOKUP()` atau tautan ke berkas luar tidak dievaluasi oleh parser.
- **Berkas Berekstensi `.xlsm`:** Sistem menolak berkas spreadsheet yang memuat skrip makro VBA demi mencegah risiko keamanan.
- **Batas Ukuran Berkas:** Ukuran berkas dibatasi maksimal 5 MB atau setara 2.000 baris per satu kali transaksi unggah.
- **Sinkronisasi Dua Arah Otomatis:** Sistem tidak mendukung tautan live dua arah dengan Google Sheets atau Microsoft 365 Cloud. Seluruh proses impor dilakukan manual berbasis unggah berkas.
