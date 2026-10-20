# implementation.md — Hak Akses dan Keamanan Riwayat Pesanan Komazi POS

**Modul:** Riwayat Pesanan  
**Prioritas:** Tinggi  
**Status:** Spesifikasi implementasi  
**Target:** Antigravity / Gemini Code Assistant

## 1. Tujuan

Implementasikan sistem hak akses Riwayat Pesanan pada Komazi POS agar semua kasir dapat melihat riwayat transaksi, tetapi tidak dapat memanipulasi transaksi yang telah diselesaikan.

Stack aplikasi:

- Frontend: React + Vite + Capacitor.
- Backend: Node.js + Express.
- ORM: Prisma.
- Database: MySQL.
- Deployment: Vercel untuk frontend dan Railway untuk backend serta database.

**Instruksi utama:** audit source code aktual sebelum mengubah kode. Pertahankan seluruh fitur lama, struktur database, autentikasi, sistem role, transaksi pembayaran, sesi kasir, persediaan, KDS/BDS, dan laporan yang sudah berjalan.

Jangan mengasumsikan nama model, endpoint, status pesanan, atau struktur middleware tanpa memeriksa repository.

---

## 2. Kebijakan hak akses

Terapkan aturan berikut sebagai target perilaku aplikasi.

| Aksi | Kasir pemilik pesanan | Kasir lain | Owner/Admin berwenang |
|---|---|---|---|
| Melihat daftar riwayat | Ya | Ya | Ya |
| Melihat detail pesanan | Ya | Ya | Ya |
| Melihat total dan rincian item | Ya | Ya | Ya |
| Melihat informasi pembayaran yang relevan | Ya | Ya | Ya |
| Cetak ulang struk | Ya | Ya | Ya |
| Edit pesanan yang belum dibayar | Ya, sesuai status | Tidak, kecuali pengalihan resmi | Sesuai izin |
| Edit pesanan yang sudah dibayar | Tidak | Tidak | Tidak secara langsung |
| Menghapus transaksi selesai | Tidak | Tidak | Tidak secara langsung |
| Membatalkan transaksi | Sesuai kebijakan dan status | Sesuai kebijakan dan status | Sesuai izin |
| Melakukan refund | Hanya jika diberi izin | Hanya jika diberi izin | Sesuai izin |
| Melihat audit trail | Sesuai izin | Sesuai izin | Sesuai izin |

Owner/Admin tidak otomatis boleh mengubah transaksi yang sudah dibayar secara langsung. Koreksi transaksi harus melalui prosedur yang dapat diaudit.

Role Admin harus mengikuti permission aktual aplikasi. Jangan memperluas hak akses Admin secara diam-diam.

### Prinsip dasar

1. Semua kasir dapat melihat riwayat pesanan seluruh kasir.
2. Kepemilikan pesanan tidak memberikan hak untuk memodifikasi transaksi yang sudah selesai.
3. Pesanan yang belum dibayar hanya dapat diedit oleh kasir penanggung jawab, kecuali ada mekanisme pengalihan resmi.
4. Transaksi yang sudah dibayar tidak dapat diedit atau dihapus oleh kasir.
5. Refund dan pembatalan harus mengikuti aturan status transaksi dan otorisasi yang berlaku.
6. Semua validasi wajib dilakukan di backend.
7. Data transaksi historis tidak boleh dihapus hanya untuk memperbaiki kesalahan.

---

## 3. Audit source code sebelum implementasi

Periksa bagian berikut:

- Model pesanan dan item pesanan di Prisma.
- Relasi pesanan dengan pengguna atau kasir pembuat.
- Status pesanan, pembayaran, pembatalan, dan refund.
- Alur checkout dan konfirmasi pembayaran.
- Sistem penggabungan bill jika tersedia.
- Sistem sesi kasir dan identitas kasir yang sedang bertugas.
- Endpoint riwayat pesanan dan detail pesanan.
- Endpoint edit, hapus, cancel, refund, dan cetak struk.
- Middleware autentikasi dan otorisasi.
- Komponen React untuk riwayat pesanan dan detail transaksi.
- Sistem persediaan, HPP, dan mutasi stok.
- Integrasi KDS/BDS.
- Sistem laporan dan audit log.

Buat `implementation-audit.md` yang mencatat:

1. Model dan relasi yang sudah ada.
2. Status pesanan dan transisi status yang sah.
3. Endpoint serta komponen yang perlu disesuaikan.
4. Risiko perubahan terhadap transaksi dan laporan.
5. Migration yang diperlukan, jika ada.
6. Daftar pengujian regresi.

Lanjutkan implementasi setelah audit selesai. Jangan berhenti hanya dengan menghasilkan laporan.

---

## 4. Aturan berdasarkan status pesanan

Jangan membuat status baru jika status yang setara sudah tersedia. Petakan aturan berikut ke status aktual aplikasi.

### A. Pesanan terbuka atau belum dibayar

- Kasir pemilik pesanan boleh melihat dan mengedit sesuai status.
- Kasir lain hanya dapat melihat.
- Pengeditan harus ditolak jika pembayaran sudah dimulai atau status sudah berubah sehingga pengeditan tidak lagi aman.
- Jika pesanan perlu dialihkan ke kasir lain, gunakan mekanisme pengalihan yang tercatat.
- Jangan mengizinkan penggantian pemilik pesanan hanya dengan mengubah ID kasir melalui request.

### B. Pesanan sudah dibayar atau selesai

- Semua kasir boleh melihat detail pesanan.
- Semua kasir boleh mencetak ulang struk.
- Kasir tidak boleh mengubah item, harga, diskon, pajak, total, metode pembayaran, atau waktu transaksi.
- Kasir tidak boleh menghapus pesanan.
- Kasir tidak boleh mengembalikan status pesanan ke status terbuka.
- Perubahan administratif yang benar-benar diperlukan harus melalui prosedur koreksi resmi yang memiliki audit trail.

### C. Pesanan dibatalkan

- Riwayat tetap tersedia.
- Detail pembatalan dan alasan pembatalan ditampilkan sesuai permission.
- Pesanan yang sudah dibatalkan tidak dapat diedit atau diaktifkan kembali secara langsung oleh kasir.
- Jika pesanan perlu diproses kembali, gunakan alur resmi yang sesuai dengan sistem saat ini.

### D. Pesanan direfund

- Transaksi asli tetap dipertahankan.
- Refund dicatat sebagai transaksi atau peristiwa tersendiri sesuai arsitektur yang ada.
- Nominal refund tidak boleh melebihi nominal yang dapat direfund.
- Refund berulang tidak boleh menggandakan pengembalian dana.
- Status refund harus konsisten dengan catatan pembayaran dan laporan.
- Refund tidak boleh dilakukan hanya dengan mengubah status pesanan menjadi `REFUNDED` tanpa pencatatan dampak finansial.

---

## 5. Implementasi frontend

Sesuaikan halaman Riwayat Pesanan yang sudah ada. Jangan membuat halaman duplikat jika modulnya telah tersedia.

### A. Daftar riwayat

Semua kasir dapat melihat daftar pesanan dari seluruh kasir.

Informasi yang disarankan:

- Nomor pesanan.
- Tanggal dan waktu.
- Nama kasir penanggung jawab.
- Nama atau nomor meja jika tersedia.
- Jenis pesanan.
- Jumlah item.
- Total pembayaran.
- Status pesanan.
- Status pembayaran.
- Tombol detail.
- Tombol cetak ulang struk.

Gunakan pagination dan filter periode untuk mencegah pemuatan seluruh data sekaligus.

### B. Filter

Sediakan filter yang relevan:

- Nomor pesanan.
- Rentang tanggal.
- Kasir.
- Status pesanan.
- Status pembayaran.
- Jenis pesanan.

Filter kasir digunakan untuk pencarian, bukan untuk membatasi kasir hanya pada transaksi miliknya.

### C. Halaman detail

Semua kasir dapat melihat:

- Item dan kuantitas.
- Harga dan diskon.
- Pajak atau biaya tambahan jika ada.
- Total akhir.
- Informasi pembayaran yang relevan.
- Kasir penanggung jawab.
- Waktu transaksi.
- Status pesanan.
- Riwayat pembatalan atau refund sesuai permission.

Jangan tampilkan data sensitif yang tidak diperlukan, seperti credential, token, atau data pembayaran rahasia.

### D. Tombol tindakan

Tampilkan tombol berdasarkan status dan permission.

Contoh:

**Pesanan selesai**
- Detail.
- Cetak ulang struk.

**Pesanan belum dibayar milik kasir aktif**
- Detail.
- Edit, jika status masih memungkinkan.

**Pesanan belum dibayar milik kasir lain**
- Detail saja.

**Pesanan yang memerlukan refund atau pembatalan**
- Tampilkan tindakan hanya jika role dan status mengizinkan.

Menyembunyikan tombol hanya untuk UX. Backend tetap harus menolak request yang tidak sah.

### E. Pesan error

Jika kasir mencoba melakukan tindakan yang tidak diizinkan, tampilkan pesan yang jelas, misalnya:

- "Pesanan milik kasir lain hanya dapat dilihat."
- "Pesanan yang sudah dibayar tidak dapat diedit."
- "Transaksi tidak dapat dihapus. Gunakan prosedur pembatalan atau koreksi yang tersedia."
- "Anda tidak memiliki izin untuk melakukan refund."

Jangan menampilkan stack trace atau informasi internal backend.

---

## 6. Implementasi backend

Gunakan router, controller, service, validasi, dan middleware yang sudah ada.

### A. Riwayat pesanan

Pastikan endpoint daftar pesanan mengembalikan semua transaksi yang memang boleh dilihat kasir, bukan hanya pesanan yang dibuat oleh pengguna yang sedang login.

Jangan menghilangkan filter keamanan yang diperlukan untuk tenant, cabang, atau outlet jika struktur tersebut ada di aplikasi.

### B. Detail pesanan

Semua kasir dapat membaca detail pesanan sesuai cakupan akses aplikasi.

Backend wajib memvalidasi:

- Token autentikasi.
- Status akun.
- Role dan permission.
- Cakupan outlet jika berlaku.
- Keberadaan pesanan.

Jangan mengandalkan ID pesanan dari frontend sebagai bukti otorisasi.

### C. Endpoint edit

Untuk setiap endpoint edit pesanan:

1. Ambil pengguna terautentikasi dari middleware.
2. Ambil pesanan dari database.
3. Validasi kepemilikan atau mekanisme pengalihan resmi.
4. Periksa status pesanan dan pembayaran.
5. Tolak perubahan jika pesanan telah dibayar atau selesai.
6. Validasi perubahan terhadap seluruh aturan transaksi.
7. Jalankan operasi secara atomik jika melibatkan beberapa tabel.

Jika endpoint edit saat ini mengizinkan perubahan pesanan selesai, ubah perilakunya agar sesuai dengan kebijakan ini tanpa merusak edit pesanan terbuka yang masih sah.

### D. Endpoint hapus

Cari seluruh endpoint penghapusan pesanan.

Untuk transaksi selesai:

- Tolak penghapusan langsung.
- Jangan menghapus item pesanan, pembayaran, atau histori secara cascading.
- Jangan menggunakan soft delete sebagai cara untuk menyembunyikan transaksi finansial.
- Gunakan prosedur pembatalan atau reversal yang sesuai jika transaksi memang harus dikoreksi.

Jika terdapat fitur hapus untuk pesanan draft, pertahankan hanya jika statusnya memang aman dan tidak ada transaksi pembayaran atau mutasi stok yang sudah terikat.

### E. Pembatalan dan refund

Pertahankan alur pembatalan dan refund yang sudah ada jika aman.

Jika alur tersebut belum tersedia, dokumentasikan kebutuhan dan implementasikan secara terpisah dengan:

- Permission yang jelas.
- Pemeriksaan status sebelum tindakan.
- Validasi nominal.
- Pencegahan permintaan ganda.
- Pencatatan alasan.
- Audit trail.
- Penanganan pembayaran dan persediaan.
- Integrasi dengan penyedia pembayaran jika transaksi memakai payment gateway.

Jangan menganggap pengubahan status pesanan sebagai refund uang yang benar-benar berhasil.

### F. Konsistensi transaksi

Untuk perubahan yang memengaruhi beberapa tabel, gunakan transaksi database dan mekanisme concurrency control yang sesuai.

Periksa kembali status pesanan di dalam operasi yang aman dari race condition. Jangan hanya melakukan pemeriksaan awal di frontend.

Gunakan constraint database dan idempotency key jika sesuai dengan alur transaksi yang sudah ada.

---

## 7. Keamanan pengeditan dan penggabungan bill

Jika Komazi POS memiliki fitur gabung bill:

- Tentukan pesanan utama dan pesanan sumber secara eksplisit.
- Validasi kepemilikan dan status setiap pesanan.
- Jangan menggabungkan pesanan yang sudah dibayar melalui endpoint edit biasa.
- Jangan menggabungkan transaksi yang sudah direfund atau dibatalkan.
- Pastikan item, pembayaran, dan referensi transaksi tidak terduplikasi.
- Catat hubungan antara pesanan sebelum dan sesudah penggabungan.
- Terapkan aturan yang sama pada web dan aplikasi Android.

Jika fitur penggabungan bill sudah memiliki kebijakan sendiri, audit dan pertahankan perilaku yang sah. Jangan mengubahnya tanpa menguji dampak terhadap laporan dan persediaan.

---

## 8. Audit trail

Catat tindakan penting berikut:

- Perubahan pesanan yang masih terbuka.
- Pengalihan tanggung jawab pesanan.
- Permintaan edit yang ditolak jika sesuai dengan kebijakan logging.
- Pembatalan.
- Refund.
- Koreksi administratif.
- Perubahan yang berdampak pada persediaan.
- Perubahan yang berdampak pada pembayaran atau laporan.

Informasi audit minimal:

- Waktu kejadian.
- Pengguna yang melakukan tindakan.
- ID pesanan.
- Jenis tindakan.
- Nilai sebelum dan sesudah jika terjadi perubahan.
- Alasan tindakan.
- Status hasil.
- Referensi transaksi terkait.

Gunakan audit log yang sudah ada. Jangan membuat sistem audit duplikat tanpa kebutuhan teknis.

Jangan mencatat token, password, atau data sensitif lainnya.

---

## 9. Pengujian wajib

Gunakan database lokal atau staging dan akun uji Kasir A, Kasir B, Owner, serta Admin sesuai konfigurasi aktual.

### A. Pengujian visibilitas

1. Kasir A dapat melihat pesanan milik Kasir A.
2. Kasir A dapat melihat pesanan milik Kasir B.
3. Kasir B dapat melihat pesanan milik Kasir A.
4. Kasir B dapat membuka detail pesanan milik Kasir A.
5. Filter kasir tidak menghilangkan data yang memang berhak dilihat.
6. Pembatasan outlet tetap berjalan jika aplikasi mendukung multi-outlet.

### B. Pengujian edit

1. Kasir A dapat mengedit pesanan terbuka miliknya jika status mengizinkan.
2. Kasir A tidak dapat mengedit pesanan terbuka milik Kasir B.
3. Kasir B tidak dapat mengedit pesanan terbuka milik Kasir A.
4. Kasir A tidak dapat mengedit pesanan yang sudah dibayar.
5. Kasir B tidak dapat mengedit pesanan yang sudah dibayar milik Kasir A.
6. Memanggil endpoint secara langsung tetap ditolak meskipun tombol frontend dimanipulasi.
7. Pesanan yang statusnya berubah saat proses edit berlangsung tidak boleh mengalami perubahan yang tidak sah.

### C. Pengujian hapus

1. Kasir A tidak dapat menghapus transaksi selesai miliknya.
2. Kasir A tidak dapat menghapus transaksi selesai milik Kasir B.
3. Kasir B tidak dapat menghapus transaksi selesai milik Kasir A.
4. Endpoint penghapusan tidak dapat digunakan untuk menghilangkan histori pembayaran.
5. Pesanan draft yang boleh dihapus tetap dapat ditangani sesuai aturan yang berlaku.

### D. Pengujian refund dan pembatalan

1. Pengguna tanpa izin tidak dapat melakukan refund.
2. Refund yang melebihi nominal yang dapat dikembalikan ditolak.
3. Permintaan refund ganda tidak menggandakan pengembalian dana.
4. Pembatalan tidak menghapus riwayat pesanan.
5. Stok dan laporan diperbarui sesuai aturan transaksi.
6. Status pesanan tetap konsisten dengan status pembayaran.

### E. Pengujian regresi

Pastikan fitur lama tetap berjalan:

- Login dan logout.
- Seluruh role yang ada.
- Checkout dan pembayaran.
- Sesi kasir.
- Riwayat pesanan.
- Penggabungan bill.
- Persediaan dan bahan baku.
- KDS/BDS.
- Cetak struk.
- Laporan penjualan dan HPP.
- Presensi dan HRIS.
- Notifikasi.
- API yang digunakan aplikasi Android Capacitor.

Jalankan unit test, integration test, lint, type check jika tersedia, dan build production menggunakan script yang ditemukan di `package.json`.

Laporkan hasil sebenarnya. Jangan mengklaim tes berhasil jika belum dijalankan.

---

## 10. Migration dan deployment

### Database

- Jangan membuat ulang database.
- Jangan menjalankan reset database.
- Jangan menghapus transaksi historis.
- Tambahkan kolom, relasi, atau indeks hanya jika diperlukan oleh hasil audit.
- Jangan membuat migration untuk perubahan yang sebenarnya cukup ditangani oleh authorization di backend.
- Uji migration di lokal atau staging sebelum production.

### Deployment

1. Backup database.
2. Jalankan pengujian.
3. Deploy backend.
4. Verifikasi endpoint riwayat, edit, pembatalan, dan refund.
5. Deploy frontend.
6. Uji akun Kasir A dan Kasir B.
7. Uji web dan APK Android.
8. Periksa log backend.
9. Verifikasi tidak ada perubahan tak terduga pada data transaksi.

### Rollback

Jika terjadi masalah:

- Kembalikan versi kode sebelumnya bila diperlukan.
- Jangan langsung menghapus migration yang sudah diterapkan.
- Jangan memulihkan backup production tanpa menilai transaksi terbaru.
- Buat migration korektif jika perubahan skema perlu diperbaiki.
- Verifikasi kembali hak akses dan konsistensi data.

---

## 11. Kriteria penerimaan akhir

Implementasi dianggap selesai jika:

- [ ] Semua kasir dapat melihat seluruh riwayat pesanan yang berada dalam cakupan aksesnya.
- [ ] Semua kasir dapat membuka detail pesanan kasir lain.
- [ ] Kasir tidak dapat mengedit pesanan milik kasir lain.
- [ ] Kasir tidak dapat mengedit transaksi yang sudah dibayar atau selesai.
- [ ] Transaksi selesai tidak dapat dihapus secara langsung.
- [ ] Pesanan terbuka tetap dapat diedit oleh pemiliknya sesuai status.
- [ ] Pembatalan dan refund mengikuti permission serta status transaksi.
- [ ] Backend memvalidasi seluruh tindakan sensitif.
- [ ] Audit trail mencatat tindakan penting.
- [ ] Riwayat transaksi tetap utuh.
- [ ] Laporan dan persediaan tidak mengalami penghitungan ganda.
- [ ] Web dan APK Android tetap berfungsi.
- [ ] Pengujian regresi selesai dan hasilnya didokumentasikan.

---

## 12. Instruksi akhir untuk Antigravity/Gemini

Baca repository Komazi POS secara menyeluruh, lalu implementasikan spesifikasi ini berdasarkan arsitektur dan aturan transaksi yang benar-benar ditemukan.

Jangan berhenti pada analisis, mockup, atau dokumentasi saja. Lakukan perubahan source code, pengujian, dan perbaikan sesuai akses lingkungan yang tersedia.

Setelah selesai, berikan laporan:

1. File yang dibuat dan diubah.
2. Perubahan authorization frontend dan backend.
3. Endpoint yang disesuaikan.
4. Migration yang dibuat, jika ada.
5. Hasil pengujian dan build.
6. Perilaku yang belum dapat diimplementasikan.
7. Langkah deployment yang aman.

**Hasil akhir:** Riwayat Pesanan Komazi POS transparan bagi kasir, terlindungi dari manipulasi, mempertahankan histori transaksi, dan tetap kompatibel dengan alur pembayaran, persediaan, laporan, serta aplikasi Android yang sudah berjalan.
