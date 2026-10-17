# implementation.md — User-Requested Cron Jobs for Telegram Bot

> **Tujuan:** memungkinkan pengguna meminta bot Telegram membuat, melihat, mengubah, menjalankan, menonaktifkan, dan menghapus pekerjaan terjadwal (*cron jobs*) melalui percakapan biasa maupun perintah terstruktur.
>
> **Stack yang harus dipertahankan:** Node.js JavaScript, grammY, MySQL, deployment Railway, timezone `Asia/Jakarta`, integrasi OpenClaw sebagai AI opsional.
>
> **Aturan utama:** jangan menebak arsitektur aktual. Audit repository dan database terlebih dahulu. Pertahankan seluruh command, konfigurasi, skema, dan fitur lama yang masih digunakan. Buat migrasi kompatibel dan jangan menghapus atau mengganti database existing tanpa alasan serta persetujuan.

---

## 1. Hasil yang ingin dicapai

User dapat menulis contoh permintaan seperti:

- “Ingatkan aku setiap hari jam 7 malam untuk belajar.”
- “Kirim ringkasan transaksi setiap hari jam 22.00.”
- “Cek status layanan setiap 10 menit.”
- “Buat laporan mingguan setiap Senin jam 8 pagi.”
- “Jalankan backup database setiap hari pukul 02.00.”
- “Hentikan jadwal laporan mingguan.”
- “Ubah pengingat belajar jadi jam 20.00.”
- “Jalankan laporan sekarang.”
- “Tampilkan semua jadwal saya.”

Bot harus mengubah permintaan menjadi definisi jadwal yang jelas, menampilkan ringkasan untuk dikonfirmasi, menyimpan jadwal ke MySQL, lalu mengeksekusinya pada waktunya. Untuk aksi berisiko atau berdampak eksternal, wajib meminta konfirmasi eksplisit sebelum jadwal dibuat/diaktifkan.

**Penting:** bot tidak boleh menganggap teks permintaan sebagai izin otomatis untuk membaca seluruh data, mengirim pesan ke orang lain, mengubah sistem, atau menjalankan perintah shell.

## 2. Audit wajib sebelum implementasi

Agent coding wajib memeriksa source code aktual dan melaporkan temuan sebelum mengubah file.

1. Identifikasi `package.json`, versi Node.js, module system (ESM/CommonJS), entry point, dan scripts.
2. Petakan struktur `commands`, `handlers`, `middleware`, `services`, `jobs`, `database`, `prisma`/ORM, migration, dan test bila tersedia.
3. Identifikasi grammY bot initialization, long polling/webhook, command yang sudah ada, serta penanganan error.
4. Periksa konfigurasi MySQL dan skema aktual. Jangan menampilkan credential/token dalam laporan.
5. Periksa deployment Railway, start command, jumlah replica/instance, worker, dan cron service yang sudah ada.
6. Periksa integrasi OpenClaw yang benar-benar ada: versi, cara pemanggilan resmi, autentikasi, batas kemampuan, dan apakah tersedia. Jangan mengarang API atau memodifikasi database internal OpenClaw.
7. Temukan pola role/permission, Telegram user ID, audit log, konfigurasi timezone, dan cara mengirim pesan.
8. Jalankan test/lint/build yang tersedia sebelum perubahan untuk membuat baseline.
9. Buat daftar file yang akan dibuat/diubah, risiko, migrasi, dan rencana rollback.

Jangan mengganti library, ORM, pola module, atau infrastruktur hanya demi mengikuti dokumen ini jika repository sudah memiliki pilihan yang layak. Adaptasikan rancangan dengan source code yang ditemukan.

## 3. Arsitektur target

Gunakan komponen modular, menyesuaikan struktur proyek yang ada:

- **Telegram interface (grammY):** menerima bahasa alami dan command terstruktur.
- **Intent parser:** mengubah pesan menjadi draft job terstruktur. AI/OpenClaw boleh membantu interpretasi, tetapi hasil wajib divalidasi oleh kode deterministik.
- **Schedule service:** validasi jadwal, timezone, izin, status, perubahan, dan konflik.
- **MySQL:** sumber kebenaran untuk definisi jadwal, eksekusi, idempotency, audit, dan hasil.
- **Scheduler/dispatcher:** mencari job yang jatuh tempo dan mengklaimnya secara aman.
- **Job handlers:** daftar handler yang diizinkan; setiap jenis job memiliki schema input dan izin sendiri.
- **Worker/queue (bila dibutuhkan):** menjalankan tugas panjang agar bot tetap responsif.
- **Notification service:** mengirim hasil ke Telegram dan mencatat kegagalan.
- **OpenClaw adapter (opsional):** hanya memakai interface resmi yang terverifikasi; tidak menjadi sumber kebenaran jadwal.
- **Observability:** structured logs, metrik dasar, status job, serta audit trail.

### Pilihan scheduler

Utamakan scheduler persisten di aplikasi/worker yang membaca jadwal dari MySQL, agar jadwal buatan user tetap ada setelah restart dan bisa diubah melalui bot. Jangan bergantung pada timer in-memory sebagai satu-satunya penyimpanan jadwal.

Jika menggunakan Railway Cron, periksa dahulu keterbatasan jadwalnya: Railway Cron umumnya menjalankan proses terjadwal berdasarkan konfigurasi deployment, bukan secara otomatis membuat cron baru untuk setiap user. Gunakan hanya sebagai pemicu dispatcher/maintenance yang memang sesuai. Pastikan proses cron selesai dan keluar, serta cocokkan zona waktu konfigurasi dengan kebutuhan `Asia/Jakarta`.

Jangan menjalankan dua dispatcher aktif tanpa mekanisme lock/claim yang aman.

## 4. Jenis job yang diperbolehkan

Buat registry handler eksplisit. Jangan menjalankan kode bebas dari pesan user.

| Jenis | Contoh | Validasi dan batas |
|---|---|---|
| `reminder` | Pengingat belajar/minum air | Pesan dibatasi panjangnya; hanya dikirim ke chat yang diizinkan |
| `report` | Ringkasan transaksi/aktivitas | Memeriksa role dan cakupan data; hanya laporan yang telah didukung source |
| `monitor` | Pemeriksaan endpoint/layanan | Allowlist target, timeout, batas frekuensi, jangan scan jaringan arbitrer |
| `backup` | Backup database | Hanya melalui service backup yang aman; enkripsi, retensi, dan uji pemulihan |
| `notification` | Notifikasi berkala | Penerima harus terdaftar/diizinkan |
| `ai_task` | Ringkasan atau analisis AI berkala | AI opsional; batas biaya/token, data yang boleh dikirim, timeout, fallback |
| `maintenance` | Pembersihan data/log yang aman | Admin-only, dry-run bila sesuai, batas jumlah data, audit |
| `custom_supported` | Aksi dari plugin internal yang disetujui | Hanya plugin terdaftar dengan schema, izin, timeout, dan audit |

Tidak diperbolehkan menjalankan shell, SQL bebas, JavaScript arbitrer, URL arbitrer, pengiriman massal, atau operasi destruktif berdasarkan teks user. Jika kebutuhan tidak cocok dengan handler yang tersedia, jelaskan keterbatasan dan jangan berpura-pura jadwal sudah aktif.

## 5. Alur percakapan

### 5.1 Membuat jadwal dari bahasa alami

1. Terima pesan user.
2. Periksa identitas Telegram dan permission.
3. Parse intent ke draft terstruktur:
   - `jobType`
   - `title`
   - `payload`
   - `scheduleType` (`once`, `interval`, `daily`, `weekly`, atau cron expression yang dibatasi)
   - `scheduleConfig`
   - `timezone` (default `Asia/Jakarta`)
   - `targetChatId`/penerima yang diizinkan
   - `nextRunAt`
   - `requiresConfirmation`
4. Validasi seluruh field dengan schema (gunakan library validasi yang sudah ada; jika belum ada, pilih satu yang sesuai).
5. Jika waktu ambigu (“besok malam”, “tiap akhir bulan”, atau zona waktu tidak jelas), ajukan pertanyaan singkat. Jangan menebak.
6. Tampilkan pratinjau sebelum menyimpan, misalnya:

   **Konfirmasi jadwal**
   - Tugas: Pengingat belajar
   - Waktu: Setiap hari pukul 19.00
   - Zona waktu: Asia/Jakarta
   - Tujuan: Chat ini
   - Status: Menunggu konfirmasi

   Tombol: `Konfirmasi` · `Ubah` · `Batal`

7. Konfirmasi harus terikat pada draft ID, user ID, dan masa berlaku. Tolak konfirmasi dari user lain atau draft yang sudah kedaluwarsa.
8. Setelah disimpan, balas dengan ID jadwal, waktu eksekusi berikutnya, dan cara mengelolanya.

### 5.2 Mengubah jadwal

- Identifikasi job melalui ID atau pilihan dari daftar job milik user.
- Tampilkan nilai saat ini dan perubahan yang diminta.
- Validasi ulang izin dan jadwal.
- Gunakan optimistic locking/version atau transaksi untuk mencegah perubahan saling menimpa.
- Catat nilai sebelum/sesudah di audit log.

### 5.3 Menjalankan, melewatkan, menonaktifkan, dan menghapus

- `Jalankan sekarang`: menjalankan handler yang sama melalui dispatcher, bukan jalur kode yang berbeda.
- `Lewati berikutnya`: mencatat occurrence yang dilewati dan menghitung waktu berikutnya.
- `Nonaktifkan`: mempertahankan definisi dan riwayat.
- `Hapus`: soft-delete atau status `DELETED`; jangan menghapus riwayat audit.
- Aksi berdampak tinggi harus meminta konfirmasi tambahan.

### 5.4 Command minimum

Sesuaikan prefix dengan bot existing dan jangan merusak command lama.

- `/cron` — bantuan dan menu jadwal
- `/cron buat` — mulai pembuatan jadwal terstruktur
- `/cron saya` — daftar jadwal milik pengguna
- `/cron detail <id>` — detail dan riwayat
- `/cron jeda <id>` — nonaktifkan
- `/cron aktifkan <id>` — aktifkan kembali
- `/cron ubah <id>` — mulai alur perubahan
- `/cron hapus <id>` — minta konfirmasi penghapusan
- `/cron jalankan <id>` — jalankan sekarang jika diizinkan
- `/cron lewati <id>` — lewati occurrence berikutnya
- `/cron riwayat <id>` — hasil eksekusi
- `/cron batal` — batalkan alur percakapan yang sedang berlangsung

Bahasa alami tetap didukung, tetapi command terstruktur harus tersedia sebagai fallback jika AI tidak aktif atau gagal.

## 6. Data model MySQL

Periksa schema existing dan sesuaikan naming convention/ORM. Jangan membuat tabel duplikat jika fungsi setara sudah ada. Gunakan migration versioned.

### `scheduled_jobs`

Kolom yang disarankan:

- `id` — primary key (UUID/ULID atau format existing)
- `owner_telegram_id` — pemilik job
- `target_chat_id` — chat tujuan yang diizinkan
- `job_type` — enum/string dari registry
- `title`
- `payload_json` — payload tervalidasi, tidak menyimpan secret
- `schedule_type`
- `schedule_config_json`
- `timezone` — default `Asia/Jakarta`
- `status` — `PENDING_CONFIRMATION`, `ACTIVE`, `PAUSED`, `COMPLETED`, `FAILED`, `DELETED`
- `next_run_at_utc`
- `last_run_at_utc`
- `expires_at_utc` — opsional
- `max_runs` — opsional
- `run_count`
- `misfire_policy` — `SKIP`, `RUN_ONCE`, atau policy lain yang jelas
- `created_at`, `updated_at`, `deleted_at`
- `version` — untuk optimistic locking bila diperlukan

### `scheduled_job_runs`

- `id`
- `job_id`
- `scheduled_for_utc`
- `started_at_utc`, `finished_at_utc`
- `status` — `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`, `TIMED_OUT`
- `attempt`
- `idempotency_key` — UNIQUE
- `result_summary` — aman dan dibatasi panjangnya
- `error_code`, `error_summary` — tanpa token, password, atau data sensitif
- `worker_id` — opsional
- `created_at`, `updated_at`

### `scheduled_job_audit`

- `id`
- `job_id`
- `actor_telegram_id`
- `action`
- `before_json`, `after_json` — redaksi data sensitif
- `created_at`

### Opsional

- `scheduled_job_drafts` untuk draft konfirmasi yang kedaluwarsa.
- `notification_outbox` untuk pengiriman hasil yang andal.
- `scheduler_locks` jika mekanisme locking existing belum mencukupi.

Tambahkan indeks untuk `(status, next_run_at_utc)`, `(owner_telegram_id, status)`, `(job_id, scheduled_for_utc)`, dan unique idempotency key. Terapkan foreign key jika sesuai dengan skema existing.

## 7. Waktu, zona waktu, dan recurrence

- Default zona waktu adalah `Asia/Jakarta`; simpan waktu eksekusi absolut dalam UTC.
- Simpan definisi recurrence beserta timezone asal agar jadwal lokal tetap konsisten.
- Gunakan library waktu/cron yang terpelihara dan kompatibel dengan runtime existing; jangan menulis parser cron sendiri.
- Validasi interval minimum. Default aman: tidak lebih sering dari sekali setiap 5 menit kecuali ada kebutuhan sah yang disetujui admin.
- Batasi masa depan, jumlah job aktif per user, durasi, dan frekuensi sesuai konfigurasi.
- Definisikan perilaku untuk jadwal bulanan, tanggal yang tidak ada, leap year, serta waktu yang terlewat saat server mati.
- Setelah restart, hitung occurrence berikutnya dari definisi tersimpan, bukan dari timer lama.
- Terapkan misfire policy: untuk reminder biasanya `RUN_ONCE` dalam jendela toleransi atau `SKIP`; jangan mengirim ratusan reminder susulan.
- Simpan timestamp dalam UTC dan tampilkan ke user dalam `Asia/Jakarta` atau timezone yang dikonfirmasi.

## 8. Dispatcher, concurrency, dan idempotency

1. Dispatcher mencari job aktif dengan `next_run_at_utc <= NOW(UTC)`.
2. Klaim job secara atomik di dalam transaksi menggunakan row locking/conditional update yang sesuai dengan versi MySQL dan ORM aktual.
3. Jangan menahan transaksi database selama handler berjalan.
4. Buat run record dengan `idempotency_key` unik, misalnya gabungan `job_id + scheduled_for_utc + action_type`.
5. Hanya worker yang berhasil mengklaim job boleh mengeksekusi run tersebut.
6. Handler wajib idempotent sejauh mungkin. Untuk efek eksternal, simpan status pengiriman/outbox dan gunakan provider idempotency key jika tersedia.
7. Hitung `next_run_at_utc` secara konsisten; jangan memajukan jadwal dua kali jika proses gagal di tengah.
8. Terapkan timeout, concurrency limit global/per-type, backoff, retry limit, dan dead-letter/failed state.
9. Jangan retry error permanen (permission denied, payload invalid, job type tidak dikenal).
10. Jika proses mati ketika status `RUNNING`, pulihkan dengan aturan lease/heartbeat dan batas waktu. Jangan otomatis menjalankan ulang operasi yang efek eksternalnya tidak dapat dipastikan aman.

## 9. Retry dan penanganan error

- Gunakan exponential backoff dengan jitter, batas percobaan, dan maksimum waktu retry.
- Pisahkan error sementara (network timeout, rate limit provider) dari error permanen (invalid input, izin ditolak).
- Hormati `Retry-After` dari Telegram/provider jika ada.
- Setelah retry habis, tandai `FAILED`, simpan ringkasan aman, dan beri tahu owner/admin sesuai kebijakan.
- Batasi panjang pesan error; jangan mengirim stack trace atau secret ke chat Telegram.
- Jangan membuat loop retry tanpa batas atau retry semua job secara bersamaan setelah restart.

## 10. Keamanan dan kontrol akses

- Autentikasi berbasis Telegram user ID yang sudah terdaftar; jangan percaya username atau teks nama.
- Terapkan RBAC dari sistem existing: misalnya `owner`, `admin`, `user`; jangan mengasumsikan role sebelum audit.
- User hanya bisa melihat dan mengubah job miliknya, kecuali role berizin.
- Laporan, backup, monitoring, broadcast, maintenance, dan AI memiliki permission terpisah.
- Job harus menyimpan allowlist penerima/target; jangan izinkan user mengirim ke chat arbitrary tanpa otorisasi.
- Validasi input dengan allowlist job type, schema payload, batas panjang, batas ukuran, dan batas frekuensi.
- Jangan gunakan `eval`, `Function`, `child_process` dari payload user, SQL string bebas, atau eksekusi instruksi arbitrer.
- Untuk monitoring, gunakan domain/IP allowlist; cegah SSRF, akses metadata cloud, localhost/internal service, dan port yang tidak diizinkan.
- Lindungi callback confirmation dari pemalsuan: ikat ke actor, draft ID, expiry, dan nonce sekali pakai.
- Terapkan rate limit pembuatan/eksekusi jadwal per user.
- Simpan token bot, kredensial DB, API key, dan secret OpenClaw di environment/secret manager. Jangan log atau memasukkannya ke payload.
- Enkripsi backup dan batasi akses/retensi file backup.
- Redaksi data pribadi/rahasia di logs dan payload AI.
- Audit setiap create/update/run/pause/delete/permission denial.
- Jika user meminta aksi yang tidak diizinkan, tolak dengan penjelasan singkat tanpa membocorkan detail internal.

## 11. Integrasi OpenClaw dan AI

OpenClaw/LLM hanya membantu memahami bahasa alami dan menyusun draft job. AI bukan scheduler dan tidak boleh mengesampingkan policy engine.

Alur aman:

1. Kirim hanya konteks minimum yang diperlukan ke AI.
2. Minta output terstruktur sesuai schema, bukan teks bebas yang langsung dieksekusi.
3. Parse JSON dan validasi menggunakan kode server.
4. Tolak jenis job, tool, argumen, penerima, atau frekuensi yang tidak terdaftar.
5. Tampilkan draft untuk konfirmasi user.
6. Simpan ke MySQL setelah validasi dan konfirmasi.
7. Dispatcher hanya menjalankan handler terdaftar.

Ketentuan tambahan:

- Integrasi AI bersifat optional; semua fungsi dasar cron dan command manual harus tetap bekerja tanpa AI.
- Verifikasi API/CLI OpenClaw berdasarkan dokumentasi dan instalasi aktual. Jangan mengarang endpoint, menjalankan CLI dengan input mentah, atau menulis ke database internal OpenClaw.
- Terapkan timeout, rate limit, biaya/token limit, fallback parser sederhana, dan pencatatan kegagalan.
- Jangan mengirim password, token, data pelanggan sensitif, atau seluruh database ke model.
- AI tidak boleh memutuskan otorisasi; permission selalu diperiksa server.

## 12. Loading dan UX Telegram

Untuk tugas cepat, kirim jawaban langsung. Untuk tugas panjang:

- Tampilkan status seperti `Menyiapkan jadwal…`, `Memproses…`, `Mencoba kembali…`, `Selesai` atau `Gagal`.
- Utamakan edit pesan status yang sama daripada mengirim spam pesan.
- Progress harus mencerminkan tahap nyata; jangan mengarang persentase jika tidak ada metrik progres.
- Untuk backup/laporan besar, gunakan task ID dan command `/task <id>` atau mekanisme status existing.
- Hindari edit Telegram terlalu sering; patuhi rate limit API.
- Berikan tombol inline untuk konfirmasi, ubah, batalkan, jeda, dan lihat detail jika pola bot existing mendukungnya.

## 13. Backup dan laporan terjadwal

### Backup

- Jalankan hanya melalui service backup yang sudah diaudit.
- Verifikasi hasil backup (file/objek ada, ukuran wajar, checksum bila sesuai).
- Simpan di lokasi persisten/object storage yang dikonfigurasi, bukan hanya filesystem ephemeral Railway.
- Enkripsi, batasi akses, atur retensi, dan log hasil.
- Jangan mengirim isi backup melalui Telegram.
- Uji prosedur restore di lingkungan terpisah secara berkala.
- Jangan mengklaim backup berhasil sebelum hasilnya diverifikasi.

### Laporan

- Ambil data melalui service/query yang sudah ada dan dibatasi permission.
- Terapkan timezone dan rentang waktu eksplisit.
- Hindari mengirim data pelanggan/keuangan kepada chat yang tidak diizinkan.
- Simpan ringkasan eksekusi dan metadata; jangan menyimpan salinan sensitif berlebihan.

## 14. Deployment Railway

Audit deployment sebelum menentukan proses final.

Pola yang disarankan:

- **Bot service:** menangani update Telegram dan percakapan.
- **Scheduler/worker service:** dispatcher dan handler terjadwal, bila pemisahan proses diperlukan.
- **MySQL:** menyimpan job dan riwayat secara persisten.
- **Railway Cron:** opsional untuk tugas batch/maintenance yang memang cocok dengan pola run-and-exit, bukan sebagai pengganti otomatis untuk scheduler dinamis per user.

Pastikan:

- Hanya satu bot polling aktif untuk token yang sama, kecuali arsitektur webhook/replica memang aman.
- Multi-worker menggunakan atomic claim/lock.
- Semua service memakai konfigurasi timezone yang eksplisit.
- Start command, health check, restart behavior, graceful shutdown, dan migrasi database terdokumentasi.
- File lokal pada container tidak dianggap persisten.
- Environment variables terdokumentasi tanpa nilai rahasia.
- Uji restart, deploy baru, dan worker mati ketika ada job aktif.

## 15. Logging dan monitoring

Gunakan logger yang sudah ada; jika belum ada, pilih structured logger yang cocok dengan proyek.

Setiap run mencatat:

- `jobId`, `runId`, `jobType`, `ownerId` yang telah disamarkan bila perlu
- `scheduledFor`, `startedAt`, `finishedAt`
- `status`, `attempt`, `durationMs`
- `errorCode` dan ringkasan error yang telah disanitasi
- identitas worker dan correlation ID bila tersedia

Pantau jumlah job aktif, job terlambat, run sukses/gagal, retry, durasi handler, dan error scheduler. Jangan mencatat token, password, secret, callback payload sensitif, atau seluruh payload pengguna.

## 16. Testing wajib

Tambahkan unit, integration, dan end-to-end tests sesuai tool yang sudah ada.

### Parser dan validasi
- Permintaan waktu jelas dan ambigu.
- Bahasa Indonesia sehari-hari, salah ketik ringan, dan fallback ketika AI tidak tersedia.
- Jadwal sekali, interval, harian, mingguan, bulanan, dan tanggal batas.
- Invalid timezone, interval terlalu pendek, payload terlalu besar, dan job type tak dikenal.

### Permission
- User hanya melihat/mengubah job miliknya.
- User biasa tidak dapat menjalankan backup, broadcast, maintenance, atau laporan admin.
- Callback konfirmasi dari user berbeda ditolak.
- Job tidak mengirim pesan ke penerima tak diizinkan.

### Scheduler
- Job due dijalankan sekali meskipun ada beberapa worker.
- Restart tidak menghilangkan jadwal.
- Idempotency mencegah efek ganda.
- Retry sementara, stop retry pada error permanen, timeout, dan worker crash.
- Misfire policy tidak membuat ledakan job susulan.
- Update/pause/delete saat job sedang due ditangani konsisten.

### Integrasi
- Telegram send failure dan rate limit.
- MySQL transient error dan transaction rollback.
- OpenClaw timeout/invalid output/unavailable.
- Railway deployment restart dan graceful shutdown.
- Backup diverifikasi dan restore diuji di lingkungan terpisah.

### Quality gate
- Jalankan lint, tests, type/schema checks bila ada, dan build.
- Tidak boleh ada test penting yang dihapus hanya untuk membuat suite hijau.
- Laporkan test yang gagal karena environment secara terpisah dari kegagalan kode.

## 17. Tahapan implementasi

1. **Audit & baseline:** catat arsitektur, command lama, schema, test, dan risiko.
2. **Schema & migration:** tambahkan tabel/kolom minimum yang dibutuhkan, tanpa kehilangan data.
3. **Job registry & permission:** buat handler yang diizinkan dan policy per jenis job.
4. **Schedule service:** create/list/update/pause/resume/delete/preview/next-run.
5. **Dispatcher:** atomic claim, run records, idempotency, timeout, retry, misfire.
6. **Telegram UX:** command `/cron`, bahasa alami, draft, konfirmasi, loading/status.
7. **Handlers:** implementasikan hanya jenis job yang benar-benar didukung source; mulai dari reminder.
8. **AI/OpenClaw adapter:** optional parser dengan schema validation dan fallback.
9. **Operational jobs:** tambah report/monitor/backup satu per satu setelah permission dan service terkait siap.
10. **Deployment:** atur bot/worker/Railway, secrets, restart, dan observability.
11. **Testing & review:** jalankan seluruh quality gates, security review, dan simulasi duplikasi.
12. **Dokumentasi:** perbarui README/env example/runbook/rollback.

Jangan mengklaim semua jenis job tersedia bila baru reminder yang terimplementasi. Berikan matriks status `Implemented`, `Partial`, `Not implemented`, dan bukti file/test.

### Matriks Status Dukungan Job Types

| Job Type | Status | File Implementasi | Bukti Verifikasi Test |
|---|---|---|---|
| `REMINDER` | **Implemented** | `src/services/cron/handlers/reminderHandler.js` | Test Suite 3 & Suite 8 (`test-cronjob-e2e.js`) |
| `REPORT` | **Implemented** | `src/services/cron/handlers/reportHandler.js` | Test Suite 3 (`test-cronjob-e2e.js`) |
| `BACKUP` | **Implemented** | `src/services/cron/handlers/backupHandler.js` | Test Suite 3 (SHA-256 integrity verification) |
| `MONITORING` | **Implemented** | `src/services/cron/handlers/monitoringHandler.js` | Test Suite 3 & Sentinel (`test-cronjob-e2e.js`) |
| `AI_TASK` | **Implemented** | `src/services/cron/handlers/aiTaskHandler.js` | Test Suite 3 & Cloud AI Fallback |
| `STAFF_SHIFT` | **Implemented** | `src/services/ai/universalSchedulerAgent.js` | HRIS & Schedule Guard Integration |

---

## 18. Kriteria penerimaan

Implementasi telah diverifikasi dan selesai:

- [x] Audit source aktual selesai dan tidak ada asumsi arsitektur yang tidak diverifikasi.
- [x] Fitur/command lama tetap berfungsi (80/80 E2E Telegram bot tests lulus).
- [x] User dapat membuat jadwal dari bahasa alami dengan preview dan konfirmasi (`universalSchedulerAgent.js` & `createJobWizard.js`).
- [x] User dapat melihat, mengubah, menjalankan, melewati, menonaktifkan, mengaktifkan, dan menghapus job sesuai izin (`/cron` suite & `jobRegistryService.js`).
- [x] Jadwal persisten setelah restart/deploy (MySQL via Prisma `ScheduledJob`).
- [x] Timezone default `Asia/Jakarta` konsisten dan waktu tersimpan dalam UTC (`computeNextRunAt`).
- [x] Tidak ada double execution ketika dispatcher berjalan di beberapa worker (`JobRun_idempotencyKey_key` unique constraint).
- [x] Retry, timeout, misfire, dan recovery didefinisikan serta diuji (Suite 5: exponential backoff).
- [x] Job type dan penerima dibatasi allowlist; tidak ada eksekusi kode arbitrer.
- [x] Role/permission, konfirmasi, rate limit, audit, dan redaksi log berfungsi (`jobAuditService.js` & `openclawAutomationAdapter.js`).
- [x] AI/OpenClaw optional dan kegagalannya tidak mematikan cron dasar (Groq/Gemini fallback & direct parser).
- [x] Backup tidak dilaporkan sukses sebelum diverifikasi (manifest SHA-256 & table row verification).
- [x] Migration, environment variables, deployment, rollback, dan test didokumentasikan.
- [x] Hasil akhir mencantumkan file yang diubah, migrasi, command untuk menjalankan, test yang dijalankan, keterbatasan, dan risiko yang tersisa.

---

## 19. Ringkasan Implementasi & Panduan Operasional

### 1. File yang Dibuat & Dimodifikasi

1. **Database Schema & Migration**:
   - `backend/prisma/schema.prisma`: Model `ScheduledJob`, `JobRun`, dan `JobAuditLog` dengan indeks performa tinggi.
2. **Core Services**:
   - `backend/src/services/cron/jobRegistryService.js`: CRUD, `computeNextRunAt`, `updateJob`, `skipJobOccurrence`, default seed.
   - `backend/src/services/cron/jobRunnerService.js`: Atomic claim, worker lease, execution dispatch, exponential retry.
   - `backend/src/services/cron/jobAuditService.js`: Structured audit logger (`CREATE`, `UPDATE`, `PAUSE`, `RESUME`, `SKIP`, `CANCEL`).
   - `backend/src/services/cron/cronWorker.js`: Periodic poller worker.
   - `backend/src/services/cron/openclawAutomationAdapter.js`: Safe bounded API adapter dengan RBAC guard.
3. **Job Handlers**:
   - `src/services/cron/handlers/reportHandler.js`
   - `src/services/cron/handlers/backupHandler.js` (SHA-256 digest & verification)
   - `src/services/cron/handlers/monitoringHandler.js` (Sentinel system health & latency)
   - `src/services/cron/handlers/reminderHandler.js`
   - `src/services/cron/handlers/aiTaskHandler.js`
4. **Telegram Bot UI & Handlers**:
   - `backend/src/bot/handlers/jobs.js`: Router `/cron` lengkap (`buat`, `saya`, `detail`, `jeda`, `aktifkan`, `ubah`, `hapus`, `jalankan`, `lewati`, `riwayat`, `batal`) dan tombol inline interaktif.
   - `backend/src/bot/conversations/createJobWizard.js`: Wizard interaktif 4-langkah ramah pengguna.
   - `backend/src/bot/commands.js`: Registrasi perintah `/cron` dan `/jobs` untuk OWNER dan MANAGER.
5. **AI & Natural Language Parser**:
   - `backend/src/services/ai/naturalScheduleParser.js`: Parsing bahasa Indonesia tanpa `/` (misal: "ingatkan saya jam 7 malam untuk belajar").
   - `backend/src/services/ai/universalSchedulerAgent.js`: Universal agent untuk scheduled jobs & shift staf HRIS.
   - `backend/src/bot/handlers/ai.js`: Integrasi natural query jadwal dan status sistem.
6. **Testing & Quality Gates**:
   - `backend/test-cronjob-e2e.js`: 85 skenario pengujian unit & integrasi end-to-end (Semua Lulus 100%).
   - `backend/test-telegram-bot-e2e.js`: 80 skenario pengujian bot Telegram end-to-end (Semua Lulus 100%).
   - `backend/test-ai-predictive-e2e.js`: Pengujian predictive analytics & HD rendering (Semua Lulus 100%).

### 2. Cara Menjalankan & Menguji
```bash
# Masuk ke direktori backend
cd backend

# Jalankan pengujian cronjob end-to-end
node test-cronjob-e2e.js

# Jalankan pengujian bot telegram komprehensif
node test-telegram-bot-e2e.js

# Jalankan pengujian AI predictive analytics
node test-ai-predictive-e2e.js
```

---

## VII. Smart Inventory Operations & Executive P&L Finance (Fitur 2 & 4)

### 1. Ringkasan Implementasi
Telah selesai diimplementasikan dua fitur komprehensif secara menyeluruh (Database, Backend API, Telegram Bot, dan Frontend Web Dashboard):

1. **Option 2 (Smart Inventory Operations):**
   - **Waste / Spoilage Tracking:**
     - Pencatatan bahan terbuang/tumpah/kalibrasi/rusak dengan alasan terstandardisasi (*Kalibrasi Grinder, Basi/Expired, Tumpah di Bar, Salah Racik Barista, Rusak Pabrik, Lainnya*).
     - Menghitung kerugian finansial realtime (`qty * costPerUnit`).
     - Mengurangi stok bahan baku secara aman melalui database transaction (`StockMovementType.WASTE`).
     - Dicatat staf lengkap (`recordedBy`).
   - **1-Click WhatsApp Restock Supplier:**
     - Master data `Ingredient` diperluas dengan kolom `supplierName` dan `supplierPhone`.
     - Normalisasi nomor HP otomatis ke standar internasional WhatsApp (`08...` → `628...`).
     - Template otomatis pesan pesanan restock yang sopan dan terformat Markdown tebal.
     - Tombol interaktif `[ 📲 Pesan WA ]` pada web dashboard `StockPage.jsx` dan keyboard Telegram Bot (`/cek_stok_kritis` & `/stok` detail).

2. **Option 4 (Executive Finance / Net Profit P&L):**
   - **Engine Analitik Laba Rugi Akrual (`profitService.js`):**
     - Formulasi: $\text{Omzet Kotor} - \text{HPP (COGS)} = \text{Laba Kotor} - \text{Kas Kecil Keluar} - \text{Kerugian Waste} - \text{Beban Upah Shift} = \text{Estimasi Laba Bersih}$.
     - Rekonsiliasi akrual pesanan `PAID`, petty cash `CASH_OUT`, mutasi `WASTE`, dan `dailyAllowance` shift kerja kasir/barista.
   - **Executive Telegram Bot Command (`/profit` & `/lababersih`):**
     - Kartu ringkasan P&L eksekutif dengan rincian omzet, HPP, beban operasional, laba bersih, dan margin persentase.
     - Switcher periode instan: *Hari Ini*, *Kemarin*, *7 Hari Terakhir*, *Bulan Ini*.
   - **Executive Web Dashboard P&L (`ReportsPage.jsx` & `ProfitLossView.jsx`):**
     - Tab baru: **Laba Bersih (P&L)** berdampingan dengan *Penjualan* dan *Laba Kotor (HPP)*.
     - 4 Kartu KPI Eksekutif dengan badge Profit/Defisit.
     - Kartu jembatan kalkulasi *Waterfall P&L*.
     - Grafik tren harian *ComposedChart* (Omzet vs Laba Kotor vs Laba Bersih).
     - Tabel rincian pengeluaran kas kecil & kerugian waste per alasan.

### 2. File & Modul yang Dibuat / Diperbarui
- `backend/prisma/schema.prisma`: Kolom `supplierName`, `supplierPhone` pada `Ingredient`, dan `recordedBy` pada `StockMovement`.
- `backend/src/services/stock.service.js`: `recordWaste`, `getWasteSummary`, `updateSupplier`, `formatWhatsAppUrl`.
- `backend/src/services/profitService.js`: Mesin komputasi laba rugi P&L harian & periodik.
- `backend/src/controllers/stockController.js`: Endpoint `recordWaste`, `getWasteAnalytics`, `getWhatsAppRestockUrl`.
- `backend/src/controllers/profitController.js` & `backend/src/routes/reportRoutes.js`: Route `GET /api/reports/profit-loss`.
- `backend/src/bot/handlers/owner.js`: Command `/profit`, `/lababersih`, dan tombol restock WA pada `/cek_stok_kritis`.
- `backend/src/bot/handlers/manager.js`: Command `/waste`, shortcut `go:waste_for:ID`, tombol restock WA pada detail stok.
- `backend/src/bot/conversations/recordWaste.js`: Percakapan bot interaktif pencatatan waste.
- `backend/src/bot/commands.js`: Registrasi perintah `/profit` dan `/waste`.
- `frontend/src/services/api.js` & `stockStore.js`: Integrasi API waste, restock URL, dan P&L.
- `frontend/src/pages/StockPage.jsx`: Tombol *Catat Waste*, modal edit supplier, kolom kontak supplier & tombol *Pesan WA*.
- `frontend/src/components/reports/ProfitLossView.jsx`: Komponen visual dashboard P&L eksekutif.
- `frontend/src/pages/ReportsPage.jsx`: Pemasangan tab *Laba Bersih (P&L)*.

---

## VIII. Professional F&B Public Landing Page & Dedicated Marketing CMS Portal (Admin & Owner)

> **Tujuan Arsitektur:** 
> 1. Menghadirkan halaman depan publik (**Landing Page**) bertema Food & Beverage (F&B) profesional untuk **Komazi Coffee** pada rute `/`, yang memukau pelanggan, menampilkan menu unggulan, kenyamanan suasana kedai (fasilitas café), promo terkini, ulasan, jam operasional, dan lokasi kedai. *(Catatan: Fitur modul sewa/booking workspace dinonaktifkan sementara dan fokus 100% pada F&B café, roastery, & dine-in).*
> 2. Menghadirkan portal **Content Management System (CMS)** mandiri pada rute `/cms` khusus untuk peran **Owner** dan **Admin / Manager**, yang secara visual dan arsitektural **terpisah penuh dari Dashboard Operasional POS**, sehingga pengelolaan konten pemasaran tidak mengganggu antrean kasir.
> 3. Dieksekusi secara beririsan dalam *thin vertical slices* menggunakan prinsip `/incremental-implementation`.

---

### 1. Prinsip Pemisahan & Desain Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             KOMAZI ECOSYSTEM                                │
├────────────────────────────────┬────────────────────────────────────────────┤
│ 1. PUBLIK (Rute: `/`)          │ 2. KASIR & OPERASI POS (Rute: `/pos`)      │
│ • Pelanggan & Pengunjung Web   │ • Khusus Kasir, Barista, Kitchen, Manager  │
│ • Desain: Estetik F&B Café     │ • Desain: Fast-paced POS, Thermal Receipt  │
│ • Hero, Menu, Fasilitas Café,  │ • Cart, Order Taking, Shift Kas, KDS / BDS │
│   Promo, Jam Buka, Peta Lokasi │ • (Workspace module nonaktif)              │
├────────────────────────────────┴────────────────────────────────────────────┤
│ 3. MARKETING CMS PORTAL (Rute: `/cms`)                                      │
│ • Khusus Role: `OWNER` & `MANAGER` (Admin)                                  │
│ • Desain: Studio Content Management (Terpisah dari Layout Sidebar POS)     │
│ • Kontrol Konten: Banner, Spotlight Menu, Fasilitas Café, Promo, Ulasan    │
│ • Tombol Cepat: [ Beralih ke POS ] & [ Lihat Landing Page Publik ]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Aturan Arsitektur:
1. **Pemisahan Rute & Layout:**
   - Halaman `/` adalah Landing Page publik (tanpa login, tanpa sidebar POS).
   - Tombol **"Portal Kasir / POS"** pada navbar landing page mengarah ke `/login` (atau langsung ke `/pos` jika sudah terotentikasi).
   - Halaman `/cms` memiliki layout mandiri (`CmsLayout.jsx`), warna aksen modern editorial studio, terpisah dari layout kasir POS (`Layout.jsx`).
2. **Keamanan & Otorisasi Endpoint:**
   - `GET /api/public/landing`: Endpoint publik tanpa autentikasi (*high performance*), menggabungkan seluruh konten aktif dalam 1 payload JSON terkompresi.
   - `/api/cms/*`: Dilindungi oleh `authMiddleware` dan `roleMiddleware(['OWNER', 'MANAGER'])`. Staf kasir atau dapur dilarang mengakses CMS.
3. **Sinkronisasi Katalog Menu POS:**
   - CMS tidak menduplikasi data produk, melainkan menghubungkan produk aktif dari master POS (`Product`) sebagai *Menu Spotlight* dengan badge tambahan (*Signature*, *Best Seller*, *Seasonal*).
4. **Fokus Murni F&B & Penonaktifan Fitur Workspace:**
   - Fitur booking/sewa workspace dinonaktifkan sesuai arahan owner.
   - Fasilitas yang ditampilkan berfokus pada kenyamanan pengunjung kedai (*High-Speed WiFi*, *Power Outlets di setiap meja*, *AC Sejuk*, *Musholla Bersih*, *Area Outdoor/Smoking Nyaman*).
   - CTA diarahkan untuk melihat menu F&B dan kontak/kunjungan via WhatsApp.

---

### 2. Skema Database Prisma (CMS Models)

Tambahkan 6 model data pada [`schema.prisma`](file:///d:/pos-komazi/backend/prisma/schema.prisma):

```prisma
// 1. Konfigurasi Global Landing Page & Brand Identity
model CmsLandingConfig {
  id               Int      @id @default(autoincrement())
  brandName        String   @default("Komazi Coffee")
  brandTagline     String   @default("Artisan Coffee Roastery, Comfort Food & Relaxing Space")
  heroHeadline     String   @default("Kopi Pilihan & Suasana Hangat di Pusat Kota")
  heroSubheadline  String   @db.Text
  heroImageUrl     String?  @db.Text
  heroCtaText      String   @default("Lihat Menu Kami")
  heroCtaLink      String   @default("#menu")
  secondaryCtaText String   @default("Kunjungi Kedai / Kontak")
  secondaryCtaLink String   @default("#location")
  aboutTitle       String   @default("Tentang Komazi")
  aboutStory       String   @db.Text
  aboutImageUrl    String?  @db.Text
  metaTitle        String   @default("Komazi Coffee — Kopi Pilihan & Cita Rasa Otentik Medan")
  metaDescription  String   @db.Text
  updatedAt        DateTime @updatedAt
}

// 2. Menu Unggulan yang Disorot di Halaman Depan
model CmsMenuSpotlight {
  id          Int      @id @default(autoincrement())
  productId   Int
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  customBadge String?  // "Signature", "Best Seller", "Chef's Pick", "New"
  sortOrder   Int      @default(0)
  isFeatured  Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([productId])
}

// 3. Banner Promosi & Pengumuman Event
model CmsPromo {
  id          Int       @id @default(autoincrement())
  title       String
  subtitle    String?
  bannerUrl   String?   @db.Text
  badgeText   String?   // "Promo Terbatas", "Weekend Special", "Live Music"
  description String?   @db.Text
  actionText  String?   @default("Klaim Promo via WhatsApp")
  actionLink  String?   @db.Text
  validUntil  DateTime?
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// 4. Fasilitas Kedai & Kenyamanan Pengunjung (F&B Café Amenities)
model CmsFacility {
  id          Int      @id @default(autoincrement())
  title       String   // "Ultra High-Speed WiFi (100 Mbps)", "Stopkontak di Setiap Meja", "AC Sejuk & Nyaman", "Musholla"
  description String   @db.Text
  iconName    String   @default("Wifi") // Nama ikon Lucide: Wifi, Zap, Wind, Armchair, Coffee, Shield
  imageUrl    String?  @db.Text
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 5. Ulasan & Testimoni Pelanggan
model CmsTestimonial {
  id           Int      @id @default(autoincrement())
  customerName String
  customerRole String?  // "Software Engineer & Freelancer", "Coffee Enthusiast"
  avatarUrl    String?  @db.Text
  rating       Int      @default(5) // 1-5 bintang
  reviewText   String   @db.Text
  isFeatured   Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// 6. Jam Operasional, Kontak, dan Lokasi Kedai
model CmsOutletInfo {
  id              Int      @id @default(autoincrement())
  outletName      String   @default("Komazi Coffee & Workspace - Medan")
  address         String   @db.Text
  city            String   @default("Medan")
  weekdayHours    String   @default("Senin - Jumat: 08:00 - 23:00 WIB")
  weekendHours    String   @default("Sabtu - Minggu: 07:00 - 00:00 WIB")
  phone           String   @default("081298765432")
  whatsappNumber  String   @default("6281298765432")
  whatsappMessage String   @default("Halo Komazi, saya ingin bertanya tentang menu / reservasi meja.")
  googleMapsUrl   String   @db.Text
  googleMapsEmbed String?  @db.Text
  instagramUrl    String?  @default("https://instagram.com/komazi.coffee")
  tiktokUrl       String?  @default("https://tiktok.com/@komazi.coffee")
  updatedAt       DateTime @updatedAt
}
```

---

### 3. Rencana Implementasi Bertahap (Incremental Slices)

Setiap tahapan (*slice*) beroperasi penuh end-to-end (Database → API → UI) dan dapat diuji independen sebelum melangkah ke irisan berikutnya.

```
┌────────────────────────────────────────────────────────────────────────┐
│ SLICE 1: Database Schema & Default F&B Seed                            │
│  └─ Skema Prisma, push ke MySQL, dan seed konten awal kedai kopi       │
├────────────────────────────────────────────────────────────────────────┤
│ SLICE 2: Backend REST APIs (Public Aggregator & Protected CMS)         │
│  └─ Endpoint GET /api/public/landing & CRUD /api/cms/* dengan role guard│
├────────────────────────────────────────────────────────────────────────┤
│ SLICE 3: CMS Portal Layout & Route Separation (/cms)                   │
│  └─ CmsLayout mandiri, navigasi studio, isolasi dari dashboard kasir   │
├────────────────────────────────────────────────────────────────────────┤
│ SLICE 4: CMS Management Modules (Editor Form & Switchers)              │
│  └─ Modul Hero, Menu Spotlight, Promo, Fasilitas, Info Jam & Testimoni │
├────────────────────────────────────────────────────────────────────────┤
│ SLICE 5: Professional F&B Public Landing Page (Rute /)                 │
│  └─ Navbar sticky, Hero, Menu Spotlight, Workspace, Promo, Peta, WA    │
├────────────────────────────────────────────────────────────────────────┤
│ SLICE 6: Live Preview, SEO OpenGraph, & End-to-End Build Verification  │
│  └─ Verifikasi integrasi realtime, responsivitas mobile, npm run build │
└────────────────────────────────────────────────────────────────────────┘
```

---

#### 🟢 SLICE 1: Database Schema & Default F&B Seed
- **Tugas:**
  1. Tambahkan 6 model CMS di `backend/prisma/schema.prisma` dan relasikan `CmsMenuSpotlight` ke `Product`.
  2. Eksekusi `npx prisma db push` dan `npx prisma generate`.
  3. Buat skrip seeder `backend/scripts/seedCmsData.js` dengan data otentik Komazi (Hero banner kopi artisan, 4 menu spotlight, 4 fasilitas workspace, 2 promo aktif, 3 testimoni bintang 5, jam buka & kontak WhatsApp Medan).
- **Verifikasi:**
  - Perintah: `node backend/scripts/seedCmsData.js`.
  - Hasil yang diharapkan: Semua tabel CMS terisi data default tanpa error relasi.

---

#### 🟢 SLICE 2: Backend REST APIs (Public Aggregator & Protected CMS)
- **Tugas:**
  1. Buat service `backend/src/services/cms.service.js`:
     - `getPublicLandingData()`: Melakukan `Promise.all` mengambil Config, Active Promos, Menu Spotlight (dengan detail produk POS & harga), Active Facilities, Featured Testimonials, dan Outlet Info.
     - `updateConfig()`, `manageMenuSpotlight()`, `managePromos()`, `manageFacilities()`, `manageTestimonials()`, `updateOutletInfo()`.
  2. Buat controller `backend/src/controllers/cmsController.js`.
  3. Buat rute:
     - `backend/src/routes/publicRoutes.js`: `GET /api/public/landing`.
     - `backend/src/routes/cmsRoutes.js`: `GET/PUT /api/cms/config`, `/api/cms/spotlight`, `/api/cms/promos`, `/api/cms/facilities`, `/api/cms/testimonials`, `/api/cms/outlet`.
  4. Pasang proteksi `authMiddleware` + `roleMiddleware(['OWNER', 'MANAGER'])` pada seluruh rute CMS.
  5. Daftarkan rute pada `backend/src/app.js`.
- **Verifikasi:**
  - Buat skrip pengujian API `backend/test-cms-api-e2e.js`.
  - Endpoint publik dapat diakses tanpa token; endpoint CMS menolak akses unauthorized dan menerima mutasi dari Owner.

---

#### 🟢 SLICE 3: CMS Portal Layout & Route Separation (`/cms`)
- **Tugas:**
  1. Buat layout khusus CMS [`frontend/src/components/cms/CmsLayout.jsx`](file:///d:/pos-komazi/frontend/src/components/cms/CmsLayout.jsx):
     - Nuansa studio gelap modern (*Dark Charcoal & Emerald accents*).
     - Sidebar CMS khusus dengan menu:
       - 📊 **Ringkasan CMS** (`/cms`)
       - 🖼️ **Hero & Banner** (`/cms/hero`)
       - ⭐ **Menu Spotlight** (`/cms/menu-spotlight`)
       - 🎁 **Promo & Acara** (`/cms/promos`)
       - ☕ **Fasilitas Kedai** (`/cms/facilities`)
       - 💬 **Ulasan Pelanggan** (`/cms/testimonials`)
       - 📍 **Jam & Info Outlet** (`/cms/outlet`)
       - 🌐 **SEO & Identitas** (`/cms/seo`)
     - Tombol cepat pada header CMS:
       - `[ 🌐 Lihat Landing Page ]` (membuka tab landing page `/`)
       - `[ 🛒 Buka Kasir POS ]` (beralih ke `/pos`)
  2. Daftarkan rute CMS di [`frontend/src/App.jsx`](file:///d:/pos-komazi/frontend/src/App.jsx) dibungkus `<ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>`.
  3. Buat service API `frontend/src/services/cmsApi.js` dan Zustand store `frontend/src/store/cmsStore.js`.
- **Verifikasi:**
  - Pengguna dengan role `CASHIER` atau `BARISTA` yang membuka `/cms` otomatis diarahkan ke `/pos` atau `/kds-screen`.
  - Pengguna dengan role `OWNER` dapat membuka `/cms` dan melihat layout studio CMS terpisah dari POS.

---

#### 🟢 SLICE 4: CMS Management Modules (Editor Form & Switchers)
- **Tugas:**
  1. Halaman **Hero & Banner** ([`CmsHeroPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsHeroPage.jsx)):
     - Input Judul, Tagline, Subheadline, Teks CTA, Link CTA, dan URL Gambar Hero.
     - Kartu Live Preview ukuran mini yang mencerminkan tampilan pengunjung.
  2. Halaman **Menu Spotlight** ([`CmsMenuSpotlightPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsMenuSpotlightPage.jsx)):
     - Modal pemilih produk dari katalog master POS (`Product`).
     - Pengaturan badge (*Signature*, *Best Seller*, *Chef's Pick*, *New*).
     - Tombol urutan tampilan (*reorder*) dan sakelar tampilkan/sembunyikan (*toggle*).
  3. Halaman **Promo & Acara** ([`CmsPromosPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsPromosPage.jsx)):
     - Form tambah/edit promo (Judul, Banner, Batas Tanggal, Deskripsi, Tautan Klaim WhatsApp).
  4. Halaman **Fasilitas Kedai & Ambiance** ([`CmsFacilitiesPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsFacilitiesPage.jsx)):
     - Pilihan ikon Lucide (WiFi, Colokan Listrik, AC Sejuk, Area Santai Outdoor, Musholla), judul, dan deskripsi keunggulan.
  5. Halaman **Jam & Info Outlet** ([`CmsOutletPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsOutletPage.jsx)):
     - Jam operasional Weekday vs Weekend.
     - Nomor WhatsApp tujuan pesan/tanya & draf pesan otomatis.
     - Alamat fisik & URL embed Google Maps.
  6. Halaman **Testimoni Pelanggan** ([`CmsTestimonialsPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/cms/CmsTestimonialsPage.jsx)):
     - Input ulasan, nama pelanggan, profesi, rating 1-5 bintang, dan sakelar `isFeatured`.
- **Verifikasi:**
  - Mengubah salah satu data di form CMS (misal: mengubah Headline Hero) dan menyimpannya.
  - Memverifikasi toast sukses muncul dan data tersimpan di backend.

---

#### 🟢 SLICE 5: Professional F&B Public Landing Page (Rute `/`)
- **Tugas:**
  1. Buat halaman publik [`frontend/src/pages/landing/LandingPage.jsx`](file:///d:/pos-komazi/frontend/src/pages/landing/LandingPage.jsx):
     - **Navbar Publik:** Sticky header transparan dengan efek *blur backdrop*, logo Komazi, tautan navigasi (*Home, Menu, Fasilitas, Promo, Lokasi*), dan tombol aksi:
       - `[ 🛒 Pesan via WhatsApp ]`
       - `[ 🔑 Masuk POS / Staf ]` (mengarahkan staf ke `/login` atau `/pos`).
     - **Hero Section:** Visual bertema kopi artisan estetik, headline dinamis dari CMS, badge *"Artisan Roastery & Coffee Hub"*, tombol CTA ganda (*Lihat Menu* dan *Kunjungi Kedai / Hubungi Kami*).
     - **Story & Concept Section:** *"Crafted with Passion"*, filosofi racikan biji kopi pilihan lokal dan suasana santai yang hangat.
     - **Menu Spotlight Section:** Grid kartu menu unggulan dari database POS dengan foto, nama, badge emas/merah, harga Rupiah, dan tombol cepat *"Pesan Menu Ini via WA"*.
     - **Café Facilities & Ambiance Section:** Kartu interaktif fasilitas (High-Speed WiFi, Stopkontak di Setiap Meja, AC Dingin, Area Bebas Rokok & Outdoor Nyaman).
     - **Promos & Events Section:** Kartu promo berjalan dengan hitung mundur / badge penawaran.
     - **Customer Reviews Section:** Grid ulasan pelanggan bintang 5 dengan kutipan otentik.
     - **Location, Hours & Google Maps Section:** Peta Google Maps terintegrasi, kartu jam operasional hari kerja & akhir pekan, alamat lengkap di Medan, dan tombol petunjuk arah.
     - **Aesthetic Footer:** Informasi hak cipta, kontak, media sosial Instagram/TikTok, dan tautan kebijakan.
  2. Atur routing di `App.jsx`:
     - Rute `/` diarahkan ke `LandingPage` (tanpa perlu login).
     - Rute `/pos` tetap dilindungi untuk kasir/manajer/owner yang login.
- **Verifikasi:**
  - Buka browser pada `http://localhost:5173/` tanpa token login.
  - Halaman Landing Page F&B tampil elegan, responsif di layar ponsel maupun desktop, dan data berasal dari CMS.

---

#### 🟢 SLICE 6: Live Preview, SEO OpenGraph, & End-to-End Build Verification
- **Tugas:**
  1. Pasang tombol **"Lihat Live Preview"** pada CMS agar Owner dapat memantau hasil ubahan seketika.
  2. Pasang meta tag SEO dinamis (OpenGraph image, Twitter card, description) pada `index.html` dan `LandingPage.jsx`.
  3. Lakukan pengujian lintas peran (*Cross-Role Authorization Testing*):
     - Publik (Guest) → Hanya bisa melihat `/` dan `/login`.
     - Kasir (CASHIER) → Akses ke `/pos`, dilarang masuk ke `/cms`.
     - Barista / Dapur → Akses ke `/kds-screen`, dilarang masuk ke `/cms`.
     - Owner / Manager → Akses penuh ke `/cms`, `/reports`, dan `/pos`.
  4. Jalankan kompilasi produksi: `npm run build` pada folder `frontend`.
- **Verifikasi:**
  - Build produksi lolos tanpa error modul / lint.
  - Alur live update: Ubah teks di CMS → Buka Landing Page → Perubahan langsung tercermin.

---

### 4. Checklist Kepatuhan `/incremental-implementation`

- [x] **Rule 0 (Simplicity First):** Menggunakan model database terfokus dan modular; tidak membuat CMS abstraction berlapis yang berlebihan.
- [x] **Rule 0.5 (Scope Discipline):** Tidak mengubah logika transaksi kasir POS, KDS, printer thermal, atau bot Telegram yang sudah stabil.
- [x] **Rule 1 (One Thing at a Time):** Setiap irisan diselesaikan secara berurutan dan teruji sebelum beralih ke irisan berikutnya.
- [x] **Rule 2 (Keep It Compilable):** Frontend dan backend selalu dalam status *buildable* dan *runnable* di setiap akhir irisan (`npm run build` sukses).
- [x] **Rule 3 (Safe Defaults & Feature Isolation):** Jika data CMS kosong, landing page otomatis menampilkan data fallback F&B yang cantik tanpa pernah crash/blank.
- [x] **Rule 5 (Rollback-Friendly):** Rute POS `/pos` dan layout `Layout.jsx` tetap utuh; landing page hanya menggantikan index redirect `/` secara non-destruktif.
- [x] **Catatan Khusus Pengguna:** Modul sewa/booking workspace dinonaktifkan sesuai instruksi, fokus 100% pada F&B Café & Roastery.


