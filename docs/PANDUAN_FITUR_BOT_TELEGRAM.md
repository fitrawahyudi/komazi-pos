# 📖 PANDUAN LENGKAP FITUR & PERINTAH BOT TELEGRAM KOMAZI POS
**Sistem Asisten Pintar & Otomasi Operasional Kedai Kopi (Komazi Coffee & Workspace)**

---

## 📌 DAFTAR ISI
1. [Pengantar & Keunggulan Bot](#1-pengantar--keunggulan-bot)
2. [Cara Menautkan Akun & Memulai](#2-cara-menautkan-akun--memulai)
3. [Navigasi & Tampilan Menu Keyboard](#3-navigasi--tampilan-menu-keyboard)
4. [Daftar Perintah Berdasarkan Peran (Role)](#4-daftar-perintah-berdasarkan-peran-role)
   - [👑 Fitur Khusus Owner (Pemilik Kedai)](#41-fitur-khusus-owner-pemilik-kedai)
   - [👔 Fitur Khusus Manager (Pengelola Operasional)](#42-fitur-khusus-manager-pengelola-operasional)
   - [🧾 Fitur Khusus Kasir (Cashier)](#43-fitur-khusus-kasir-cashier)
   - [☕ Fitur Khusus Barista & Dapur (Kitchen)](#44-fitur-khusus-barista--dapur-kitchen)
   - [🌐 Fitur Umum (Semua Pengguna Terdaftar)](#45-fitur-umum-semua-pengguna-terdaftar)
5. [🤖 Asisten Cerdas Komazi AI & Mode Chat Bebas](#5-asisten-cerdas-komazi-ai--mode-chat-bebas)
6. [⏰ Pengaturan Tugas Otomatis & Pengingat (/cron & /jobs)](#6-pengaturan-tugas-otomatis--pengingat-cron--jobs)
7. [🔔 Sistem Notifikasi Otomatis (Proactive Alerts)](#7-sistem-notifikasi-otomatis-proactive-alerts)
8. [❓ Pertanyaan Umum & Tips Penggunaan](#8-pertanyaan-umum--tips-penggunaan)

---

## 1. Pengantar & Keunggulan Bot

Bot Telegram **Komazi POS** dirancang sebagai asisten pribadi operasional yang menghubungkan tim kedai (Owner, Manager, Kasir, Barista, dan Dapur) langsung melalui aplikasi Telegram tanpa harus selalu membuka laptop atau layar kasir.

### 🌟 Keunggulan Utama:
- **Terintegrasi Penuh (Realtime):** Semua transaksi, perubahan stok, shift kasir, dan laporan langsung terhubung dengan database utama POS Komazi.
- **Bahasa Manusiawi & Ramah:** Tidak ada kode teknis pengembang (*developer jargon*). Semua pesan, instruksi, dan konfirmasi menggunakan bahasa Indonesia yang hangat dan mudah dipahami.
- **Keamanan Berbasis Peran (*Role-Based Access*):** Setiap staf hanya dapat mengakses fitur yang sesuai dengan peran resminya di kedai.
- **Fleksibel:** Dilengkapi tombol keyboard bawah yang praktis dan dapat disembunyikan/dibuka kembali sesuka hati.

---

## 2. Cara Menautkan Akun & Memulai

Bot ini bersifat privat dan hanya dapat digunakan oleh staf kedai yang terdaftar.

### Langkah-langkah Penautan Akun:
1. **Dapatkan Kode Tautan:**
   - Minta kepada **Owner** kedai, ATAU
   - Buka menu **Pengaturan Staf** di aplikasi Web POS Komazi, lalu buat kode tautan Telegram.
2. **Kirim Perintah Mulai ke Bot:**
   - Buka chat bot di Telegram.
   - Ketik perintah:
     ```text
     /start KODE_TAUTAN
     ```
     *(Contoh: `/start A7X9K2`)*
3. **Selesai!** Bot akan menampilkan kartu ucapan selamat datang, menyesuaikan menu perintah sesuai peran Anda, dan mengaktifkan tombol menu bawah.

---

## 3. Navigasi & Tampilan Menu Keyboard

### 📱 Tombol Menu Bawah Layar (*Reply Keyboard*)
Di bagian bawah layar chat Telegram Anda tersedia tombol pintasan cepat 2 kolom sesuai peran staf (Owner, Manager, Kasir, Barista, atau Kitchen).

| Tombol / Fitur | Fungsi |
| :--- | :--- |
| **Tombol Operasional** | Menjalankan fitur utama secara instan (Omzet, Stok, Antrean, dll.) |
| **❌ Sembunyikan Menu** | Menutup tombol keyboard bawah agar layar obrolan lebih lapang |
| **Ikon Keyboard (Bawaan Telegram)** | Melipat / membuka kembali tombol bawah kapan saja |
| **Perintah `/menu`** | Menampilkan kembali tombol menu bawah dan kartu menu utama |
| **Perintah `/tutup_menu`** | Menyembunyikan tombol menu bawah |

---

## 4. Daftar Perintah Berdasarkan Peran (Role)

---

### 4.1 Fitur Khusus Owner (Pemilik Kedai)
Owner memiliki akses paling lengkap untuk memantau performa finansial, analitik bisnis, dan kesehatan sistem.

| Perintah | Deskripsi & Fungsi |
| :--- | :--- |
| `/ringkasan` | **Ringkasan Eksekutif Realtime:** Menampilkan perbandingan omzet hari ini vs kemarin, persentase pertumbuhan, total transaksi sukses, tamu workspace aktif, dan rincian metode pembayaran (Tunai, QRIS, Transfer). |
| `/profit` | **Laporan Laba Bersih (P&L):** Estimasi laba kotor, HPP (*COGS*), biaya operasional, dan margin laba bersih kedai. |
| `/laporan` | **Laporan Penjualan Berkala:** Memilih periode laporan secara interaktif (Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini). |
| `/prediksi` | **Prediksi AI Jam Sibuk:** Analisis proyeksi Komazi AI mengenai jam-jam paling ramai (*peak hours*) dan target omzet harian. |
| `/cek_stok_kritis` | **Analisis AI Stok Menipis:** Perkiraan sisa waktu bahan baku sebelum habis berdasarkan laju pemakaian transaksi. |
| `/tautkan` | **Buat Kode Tautan Staf:** Menghasilkan kode tautan 6 digit agar staf baru bisa menghubungkan akun Telegram mereka ke POS. |
| `/sentinel` | **Cek Kesehatan Sistem (On-Demand):** Memeriksa kestabilan server, koneksi database, dan kesiapan operasional kasir. |
| `/sentinel_schedule <waktu>` | **Atur Pengawasan Otomatis:** Mengatur jadwal pemeriksaan sistem berkala (contoh: `/sentinel_schedule 08:00`, `30m`, `1h`, atau `manual`). |

---

### 4.2 Fitur Khusus Manager (Pengelola Operasional)
Manager bertanggung jawab atas kelancaran persediaan bahan baku, persetujuan transaksi, dan pengawasan operasional harian.

| Perintah | Deskripsi & Fungsi |
| :--- | :--- |
| `/approval` | **Pusat Persetujuan:** Menampilkan daftar permohonan yang menunggu keputusan (Void pesanan, diskon khusus, refund) dengan tombol **Setujui** atau **Tolak**. |
| `/stok` | **Katalog Inventaris Bahan Baku:** Melihat sisa stok seluruh bahan baku, batas minimum, estimasi biaya satuan, status ketersediaan, serta tombol otomatis untuk pesan restock via WhatsApp ke distributor. |
| `/stok_masuk` | **Catat Pembelian Bahan (Restock):** Panduan interaktif untuk mencatat bahan baku yang baru dibeli atau diterima dari supplier agar stok otomatis bertambah. |
| `/waste` atau `/catat_waste` | **Catat Bahan Terbuang/Rusak:** Mencatat bahan baku yang tumpah, basi, kadaluarsa, atau terpakai untuk kalibrasi mesin kopi. |
| `/habis` | **Atur Menu Habis / Tersedia:** Menandai menu makanan atau minuman yang habis (*Sold Out*) atau tersedia kembali dengan 1 kali klik tombol. |
| `/laporan` | **Laporan Penjualan Hari Ini:** Rekap omzet harian beserta 5 menu terlaris (*Top 5 Best Seller*). |

---

### 4.3 Fitur Khusus Kasir (Cashier)
Kasir difasilitasi perintah cepat untuk transaksi kilat, pencatatan kas, dan pengelolaan area ruang kerja (Workspace).

| Perintah | Deskripsi & Fungsi |
| :--- | :--- |
| `/buka_shift` | **Buka Shift Kasir:** Memulai sesi kerja kasir dan mencatat modal awal kas (*cash float*) di laci kasir. |
| `/tutup_shift` | **Tutup Shift (Z-Report):** Mengakhiri sesi kasir, memasukkan uang fisik aktual di laci, dan menghasilkan laporan rekonsiliasi kas beserta status selisih kas (pas, lebih, atau kurang). |
| `/order` | **Pesanan Cepat (Quick Order):** Membuat pesanan langsung lewat Telegram tanpa menyentuh komputer (pilih Dine-in / Take-away, meja, menu, catatan, dan simpan). |
| `/pesanan` | **Pesanan Aktif (Open Bills):** Melihat daftar nota yang belum dibayar, rincian menu, dan mengajukan void/diskon jika ada kesalahan. |
| `/workspace` | **Status Area Workspace:** Melihat kapasitas dan ketersediaan meja workspace, tamu yang sedang aktif, sisa waktu paket, dan durasi lembur (*overtime*). |
| `/checkin` | **Check-in Tamu Workspace:** Mendaftarkan tamu baru ke area workspace dengan memilih paket durasi (1 jam, 2 jam, harian) dan nama tamu. |
| `/checkout` | **Check-out Tamu Workspace:** Mengakhiri sesi tamu workspace dan menghitung total tagihan durasi berjalan otomatis. |
| `/approval` | **Ajukan Persetujuan:** Mengajukan permintaan void nota atau diskon khusus kepada Manager/Owner yang sedang bertugas. |

---

### 4.4 Fitur Khusus Barista & Dapur (Kitchen)
Didesain sederhana, jelas, dan fokus pada kecepatan produksi pesanan minuman dan makanan.

| Perintah | Deskripsi & Fungsi |
| :--- | :--- |
| `/antrean` | **Live Antrean Pesanan:** Menampilkan seluruh pesanan aktif yang menunggu untuk diracik (Barista khusus minuman, Kitchen khusus makanan, Manager/Owner melihat keduanya). |

#### 🔘 Tombol Aksi di Kartu Antrean:
- **`▶️ Mulai Racik`:** Mengubah status pesanan menjadi *Sedang Diracik ⏳*.
- **`✅ Siap Saji`:** Mengubah status pesanan menjadi *Siap Disajikan ✅*, yang secara otomatis mengirim notifikasi ke kasir pembawa pesanan.

---

### 4.5 Fitur Umum (Semua Pengguna Terdaftar)

| Perintah | Deskripsi & Fungsi |
| :--- | :--- |
| `/menu` | Menampilkan menu navigasi utama sesuai peran Anda dan memunculkan kembali tombol menu bawah. |
| `/tutup_menu` | Menyembunyikan tombol menu bawah agar tampilan obrolan lebih bersih. |
| `/whoami` | Menampilkan informasi akun Anda yang tertaut (Nama, Username, Peran, ID Telegram). |
| `/infobot` | Menampilkan status server, koneksi database, dan performa layanan asisten Komazi. |
| `/batal` | Membatalkan alur pengisian atau formulir interaktif yang sedang berjalan. |

---

## 5. Asisten Cerdas Komazi AI & Mode Chat Bebas

Komazi POS dilengkapi mesin kecerdasan buatan (*AI Engine*) yang memahami bahasa percakapan sehari-hari.

### 5.1 Perintah Asisten AI:
- `/ai [pertanyaan]`: Bertanya langsung ke AI.
  - *Contoh: `/ai bagaimana performa omzet penjualan hari ini?`*
  - *Contoh: `/ai apakah ada bahan baku yang perlu segera dibeli?`*
  - *Contoh: `/ai bagaimana SOP penutupan mesin espresso?`*
- `/ai on` atau `/ai_mode`: **Mengaktifkan Mode Chat Bebas.** Anda bisa langsung mengobrol dan mengetik pertanyaan tanpa perlu awalan `/ai`.
- `/ai off`: Mematikan Mode Chat Bebas dan kembali ke mode normal.
- `/ai reset`: Membersihkan memori percakapan terdahulu untuk memulai topik obrolan baru.

---

## 6. Pengaturan Tugas Otomatis & Pengingat (/cron & /jobs)

Fitur ini memungkinkan Owner dan Manager mengatur tugas yang berjalan secara otomatis pada jam atau frekuensi tertentu.

### 6.1 Perintah Utama `/cron`:
| Perintah | Fungsi |
| :--- | :--- |
| `/cron` atau `/cron bantuan` | Membuka panduan lengkap pengelolaan jadwal otomatis. |
| `/cron buat` | Memulai panduan langkah-demi-langkah pembuatan jadwal baru. |
| `/cron saya` atau `/jobs` | Melihat daftar seluruh jadwal tugas yang sedang aktif di kedai. |
| `/cron detail <id>` atau `/job_show <id>` | Melihat detail waktu pelaksanaan, target staf, dan riwayat tugas. |
| `/cron ubah <id> <waktu>` | **Mengubah waktu pelaksanaan tugas** menggunakan bahasa sehari-hari. |
| `/cron jeda <id>` | Menjeda atau menonaktifkan jadwal tugas untuk sementara waktu. |
| `/cron aktifkan <id>` | Mengaktifkan kembali jadwal tugas yang sedang dijeda. |
| `/cron lewati <id>` | Melewati 1 kali jadwal pengiriman berikutnya tanpa menghapus tugas. |
| `/cron jalankan <id>` | Menjalankan tugas sekarang juga secara instan tanpa menunggu jam jadwal. |
| `/cron riwayat <id>` atau `/job_runs <id>` | Melihat catatan dan log pengiriman tugas sebelumnya. |
| `/cron hapus <id>` | Menghapus jadwal tugas dari sistem. |

### 6.2 Contoh Mengetik Perubahan Waktu (`/cron ubah`):
Sistem memahami bahasa waktu yang sangat fleksibel:
- `/cron ubah 1 20:00` *(Setiap hari pukul 20:00 WIB)*
- `/cron ubah 1 jam 22.00` *(Setiap hari pukul 22:00 WIB)*
- `/cron ubah 1 08:30` *(Setiap hari pukul 08:30 WIB)*
- `/cron ubah 1 tiap 30 menit` *(atau `30m`)*
- `/cron ubah 1 tiap 1 jam` *(atau `1h`)*
- `/cron ubah 1 tiap senin 09:00` *(Setiap hari Senin pukul 09:00 WIB)*

### 6.3 Jenis Tugas Otomatis yang Tersedia:
1. **Laporan Penjualan (REPORT):** Ringkasan omzet harian otomatis saat kedai tutup buku (misal: tiap jam 22:00 WIB).
2. **Pencadangan Data (BACKUP):** Penyimpanan salinan cadangan aman data transaksi & inventaris POS.
3. **Pemantauan Sistem (MONITORING):** Pengecekan koneksi server, database, dan kesiapan operasional.
4. **Pengingat Tugas (REMINDER):** Pengingat tugas operasional ke tim staf (misal: pengingat kalibrasi grinder tiap jam 08:00 WIB).
5. **Analisis Cerdas AI (AI_TASK):** Proyeksi jam sibuk dan saran bisnis berkala dari Komazi AI.

---

## 7. Sistem Notifikasi Otomatis (Proactive Alerts)

Bot Telegram Komazi POS secara otomatis mengirimkan pemberitahuan penting ke obrolan staf terkait saat kejadian berikut berlangsung di kedai:

| Jenis Notifikasi | Penerima | Isi Notifikasi |
| :--- | :--- | :--- |
| **Tiket Pesanan Masuk** | Barista & Dapur | Rincian menu pesanan baru, nomor meja, varian rasa, dan catatan pesanan. |
| **Pesanan Siap Saji** | Kasir | Informasi bahwa minuman/makanan pesanan tertentu sudah selesai diracik dan siap diantar ke tamu. |
| **Permintaan Persetujuan** | Manager & Owner | Notifikasi saat kasir mengajukan void nota, diskon khusus, atau pengembalian dana (*refund*). Dilengkapi tombol aksi langsung `Setujui` / `Tolak`. |
| **Peringatan Void Besar** | Owner | Peringatan keamanan apabila terdapat pembatalan nota (*void*) dengan nominal di atas batas toleransi toko. |
| **Peringatan Stok Menipis** | Manager & Owner | Peringatan saat persediaan bahan baku menyentuh atau berada di bawah batas minimum stok. |
| **Buka Shift Kasir** | Manager & Owner | Laporan pembukaan sesi kasir baru, nama kasir bertugas, dan modal kas awal di laci. |
| **Tutup Shift (Z-Report)** | Manager & Owner | Ringkasan penutupan sesi kasir, total penjualan tunai & non-tunai, uang fisik aktual, serta status selisih kas. |
| **Transaksi Sukses** | Manager & Owner | Laporan ringkas ketika pembayaran nota pelanggan telah lunas. |

---

## 8. Pertanyaan Umum & Tips Penggunaan

### Q: Bagaimana cara menutup tombol menu di bagian bawah layar?
**A:** Tekan tombol **`❌ Sembunyikan Menu`** pada keyboard bawah, atau ketik perintah **`/tutup_menu`**. Anda juga dapat melipat keyboard menggunakan tombol panah bawah bawaan aplikasi Telegram Anda.

### Q: Bagaimana cara memunculkan kembali tombol menu yang tertutup?
**A:** Cukup ketik perintah **`/menu`**, tombol navigasi bawah akan otomatis muncul kembali.

### Q: Apakah kasir bisa melihat ringkasan omzet atau laporan laba bersih?
**A:** Tidak. Fitur keuangan dan omzet diproteksi ketat dan hanya dapat dibuka oleh akun dengan peran **Owner** dan **Manager**.

### Q: Apa yang harus dilakukan jika salah mengetik saat mengisi formulir interaktif?
**A:** Anda dapat mengetik **`/batal`** kapan saja untuk menghentikan proses pengisian dan kembali ke menu awal.

### Q: Bisakah saya membuat jadwal pengingat hanya dengan mengetik kalimat biasa?
**A:** Ya! Anda cukup mengetik pesan langsung seperti:
- *"Ingatkan aku setiap jam 8 pagi untuk kalibrasi mesin kopi"*
- *"Kirim laporan penjualan setiap hari jam 22.00"*
Asisten AI akan mendeteksi permintaan Anda dan menyiapkan kartu konfirmasinya secara otomatis.

---
*Dokumentasi Resmi Sistem Bot Telegram Komazi POS — Komazi Coffee & Workspace.*
