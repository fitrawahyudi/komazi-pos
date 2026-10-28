# IMPLEMENTATION.md
## Komazi POS — Multi-Station KDS & BDS

**Status:** Proposed — menunggu audit source code dan persetujuan implementasi  
**Stack:** React + Vite, Express, Prisma, MySQL, Socket.IO  
**Target:** Satu order induk dan satu struk pelanggan dengan routing item ke KDS Internal, KDS Eksternal, dan BDS Bar.

---

## 1. Tujuan

Menerapkan pemisahan tampilan dan proses produksi berdasarkan station tanpa memecah transaksi keuangan pelanggan.

Satu order dapat berisi item untuk:
- `KITCHEN_INTERNAL`
- `KITCHEN_EXTERNAL`
- `BAR`

Order induk dinyatakan siap hanya setelah seluruh item produksi yang wajib diselesaikan telah berstatus siap.

## 2. Prinsip non-regresi

1. Pertahankan login, role, checkout, pembayaran, diskon, pajak, struk, riwayat, laporan, refund, dan audit log.
2. Jangan membuat pembayaran baru untuk setiap station.
3. Jangan membuat transaksi penjualan duplikat.
4. Jangan mengurangi stok dua kali akibat pemisahan station.
5. Jangan menghapus atau mengganti kolom lama tanpa analisis dampak.
6. Jangan menjalankan migrasi produksi sebelum backup, uji staging, dan persetujuan owner.
7. Jangan mengubah fitur yang tidak terkait dengan kebutuhan multi-station.

## 3. Model data

Audit model Prisma yang sudah ada sebelum menentukan migrasi.

### KitchenStation

- `id`
- `code` — unik
- `name`
- `type` — INTERNAL atau EXTERNAL
- `isActive`
- `createdAt`
- `updatedAt`

Buat tiga station awal:
- `KITCHEN_INTERNAL`
- `KITCHEN_EXTERNAL`
- `BAR`

### Product

Tambahkan relasi station default hanya jika belum tersedia mekanisme routing yang setara.

Produk baru harus memiliki station yang valid. Produk lama yang belum dipetakan tidak boleh otomatis diarahkan ke station yang salah.

### Order

Pertahankan order induk sebagai sumber kebenaran untuk:
- Nomor order
- Pelanggan
- Total
- Status pembayaran
- Diskon dan pajak
- Status keseluruhan
- Riwayat dan audit

Jangan mewajibkan satu station pada order induk karena order dapat memiliki beberapa station.

### OrderItem

Setiap item harus menyimpan atau mereferensikan:
- Order induk
- Produk
- Kuantitas dan harga saat transaksi
- Station tujuan saat order dibuat
- Status produksi
- Waktu mulai dan selesai jika diperlukan
- Informasi pembatalan sesuai kebijakan lama

Station tujuan perlu menjadi snapshot agar perubahan konfigurasi produk tidak mengalihkan order yang sudah dibuat.

Gunakan enum dan relasi sesuai pola penamaan dan tipe ID pada source code aktual. Jangan menambahkan model duplikat jika struktur yang sama sudah tersedia.

## 4. Status produksi

Status yang disarankan:

- `NEW`
- `IN_PROGRESS`
- `READY`
- `CANCELLED`

Status ini harus dipisahkan dari status pembayaran dan status order induk.

### Aturan status order induk

- Semua item wajib produksi selesai: order dapat menjadi `READY`.
- Masih ada item `NEW` atau `IN_PROGRESS`: order belum `READY`.
- Ada item yang dibatalkan: terapkan aturan pembatalan yang sudah berlaku, dengan audit.
- Order yang belum dibayar tidak boleh otomatis dianggap siap hanya karena station mengirim status selesai.
- Refund atau pembatalan setelah produksi dimulai harus mengikuti alur otorisasi yang sudah ada.

Definisikan dengan jelas item mana yang termasuk produksi wajib. Jangan menganggap semua jenis item, seperti biaya layanan atau item non-produksi, membutuhkan station.

## 5. Alur checkout

1. Kasir memilih produk dan jumlah.
2. Backend memvalidasi harga, status produk, station tujuan, dan izin pengguna.
3. Semua item dikelompokkan berdasarkan station tanpa membuat order induk baru.
4. Backend menyimpan order, item, dan informasi produksi secara konsisten dalam transaksi database.
5. Gunakan mekanisme pembayaran yang sudah ada.
6. Setelah order sah untuk dikirim ke produksi, setiap station mendapatkan item yang sesuai.
7. Struk pelanggan tetap memuat semua item dan total transaksi.

Jangan memercayai station yang dikirim frontend tanpa memvalidasinya terhadap konfigurasi produk dan aturan bisnis di backend.

## 6. Express API

Audit dan sesuaikan endpoint yang sudah ada terlebih dahulu. Jangan membuat endpoint duplikat jika fungsi yang sama sudah tersedia.

Kemampuan API yang dibutuhkan:

- Membaca station yang diizinkan untuk pengguna.
- Mengambil item produksi berdasarkan station dan status.
- Memperbarui status produksi dengan otorisasi.
- Membaca progres station pada order induk.
- Membaca detail order sesuai hak akses.
- Mencatat audit perubahan status.

Semua akses harus diverifikasi di server. Staf eksternal tidak boleh membaca atau memperbarui order internal dengan mengubah ID atau parameter request.

## 7. Socket.IO dan sinkronisasi

Gunakan mekanisme autentikasi Socket.IO yang sudah ada.

- Emit event hanya kepada station atau pengguna yang berhak.
- Event membawa identitas order dan item yang diperlukan.
- Hindari mengirim data pelanggan atau transaksi keuangan yang tidak dibutuhkan station.
- Simpan perubahan status di database sebelum memberi tahu klien.
- Tangani koneksi ulang dengan mengambil ulang data dari API.
- Gunakan identitas event atau mekanisme idempotensi untuk menghindari pemrosesan ganda.
- Jangan menjadikan event Socket.IO sebagai satu-satunya sumber kebenaran.

Contoh nama event konseptual:
- `kitchen:item-created`
- `kitchen:item-status-updated`
- `order:production-progress-updated`

Nama akhir harus mengikuti konvensi proyek yang sudah ada.

## 8. Frontend

### POS Kasir

- Tetap satu checkout.
- Menampilkan progres per station.
- Menampilkan status keseluruhan order.
- Tetap mencetak satu struk pelanggan.

### KDS Internal

- Hanya item `KITCHEN_INTERNAL`.
- Mendukung status produksi dan catatan item.
- Menampilkan nomor order induk yang sama.

### KDS Eksternal

- Hanya item `KITCHEN_EXTERNAL` yang diizinkan.
- Tidak memiliki akses ke laporan keuangan atau data POS yang tidak diperlukan.
- Tidak dapat mengubah station tujuan item.

### BDS Bar

- Hanya item `BAR`.
- Menampilkan jumlah, variasi, dan catatan minuman.
- Mendukung status produksi yang konsisten dengan backend.

Jangan mengubah seluruh UI menjadi aplikasi baru jika halaman KDS/BDS yang ada dapat dikembangkan.

## 9. Struk pelanggan

Struk tetap satu per order induk dan mencakup:
- Nomor order
- Seluruh item dari semua station
- Kuantitas dan harga
- Diskon, pajak, dan total sesuai mekanisme lama
- Informasi pembayaran
- Informasi outlet yang sudah digunakan

Label station boleh ditampilkan untuk keperluan operasional jika sesuai desain struk, tetapi bukan sebagai tiga transaksi terpisah.

Jangan mengubah payload QRIS atau mekanisme cetak struk yang sudah berjalan dalam pekerjaan ini.

## 10. Stok, pembayaran, dan pembatalan

- Routing station tidak boleh memicu pembayaran.
- Pertahankan titik pengurangan stok yang berlaku saat ini.
- Pastikan retry checkout tidak membuat order ganda.
- Pastikan item tidak mengurangi stok berulang saat Socket.IO tersambung kembali.
- Pertahankan audit refund dan pembatalan.
- Tetapkan aturan penanganan item yang dibatalkan setelah mulai diproses.
- Jika ada integrasi vendor atau stok bahan baku, audit dampaknya sebelum implementasi.

## 11. Tahapan implementasi

### Tahap A — Audit

- Periksa model Prisma dan migrasi.
- Periksa checkout, pembayaran, status order, stok, refund, dan struk.
- Periksa KDS/BDS dan event Socket.IO.
- Catat file yang perlu diubah dan risiko regresi.

### Tahap B — Backup dan staging

- Backup database produksi.
- Verifikasi backup dapat dipulihkan.
- Siapkan staging dengan salinan data yang aman.
- Jalankan migrasi hanya di staging terlebih dahulu.

### Tahap C — Backend

- Tambahkan konfigurasi station.
- Tambahkan snapshot station pada item bila diperlukan.
- Implementasikan validasi dan otorisasi.
- Implementasikan kalkulasi status order induk.
- Implementasikan event Socket.IO yang aman dan idempoten.

### Tahap D — Frontend

- Perbarui POS, KDS Internal, KDS Eksternal, dan BDS.
- Tambahkan progres station.
- Pertahankan desain dan fitur lama yang tidak terkait.

### Tahap E — Pengujian

- Uji order satu station.
- Uji order tiga station.
- Uji pembayaran dan struk.
- Uji status siap ketika semua station selesai.
- Uji akses vendor, pembatalan, refund, stok, koneksi ulang, dan retry.
- Uji regresi semua fitur utama.

### Tahap F — Rilis

- Sajikan hasil pengujian dan daftar perubahan.
- Minta persetujuan owner.
- Buat backup terbaru sebelum rilis.
- Terapkan perubahan pada waktu yang disetujui.
- Verifikasi health check, log, transaksi, KDS, dan BDS.
- Siapkan prosedur rollback kode dan database.

## 12. Kriteria penerimaan

Implementasi dianggap berhasil jika:

1. Satu order berisi item dari tiga station.
2. Ketiga station hanya melihat item yang menjadi tanggung jawabnya.
3. Pelanggan menerima satu struk dan melakukan satu pembayaran.
4. Status order induk tidak menjadi `READY` sebelum semua item wajib produksi siap.
5. Status setiap station tetap independen.
6. Hak akses vendor terisolasi.
7. Retry dan reconnect tidak menggandakan order atau pengurangan stok.
8. Pembayaran, refund, struk, laporan, dan fitur lama tetap berfungsi.
9. Backup dan rollback sudah diuji.
10. Produksi tidak berubah tanpa persetujuan owner.

## 13. Batas perubahan

Dokumen ini adalah rancangan implementasi. Nama file, nama model, endpoint, dan enum final wajib ditentukan setelah audit source code aktual.

Dilarang mengasumsikan struktur database atau menimpa implementasi lama tanpa pemeriksaan.

**Deployment produksi memerlukan persetujuan eksplisit owner.**