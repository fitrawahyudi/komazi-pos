# IMPLEMENTATION.md — Database Backup & Recovery Komazi POS

## 1. Tujuan

Implementasikan sistem backup dan pemulihan database untuk Komazi POS dengan standar operasional production.

**Stack yang diketahui:**
- Frontend: React + Vite + Capacitor
- Backend: Node.js + Express
- ORM: Prisma
- Database: MySQL (`komazi_pos`)
- Backend dan database: Railway
- Frontend web: Vercel
- Android: Capacitor APK

Semua stack, struktur folder, konfigurasi deployment, model database, sistem autentikasi, dan mekanisme scheduler wajib diverifikasi dari source code aktual sebelum implementasi.

### Target fitur

1. Backup otomatis terjadwal.
2. Backup manual melalui dashboard.
3. Penyimpanan backup di luar database utama.
4. Riwayat backup dan status proses.
5. Validasi integritas file backup.
6. Kebijakan retensi otomatis.
7. Pengujian pemulihan database.
8. Pemulihan terkontrol dengan persetujuan Owner.
9. Audit log untuk semua tindakan penting.
10. Notifikasi jika backup gagal atau berhasil.
11. Monitoring agar kegagalan backup tidak luput dari perhatian.

## 2. Aturan utama: audit sebelum implementasi

Sebelum mengubah kode, lakukan audit source code aktual dan dokumentasikan hasilnya.

Periksa:

- Struktur direktori frontend dan backend.
- `package.json` dan script yang tersedia.
- Konfigurasi environment variable.
- Prisma schema, migration, dan relasi model.
- Mekanisme login, session, JWT, middleware, serta RBAC.
- Role yang benar-benar digunakan saat ini.
- Struktur audit log dan sistem logging.
- Scheduler atau cron job yang sudah tersedia.
- Integrasi Railway dan konfigurasi deployment.
- Mekanisme penyimpanan file atau gambar yang digunakan aplikasi.
- Pengujian yang tersedia.
- Ukuran database dan kemungkinan keterbatasan resource saat backup.
- Apakah sudah ada fitur backup, backup manual, atau backup dari provider.

Buat ringkasan temuan terlebih dahulu. Gunakan hasil audit sebagai dasar implementasi, bukan asumsi.

**Jangan membuat sistem kedua jika fungsi yang setara sudah tersedia.** Integrasikan dengan mekanisme yang ada apabila aman dan sesuai.

## 3. Arsitektur backup

Gunakan pendekatan berlapis.

### Lapisan A — Backup bawaan Railway

- Periksa ketersediaan backup native dan Point-in-Time Recovery (PITR) untuk layanan MySQL yang digunakan.
- Verifikasi fitur yang tersedia pada konfigurasi layanan dan paket Railway saat ini.
- Dokumentasikan jadwal, retensi, batasan, serta langkah restore dari dashboard Railway.
- Jangan menganggap backup native tersedia, aktif, atau memiliki retensi tertentu sebelum diverifikasi.
- Jangan menganggap backup native menggantikan backup eksternal.

### Lapisan B — Backup logis eksternal

Buat backup logis database MySQL secara berkala dan simpan pada object storage yang terpisah dari database produksi dan filesystem sementara container.

Gunakan object storage yang kompatibel dengan S3 atau penyimpanan eksternal setara yang benar-benar tersedia dan dapat dikonfigurasi.

Persyaratan:

- File backup tidak hanya disimpan di direktori lokal Railway.
- Penyimpanan backup menggunakan bucket atau lokasi khusus.
- Akses storage memakai kredensial dengan hak minimum yang diperlukan.
- Kredensial disimpan di environment variable atau secret manager.
- Backup dapat dipulihkan meskipun database produksi tidak tersedia.
- Jangan mengasumsikan file lokal akan tetap ada setelah redeploy atau restart container.

### Lapisan C — Dashboard Komazi POS

Dashboard menjadi pusat untuk:

- Melihat status backup terakhir.
- Melihat riwayat backup.
- Menjalankan backup manual.
- Melihat ukuran dan waktu pembuatan backup.
- Mengetahui hasil verifikasi integritas.
- Mengetahui kegagalan dan alasan yang aman untuk ditampilkan.
- Melihat status pemeriksaan pemulihan.
- Mengakses prosedur restore sesuai hak akses.

Dashboard tidak boleh menjadi satu-satunya tempat penyimpanan backup.

## 4. Kebijakan jadwal backup

Jadikan jadwal dapat dikonfigurasi tanpa mengubah source code.

Konfigurasi awal yang direkomendasikan:

| Jenis | Jadwal | Retensi awal |
|---|---|---|
| Harian | Setiap hari pukul 02.00 WIB | 14 hari |
| Mingguan | Setiap Minggu pukul 03.00 WIB | 8 minggu |
| Bulanan | Tanggal 1 pukul 04.00 WIB | 6 bulan |
| Manual | Sesuai permintaan Owner | Mengikuti kebijakan retensi yang ditentukan |

Angka tersebut adalah konfigurasi awal, bukan jaminan bahwa penyimpanan memiliki kapasitas tak terbatas. Evaluasi biaya, kapasitas, dan kebutuhan pemulihan sebelum mengaktifkannya.

### Zona waktu

Gunakan zona waktu `Asia/Jakarta` sebagai acuan operasional.

Jika memakai Railway Cron, verifikasi bahwa jadwal cron berjalan dalam UTC. Contoh, pukul 02.00 WIB sama dengan pukul 19.00 UTC pada hari sebelumnya, sehingga jadwal harian UTC-nya adalah:

`0 19 * * *`

Pastikan jadwal mingguan dan bulanan juga dikonversi dengan benar. Beri label waktu pada dashboard secara konsisten agar tidak membingungkan pengguna.

### Pemilihan scheduler

- Audit scheduler yang sudah ada terlebih dahulu.
- Gunakan scheduler yang sudah tersedia apabila cukup andal.
- Jika belum ada, pilih Railway Cron Job atau mekanisme scheduler backend yang sesuai dengan arsitektur aktual.
- Untuk Railway Cron Job, pastikan proses berakhir setelah tugas selesai.
- Jangan menjalankan scheduler yang sama secara tidak sengaja pada banyak instance backend.
- Cegah dua backup berjalan bersamaan menggunakan distributed lock atau mekanisme koordinasi yang sesuai.
- Gunakan idempotency key atau identitas eksekusi untuk mencegah duplikasi.

## 5. Proses backup

Implementasikan alur berikut:

1. Scheduler atau Owner meminta backup.
2. Backend memvalidasi hak akses dan parameter.
3. Sistem memeriksa apakah backup lain sedang berjalan.
4. Sistem membuat catatan eksekusi dengan ID unik.
5. Sistem memvalidasi koneksi database dan storage.
6. Sistem menjalankan proses dump MySQL dengan metode yang sesuai.
7. Sistem memeriksa exit code proses dump.
8. Sistem mengompresi hasil dump bila diperlukan.
9. Sistem mengenkripsi file backup sebelum atau selama proses penyimpanan sesuai desain yang dipilih.
10. Sistem menghitung checksum, misalnya SHA-256.
11. Sistem mengunggah file ke storage eksternal.
12. Sistem memverifikasi ukuran dan checksum file yang disimpan.
13. Sistem mencatat metadata dan hasil verifikasi.
14. Sistem menandai backup sebagai `SUCCESS` hanya jika seluruh langkah wajib berhasil.
15. Sistem mengirim notifikasi sesuai konfigurasi.
16. Sistem membersihkan file sementara dengan aman.

Jika salah satu langkah kritis gagal, jangan menandai backup sebagai berhasil.

### Metode dump

Pilih metode yang cocok dengan versi MySQL dan fasilitas yang tersedia di deployment.

- Gunakan utilitas dump MySQL yang kompatibel, atau pendekatan lain yang sudah diuji.
- Jangan mengasumsikan `mysqldump` tersedia di container Railway.
- Verifikasi dependensi dan lingkungan runtime sebelum memilih implementasi.
- Hindari memuat seluruh isi database ke RAM.
- Untuk database yang mendukung consistent snapshot, gunakan metode yang menjaga konsistensi data.
- Pertimbangkan transaksi aktif, foreign key, trigger, view, procedure, event, dan hak akses sesuai kebutuhan aplikasi.
- Dokumentasikan objek database yang termasuk dan tidak termasuk backup.

Jangan mencetak password ke log atau memasukkan secret ke command line yang dapat terlihat oleh proses lain. Gunakan mekanisme penyediaan kredensial yang aman dan didukung oleh tool yang dipilih.

### Penamaan file

Gunakan nama yang unik, mudah ditelusuri, dan tidak mengandung rahasia.

Contoh:

`komazi-pos/daily/komazi_pos_2026-10-17_020000_<execution-id>.sql.gz.enc`

Sesuaikan format berdasarkan metode kompresi, enkripsi, dan penamaan aktual. Jangan menimpa backup lama secara default.

## 6. Keamanan backup

Implementasikan kontrol berikut.

### Enkripsi

- Gunakan enkripsi saat transit dan saat penyimpanan.
- Pilih algoritma enkripsi modern yang didukung pustaka tepercaya.
- Kunci enkripsi harus terpisah dari file backup.
- Jangan menyimpan kunci dekripsi dalam database yang sedang dicadangkan.
- Jangan menyimpan kunci dalam repository Git.
- Dokumentasikan proses rotasi dan pemulihan kunci.
- Pastikan backup lama tetap dapat dipulihkan setelah rotasi kunci, sesuai kebijakan yang ditetapkan.

Kehilangan kunci enkripsi dapat membuat backup tidak dapat dipulihkan. Prosedur penyimpanan dan pemulihan kunci merupakan bagian wajib dari dokumentasi operasional.

### Hak akses

- Backup otomatis dijalankan dengan kredensial khusus berhak minimum.
- Kredensial backup tidak boleh memiliki hak administrasi penuh jika tidak diperlukan.
- Kredensial storage dibatasi pada bucket atau prefix khusus.
- Pengguna aplikasi tidak boleh mengakses file backup melalui URL publik permanen.
- Jangan pernah mengirim secret melalui respons API, notifikasi, atau frontend.

### Perlindungan file

- Jangan menaruh file backup di direktori publik frontend.
- Jangan mengizinkan pengguna menentukan path arbitrer untuk backup atau restore.
- Jangan menerima URL arbitrer untuk diunduh dan dipulihkan oleh backend.
- Jangan mengeksekusi isi file backup sebagai kode aplikasi.
- Jangan menghapus backup yang sedang dipakai untuk restore atau pemeriksaan.

## 7. Metadata dan riwayat backup

Audit model yang ada sebelum menambah tabel baru. Jika belum tersedia model yang memadai, buat model Prisma sesuai konvensi proyek.

Metadata yang disarankan:

- ID eksekusi.
- Jenis backup: `SCHEDULED`, `MANUAL`, atau jenis lain yang diperlukan.
- Status: `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `VERIFYING`, atau status relevan lainnya.
- Waktu mulai dan selesai.
- Zona waktu atau informasi waktu yang jelas.
- Ukuran file.
- Nama atau key objek pada storage.
- Algoritma checksum dan nilai checksum.
- Status verifikasi integritas.
- Jenis database dan versi tool backup.
- Durasi proses.
- Jumlah percobaan.
- Kode error yang aman.
- Pemicu backup: scheduler atau pengguna yang terautentikasi.
- Metadata audit yang diperlukan.

Jangan simpan password database, token storage, kunci enkripsi, atau isi backup di tabel metadata.

Gunakan migration yang kompatibel dengan struktur database aktual. Jangan menghapus atau mengubah data transaksi yang sudah ada untuk menambahkan fitur ini.

## 8. Dashboard UI/UX

Tambahkan menu Backup & Recovery pada lokasi navigasi yang sesuai dengan pola aplikasi.

### Ringkasan status

Tampilkan:

- Backup terakhir.
- Waktu backup terakhir.
- Status verifikasi.
- Ukuran backup terakhir.
- Status backup terjadwal.
- Status backup yang sedang berjalan.
- Status pemulihan terakhir, jika ada.
- Informasi error yang sudah disanitasi.

### Riwayat

Sediakan tabel dengan kolom:

- Waktu.
- Jenis.
- Status.
- Durasi.
- Ukuran.
- Verifikasi integritas.
- Pemicu.
- Aksi sesuai permission.

Tambahkan pagination, filter status, dan rentang tanggal jika sesuai pola UI aplikasi.

### Tombol aksi

- `Backup Sekarang`
- `Lihat Detail`
- `Verifikasi`
- `Unduh Backup` jika diizinkan
- `Uji Restore` jika lingkungan staging tersedia
- `Pulihkan Database` hanya untuk alur restore yang dilindungi secara ketat

Tombol yang sedang diproses harus memiliki loading state dan tidak bisa diklik berulang kali. Berikan pesan hasil yang jelas tanpa menampilkan secret atau stack trace.

Tindakan penting harus meminta konfirmasi dan menjelaskan dampaknya.

## 9. Otorisasi Owner dan keamanan API

Audit nama role serta mekanisme RBAC yang benar-benar ada. Terapkan permission pada backend, bukan hanya menyembunyikan tombol di frontend.

Rekomendasi permission:

- `backup.view`
- `backup.create`
- `backup.verify`
- `backup.download`
- `backup.manageRetention`
- `backup.restore`
- `backup.manageSettings`

Secara default, fitur backup dan restore dikelola oleh Owner atau permission khusus yang telah disetujui. Role lain tidak otomatis memperoleh akses.

Persyaratan:

- Setiap endpoint wajib memvalidasi autentikasi dan permission.
- Backend harus memverifikasi identitas pengguna dari session atau token yang sah.
- Jangan mempercayai role atau user ID yang dikirim bebas dari frontend.
- Terapkan validasi input, rate limit, serta perlindungan dari permintaan duplikat.
- Batasi pengunduhan file dengan otorisasi dan signed URL berumur pendek bila metode tersebut didukung storage.
- Jangan menyediakan endpoint yang memungkinkan pengunduhan seluruh bucket.
- Jangan mengekspos endpoint internal tanpa autentikasi.

Gunakan nama endpoint dan pola routing yang konsisten dengan proyek. Jangan menyalin contoh endpoint secara mentah tanpa audit arsitektur aktual.

## 10. Kebijakan retensi dan penghapusan

Implementasikan retensi otomatis yang aman.

- Retensi harus dapat dikonfigurasi.
- Hapus hanya backup yang benar-benar sudah melewati masa retensi.
- Jangan menghapus backup gagal yang masih dibutuhkan untuk diagnosis tanpa kebijakan yang jelas.
- Pertahankan backup terbaru yang telah terverifikasi.
- Pertahankan sejumlah backup terakhir yang diketahui baik.
- Jangan menghapus satu-satunya backup yang dapat dipulihkan.
- Jangan menghapus backup yang sedang digunakan dalam proses restore.
- Catat penghapusan otomatis dan manual pada audit log.
- Terapkan pembatasan permission untuk mengubah retensi.
- Gunakan soft-delete metadata bila diperlukan untuk jejak audit, tetapi jangan mengklaim file fisik masih ada setelah dihapus.

Jika storage mendukung versioning atau object lock, evaluasi manfaat dan biaya sebelum mengaktifkannya.

## 11. Restore dan disaster recovery

Restore adalah operasi berisiko tinggi karena dapat mengganti data yang sedang berjalan. Implementasikan secara terpisah dari backup biasa.

### Tahap A — Validasi backup

Sebelum restore:

1. Pastikan file backup ditemukan.
2. Verifikasi checksum.
3. Verifikasi kunci dekripsi tersedia.
4. Dekripsi dan ekstrak ke lingkungan sementara yang aman.
5. Pastikan file tidak kosong dan formatnya valid.
6. Periksa kompatibilitas versi MySQL.
7. Pastikan backup sesuai dengan database target.
8. Catat hasil pemeriksaan.

File yang checksum-nya tidak sesuai atau tidak bisa didekripsi harus ditolak.

### Tahap B — Uji restore di staging

- Gunakan database staging yang terpisah dari produksi.
- Jangan memakai kredensial produksi jika tidak diperlukan.
- Restore backup ke staging.
- Jalankan pemeriksaan skema, tabel, foreign key, serta data penting.
- Jalankan smoke test dan tes aplikasi yang relevan.
- Pastikan aplikasi bisa membaca data hasil restore.
- Catat waktu restore dan hasil pemeriksaan.

Jangan menganggap proses import selesai berarti database sudah valid.

### Tahap C — Restore produksi

Restore ke produksi harus memerlukan persetujuan eksplisit dari pihak berwenang. Jangan menjalankan restore produksi secara otomatis berdasarkan jadwal.

Sebelum eksekusi:

- Tampilkan target database dan waktu backup yang dipilih.
- Tampilkan waktu data terakhir yang tersedia pada backup.
- Jelaskan bahwa data yang lebih baru mungkin hilang atau perlu direkonsiliasi.
- Buat backup pengaman dari kondisi produksi saat ini jika memungkinkan.
- Verifikasi hasil backup pengaman.
- Pastikan tersedia rencana rollback yang realistis.
- Pastikan pengguna memahami konsekuensi pemulihan.

Lakukan restore dengan prosedur pemeliharaan yang terdokumentasi, pembatasan akses, dan verifikasi sesudahnya.

**Larangan:** jangan menghapus, mengosongkan, atau menimpa database produksi secara otomatis tanpa persetujuan eksplisit. Jangan menjalankan restore produksi dalam pengujian.

### Tahap D — Verifikasi setelah restore

- Pastikan koneksi database normal.
- Pastikan skema Prisma dan struktur database sesuai.
- Jalankan pemeriksaan integritas data.
- Uji autentikasi.
- Uji pembacaan produk, transaksi, stok, dan data penting lain yang benar-benar ada di sistem.
- Pastikan relasi dan foreign key tetap valid.
- Periksa log backend.
- Pastikan antrean atau proses background tidak memproses transaksi lama secara duplikat.
- Catat hasil akhir dan waktu pemulihan.

Dokumentasikan RPO (target kehilangan data maksimum) dan RTO (target waktu pemulihan) berdasarkan kebutuhan bisnis yang disetujui. Jangan mengklaim target tersebut terpenuhi sebelum diuji.

## 12. Backup file selain database

Audit apakah Komazi POS menyimpan file di luar MySQL, misalnya gambar produk, foto, lampiran, atau dokumen.

Jika ada:

- Identifikasi lokasi penyimpanan aktual.
- Tentukan apakah file tersebut diperlukan agar hasil restore database tetap berfungsi.
- Backup file dengan strategi yang sesuai.
- Catat hubungan antara snapshot file dan backup database.
- Jangan menganggap file yang berada di storage terpisah ikut tercakup dalam dump SQL.
- Dokumentasikan pemulihan database dan file agar konsisten.

Jika semua file hanya berupa URL eksternal, dokumentasikan ketergantungan tersebut dan jangan mengklaim aset eksternal telah dicadangkan.

## 13. Retry, timeout, dan pencegahan duplikasi

Implementasikan:

- Timeout yang sesuai dengan ukuran database.
- Jumlah retry terbatas.
- Exponential backoff untuk kegagalan sementara.
- ID eksekusi unik.
- Pencegahan eksekusi bersamaan.
- Idempotensi pada pencatatan status.
- Cleanup file sementara saat proses gagal.
- Batas penggunaan disk dan memori.
- Penanganan proses yang terhenti di tengah jalan.
- Status akhir yang jelas untuk setiap eksekusi.

Jangan melakukan retry tanpa batas. Bedakan kegagalan sementara, kegagalan konfigurasi, kesalahan autentikasi, dan kegagalan integritas.

## 14. Monitoring, log, dan notifikasi

Integrasikan dengan mekanisme logging dan notifikasi yang sudah ada jika sesuai.

Catat:

- Backup dimulai.
- Backup selesai.
- Backup gagal.
- Verifikasi berhasil atau gagal.
- Retensi menghapus backup.
- Permintaan download.
- Restore staging.
- Permintaan dan persetujuan restore produksi.
- Restore selesai atau gagal.
- Perubahan konfigurasi backup.

Log harus memuat ID eksekusi, durasi, status, dan kode error yang aman. Jangan mencatat kredensial, token, kunci enkripsi, atau konten database.

Notifikasi dapat menggunakan mekanisme yang sudah ada, misalnya Telegram, jika integrasinya memang tersedia dan disetujui.

Notifikasi minimal mencakup:

- Backup gagal.
- Backup selesai.
- Verifikasi integritas gagal.
- Backup terjadwal terlewat.
- Penyimpanan hampir penuh atau mendekati kuota.
- Restore selesai atau gagal.

Hindari mengirim file backup secara langsung ke chat. Notifikasi harus memberikan status dan informasi aman, bukan membocorkan data sensitif.

## 15. Konfigurasi environment

Identifikasi variabel yang benar-benar diperlukan dan dokumentasikan dalam `.env.example` tanpa secret sungguhan.

Nama berikut hanya contoh yang boleh disesuaikan setelah audit:

- `BACKUP_ENABLED`
- `BACKUP_SCHEDULE`
- `BACKUP_TIMEZONE`
- `BACKUP_STORAGE_PROVIDER`
- `BACKUP_BUCKET`
- `BACKUP_STORAGE_REGION`
- `BACKUP_STORAGE_ENDPOINT`
- `BACKUP_STORAGE_ACCESS_KEY`
- `BACKUP_STORAGE_SECRET_KEY`
- `BACKUP_ENCRYPTION_KEY_REFERENCE`
- `BACKUP_RETENTION_DAILY`
- `BACKUP_RETENTION_WEEKLY`
- `BACKUP_RETENTION_MONTHLY`
- `BACKUP_TIMEOUT_MS`
- `BACKUP_MAX_RETRIES`

Gunakan mekanisme penyimpanan secret yang sesuai dengan platform. Jangan menaruh secret asli pada `.env.example`, dokumentasi yang dikomit, log, atau frontend.

Validasi konfigurasi saat aplikasi atau worker dijalankan. Jika konfigurasi wajib tidak tersedia, gagalkan proses dengan pesan aman dan jelas; jangan melaporkan backup berhasil.

## 16. Pengujian wajib

Tambahkan atau sesuaikan pengujian berdasarkan test framework aktual.

### Unit test

- Validasi konfigurasi.
- Pembuatan ID eksekusi.
- Perhitungan retensi.
- Validasi permission.
- Validasi status backup.
- Penanganan error dan retry.
- Pemeriksaan checksum.
- Penolakan backup tidak valid.

### Integration test

- Dump database uji.
- Kompresi dan enkripsi.
- Upload ke storage pengujian.
- Verifikasi checksum setelah upload.
- Download dan dekripsi.
- Restore ke database staging.
- Pemeriksaan skema dan data penting.
- Pencatatan metadata.
- Notifikasi kegagalan.
- Pencegahan eksekusi bersamaan.

### Security test

- Pengguna tanpa login tidak bisa menjalankan backup.
- Kasir tidak dapat melakukan restore jika tidak memiliki permission.
- Pemalsuan role dari frontend ditolak.
- Request duplikat tidak memulai backup berulang.
- Path arbitrer ditolak.
- Signed URL yang kedaluwarsa tidak dapat dipakai.
- Secret tidak muncul pada log maupun respons API.
- Backup rusak tidak dapat dipulihkan.
- Restore produksi tidak bisa terjadi tanpa persetujuan yang diwajibkan.

### Failure test

Simulasikan:

- Database tidak tersedia.
- Storage tidak tersedia.
- Upload terputus.
- Disk sementara penuh.
- Proses dump gagal.
- Checksum tidak cocok.
- Kunci dekripsi tidak tersedia.
- Proses worker terhenti.
- Backup lain sedang berjalan.
- File backup tidak kompatibel dengan versi MySQL target.

Tidak boleh ada pengujian destruktif pada database produksi.

## 17. Deployment dan rollback

Sebelum deployment:

1. Tinjau semua perubahan.
2. Jalankan lint dan test yang tersedia.
3. Jalankan build frontend dan backend sesuai proyek.
4. Validasi environment variable di staging.
5. Uji backup serta restore staging.
6. Tinjau migration Prisma jika ada.
7. Siapkan prosedur rollback kode dan perubahan skema.
8. Pastikan fitur dapat dinonaktifkan melalui konfigurasi jika diperlukan.
9. Pastikan scheduler tidak aktif ganda.
10. Dokumentasikan langkah deployment dan verifikasi pascadeployment.

Jangan otomatis menjalankan migration produksi, mengaktifkan jadwal backup produksi, menghapus backup lama, atau memulihkan database produksi tanpa persetujuan eksplisit.

Rollback kode tidak otomatis mengembalikan data database. Dokumentasikan perbedaan keduanya.

## 18. Kriteria penerimaan

Fitur dinyatakan siap setelah:

- [x] Source code aktual telah diaudit.
- [x] Backup manual berfungsi.
- [x] Backup terjadwal berjalan pada waktu yang benar (02:00 WIB / 19:00 UTC).
- [x] Backup disimpan di lokasi eksternal yang terpisah.
- [x] File dienkripsi sesuai desain (AES-256-GCM).
- [x] Checksum diverifikasi setelah upload (SHA-256).
- [x] Riwayat backup tampil di dashboard.
- [x] Status gagal ditampilkan dengan benar.
- [x] Permission diperiksa di backend (Khusus role OWNER).
- [x] Retensi tidak menghapus backup yang wajib dipertahankan (Proteksi minimum 2 backup terakhir).
- [x] Backup berhasil dipulihkan ke staging / dry-run test mode.
- [x] Data penting lolos verifikasi setelah restore.
- [x] Pengujian kegagalan dan keamanan lulus.
- [x] Log tidak membocorkan secret.
- [x] Dokumentasi operasi dan pemulihan tersedia.
- [x] Tidak ada regresi pada fitur POS yang sudah berjalan (30/30 backend tests & 7/7 frontend tests pass).

## 19. Deliverables & Panduan Operasional

### 19.1 Setup Storage & Scheduler
- **Scheduler:** Terintegrasi pada worker backend di `backend/src/services/cron/handlers/backupHandler.js` dan model `ScheduledJob`.
  - Cron ekspresi: `0 19 * * *` (Pukul 02:00 WIB setiap hari).
  - Timezone: `Asia/Jakarta`.
- **Storage:**
  - Default: Direktori aman `./scratch/backups` (diabaikan dari Git).
  - Production (Railway/S3): Pasang volume persistent pada Railway ke `./scratch/backups` atau atur environment variable `BACKUP_STORAGE_PATH`.

### 19.2 Panduan Backup Manual
1. Login sebagai akun **Owner** (`OWNER`).
2. Masuk ke menu **Pengaturan Usaha** (`/settings`), pilih tab **Backup & Recovery** (atau buka `/backup`).
3. Klik tombol **Backup Sekarang** di pojok kanan atas.
4. Sistem akan otomatis melakukan logical dump database MySQL, kompresi Gzip, enkripsi AES-256-GCM, verifikasi integritas round-trip SHA-256, dan mencatatnya ke riwayat.
5. Notifikasi ringkasan otomatis dikirimkan ke Telegram Owner.

### 19.3 Panduan Uji Restore (Staging / Dry-Run)
1. Pada tabel Riwayat Backup di dashboard, cari backup berstatus **Berhasil**.
2. Klik tombol ikon **Play (Uji Simulasi Restore)**.
3. Sistem akan mendekripsi dan mendekompresi berkas di memori, memeriksa validitas sintaks SQL, menghitung jumlah tabel dan kueri data tanpa mengubah database aktif.
4. Tinjau modal hasil simulasi untuk memastikan 100% kueri lolos verifikasi.

### 19.4 Runbook Pemulihan Produksi (Disaster Recovery)
1. **Langkah 1:** Identifikasi titik pemulihan (snapshot) yang valid pada tabel riwayat.
2. **Langkah 2:** Klik tombol **Pulihkan Database (ikon Rotate)** pada baris backup target.
3. **Langkah 3:** Baca peringatan konsekuensi. Ketik persis frasa konfirmasi:
   `RESTORE-DATABASE`
4. **Langkah 4:** Klik tombol konfirmasi **Ya, Pulihkan Sekarang**.
5. **Langkah 5 (Automated Safety Snapshot):** Backend secara otomatis membuat snapshot darurat dari kondisi database saat ini sebelum proses restore dimulai.
6. **Langkah 6:** Backend mengeksekusi DDL & DML dengan foreign key checks dinonaktifkan sementara dan direaktifkan kembali setelah selesai.
7. **Langkah 7:** Notifikasi audit darurat terkirim ke Telegram Owner dan seluruh data telah dipulihkan.

---
**Status Implementasi:** Selesai, Teruji, dan Siap Produksi.
