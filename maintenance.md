# PANDUAN PEMELIHARAAN SISTEM PRODUKSI (MAINTENANCE RUNBOOK)
**Komazi POS — Coffee & Workspace Management System**  
**Arsitektur Hosting:** Frontend (Vercel) | Backend (Railway) | Database (MySQL) | Repository (GitHub)  
**Dokumen Standar Operasional & Kontrak Rekayasa Sistem**

---

## DAFTAR ISI
1. [Prinsip Utama & Aturan Keamanan](#1-prinsip-utama--aturan-keamanan)
2. [Workflow Development & Git Branching](#2-workflow-development--git-branching)
3. [Arsitektur Staging & Pemisahan Lingkungan](#3-arsitektur-staging--pemisahan-lingkungan)
4. [Daftar Lengkap Environment Variables](#4-daftar-lengkap-environment-variables)
5. [Strategi Database, Migrasi Baseline & Skema Expand-Contract](#5-strategi-database-migrasi-baseline--skema-expand-contract)
6. [Prosedur Backup & Restore MySQL](#6-prosedur-backup--restore-mysql)
7. [Automated Testing & Quality Gate](#7-automated-testing--quality-gate)
8. [Deployment Checklist (Pre, During & Post)](#8-deployment-checklist)
9. [Prosedur Rollback Cepat (Frontend, Backend & Database)](#9-prosedur-rollback-cepat)
10. [Prosedur Penanganan Insiden (Incident Response Runbook)](#10-prosedur-penanganan-insiden)
11. [Verifikasi Pasca-Rilis (Smoke Test Checklist)](#11-verifikasi-pasca-rilis)

---

## 1. PRINSIP UTAMA & ATURAN KEAMANAN

1. **Zero Production Direct Push:** Jangan pernah melakukan `git push origin main` secara langsung. Semua perubahan kode wajib melalui Feature Branch dan Pull Request (PR).
2. **Zero Plain Secrets:** Jangan pernah menyalin, menampilkan, atau memasukkan kredensial, connection string database, atau private key ke source code, file log, dokumentasi publik, atau Git.
3. **Database Protection:** Jangan pernah menjalankan `prisma db push`, `db:setup`, `prisma migrate reset`, atau `prisma/seed.js` pada database production. Gunakan selalu `prisma migrate deploy` untuk migrasi yang telah diuji di staging.
4. **Isolated Testing:** Jangan pernah menggunakan database production untuk pengujian lokal, Vercel preview, ataupun automated testing.
5. **Decoupled Deployments:** Rollback kode tidak secara otomatis memulihkan database. Setiap perubahan skema database harus backward-compatible (metode expand-contract).

---

## 2. WORKFLOW DEVELOPMENT & GIT BRANCHING

```
[Local Dev: feature/xyz]
          │
          ▼  (Push branch)
[GitHub: Pull Request -> staging / preview]
          │
          ├──▶ [GitHub Actions CI]: Backend Test + Frontend Lint + Test + Build
          ├──▶ [Vercel Preview]: Frontend otomatis dideploy ke *.vercel.app preview
          └──▶ [Railway Staging]: Backend terhubung ke MySQL Staging terpisah
          │
          ▼  (Review & Smoke Test oleh Tim)
[Persetujuan Pengguna / Tech Lead]
          │
          ▼  (Merge PR ke branch `main`)
[Production Release]
          ├──▶ [Vercel Production]: komazi-pos.vercel.app terupdate
          └──▶ [Railway Production]: Container backend live terdeploy
```

### Panduan Branch Naming
* `feat/<nama-fitur>`: Penambahan fitur baru (misal: `feat/excel-tax-rounding`).
* `fix/<nama-bug>`: Perbaikan bug aplikasi (misal: `fix/kds-bump-race-condition`).
* `perf/<area>`: Optimasi performa frontend/backend (misal: `perf/order-query-indexing`).
* `refactor/<nama>`: Perapihan arsitektur tanpa mengubah kontrak API.

---

## 3. ARSITEKTUR STAGING & PEMISAHAN LINGKUNGAN

| Aspek | Lingkungan Production | Lingkungan Staging / Preview | Lingkungan Local Dev |
| :--- | :--- | :--- | :--- |
| **Frontend Host** | Vercel (`main` branch) | Vercel Preview (PR / branch preview) | `http://localhost:5173` |
| **Backend Host** | Railway (`komazi-pos-backend`) | Railway (`komazi-backend-staging`) | `http://localhost:4000` |
| **Database** | Railway MySQL (`komazi_prod`) | Railway MySQL (`komazi_staging`) | MySQL Local (`komazi_pos`) |
| **CORS Origins** | Domain resmi & `*.vercel.app` terdaftar | Domain preview `komazi-pos-*.vercel.app` | `localhost`, `127.0.0.1`, LAN |
| **Media Storage** | Cloudinary Folder: `komazi_prod/` | Cloudinary Folder: `komazi_staging/` | Local `/uploads` fallback |
| **Telegram Bot** | Bot Utama (Mode Webhook) | Bot Staging / Test Bot (Polling) | Opsional (Polling / mock) |

### Langkah Penyiapan Staging di Railway (Jika Belum Tersedia):
1. Buka dashboard Railway project Komazi.
2. Klik **New Service** > **Database** > **Add MySQL**. Beri nama service: `mysql-staging`.
3. Klik **New Service** > **GitHub Repo** > pilih repositori `komazi-pos`, atur root directory ke `backend`.
4. Beri nama service: `backend-staging`, set branch ke `staging` atau PR preview.
5. Tambahkan variable `DATABASE_URL` mengarah ke `mysql-staging`.
6. Atur `FRONTEND_URL` di `backend-staging` ke domain preview Vercel Anda.

---

## 4. DAFTAR LENGKAP ENVIRONMENT VARIABLES

### A. Backend Variables (Railway)

| Nama Variabel | Wajib/Opsional | Deskripsi & Nilai Rekomendasi |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Wajib** | Connection string MySQL (`mysql://user:pass@host:port/db_name`). |
| `PORT` | **Wajib** | Disediakan otomatis oleh Railway (fallback lokal: `4000`). |
| `FRONTEND_URL` | **Wajib** | Domain frontend yang diizinkan CORS (pisahkan koma jika jamak). |
| `NODE_ENV` | **Wajib** | `production` untuk server live, `development` untuk lokal. |
| `TZ` | Rekomendasi | Zona waktu server: `Asia/Jakarta` (WIB). |
| `JWT_SECRET` | **Wajib (Kritis)** | String acak minimal 32 karakter untuk enkripsi token akses. |
| `JWT_REFRESH_SECRET` | **Wajib (Kritis)** | String acak minimal 32 karakter untuk enkripsi refresh token. |
| `CLOUDINARY_CLOUD_NAME`| Opsional | Nama cloud Cloudinary untuk asset foto menu & absensi. |
| `CLOUDINARY_API_KEY` | Opsional | API Key Cloudinary. |
| `CLOUDINARY_API_SECRET`| Opsional | API Secret Cloudinary. |
| `GROQ_API_KEY` | Opsional | API Key Groq LPU untuk AI Sales Engine (~300ms ultra-fast). |
| `GROQ_MODEL` | Opsional | Model Groq (default: `openai/gpt-oss-120b`). |
| `GEMINI_API_KEY` | Opsional | Fallback AI Google Gemini Cloud (`gemini-1.5-flash`). |
| `AI_PRIMARY_PROVIDER` | Opsional | Provider utama analitik AI: `groq` atau `gemini`. |
| `TELEGRAM_BOT_TOKEN` | Opsional | Token Bot Telegram dari @BotFather. |
| `TELEGRAM_WEBHOOK_URL` | Opsional | URL public backend di Railway (`https://xxx.up.railway.app`). |
| `TELEGRAM_WEBHOOK_SECRET`| Opsional| Secret header verifikasi webhook Telegram anti-spoofing. |
| `PUPPETEER_EXECUTABLE_PATH`| Opsional| `/usr/bin/chromium` (dikonfigurasi via `nixpacks.toml`). |
| `DISABLE_PUPPETEER` | Opsional | Set `true` jika container Railway minim RAM untuk mitigasi OOM. |
| `FIREBASE_SERVICE_ACCOUNT`| Opsional| String JSON credentials Firebase FCM untuk notifikasi Android. |

### B. Frontend Variables (Vercel)

| Nama Variabel | Wajib/Opsional | Deskripsi |
| :--- | :--- | :--- |
| `VITE_API_URL` | **Wajib** | Endpoint API backend (misal: `https://xxx.up.railway.app/api/v1`). |
| `VITE_SOCKET_URL` | **Wajib** | Endpoint WebSocket backend (misal: `https://xxx.up.railway.app`). |

---

## 5. STRATEGI DATABASE, MIGRASI BASELINE & SKEMA EXPAND-CONTRACT

### A. Bahaya `prisma db push` di Production
Perintah `prisma db push` membandingkan skema lokal langsung ke database live tanpa mencatat riwayat migrasi. Jika sebuah kolom diubah atau dihapus di `schema.prisma`, `db push` dapat **menghapus kolom dan seluruh data transaksi yang ada di dalamnya secara permanen**.

### B. Cara Membuat Baseline Migration Resmi
Sebelum merilis fitur yang mengubah skema database, buat folder migrasi awal (baseline) dari database yang sedang berjalan:

```bash
# 1. Jalankan di lokal dengan database staging/copy
cd backend
npx prisma migrate dev --name init_baseline --create-only

# 2. Tandai database yang sudah ada sebagai migrated tanpa mengeksekusi ulang SQL
npx prisma migrate resolve --applied init_baseline
```

### C. Pola Expand-Contract untuk Zero-Downtime Migration
Jika ingin mengganti atau menghapus nama kolom/relasi:
1. **Fase 1 (Expand):** Tambahkan kolom baru sebagai nullable/default. Backend mendukung membaca kolom baru dan lama sekaligus. Deploy kode dan jalankan migrasi.
2. **Fase 2 (Backfill):** Jalankan skrip latar belakang untuk menyalin data dari kolom lama ke kolom baru.
3. **Fase 3 (Contract):** Ubah kode backend untuk hanya menulis dan membaca kolom baru. Hapus referensi kolom lama.
4. **Fase 4 (Cleanup):** Pada rilis berikutnya, hapus kolom lama dari database dengan migrasi terpisah.

---

## 6. PROSEDUR BACKUP & RESTORE MYSQL

### A. Prosedur Backup Sebelum Rilis Berisiko
Jalankan backup snapshot melalui tools CLI MySQL atau Railway Dashboard sebelum melakukan release besar atau migrasi skema:

```bash
# Export snapshot MySQL terkompresi dengan timestamp WIB
mysqldump -h <RAILWAY_HOST> -u <USER> -p<PASSWORD> -P <PORT> \
  --single-transaction --quick --lock-tables=false \
  --routines --triggers komazi_prod | gzip > "backup_komazi_prod_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### B. Verifikasi Keberhasilan Backup
1. Periksa ukuran berkas: pastikan berkas `.sql.gz` memiliki ukuran logis (bukan berkas kosong 0 byte).
2. Verifikasi integritas kompresi:
   ```bash
   gzip -t backup_komazi_prod_*.sql.gz && echo "Backup valid & uncorrupted"
   ```

### C. Prosedur Uji Restore (Hanya pada Database Staging)
**PENTING: JANGAN PERNAH MENJALANKAN RESTORE LANGSUNG KE PRODUCTION.**

```bash
# Restore ke database staging terpisah
gunzip -c backup_komazi_prod_20261017.sql.gz | mysql -h <STAGING_HOST> -u <USER> -p<PASSWORD> -P <PORT> komazi_staging
```

---

## 7. AUTOMATED TESTING & QUALITY GATE

Sebelum membuka Pull Request atau melakukan rilis, pastikan Quality Gate lokal lulus:

```bash
# 1. Backend Quality Gate (Unit Tests)
cd backend
npm run test:unit
# Target: 22 tests lulus (0 fail)

# 2. Frontend Quality Gate (Linter, Unit Tests & Build)
cd frontend
npx oxlint src/
npm test
npm run build
# Target: Oxlint 0 errors, tests 5/5 lulus, Vite build sukses
```

Automated pipeline GitHub Actions (`.github/workflows/ci.yml`) akan secara otomatis memverifikasi seluruh pemeriksaan di atas setiap kali ada PR yang dibuat ke branch `main` atau `staging`.

---

## 8. DEPLOYMENT CHECKLIST

### Pre-Deployment (Sebelum Rilis)
- [ ] Kode telah diuji secara lokal (Frontend build sukses, backend tests 22/22 pass).
- [ ] Pull Request telah dibuat dan semua automated checks di GitHub Actions berwarna hijau.
- [ ] Tidak ada berkas kredensial (`.env`, `.env-prod`) yang masuk ke Git diff (`git status`).
- [ ] Backup snapshot MySQL production telah dibuat dan diverifikasi integritasnya.
- [ ] Jika ada perubahan database, skrip migrasi telah berhasil diuji di database staging.
- [ ] Seluruh environment variables baru telah dikonfigurasi di Vercel dan Railway dashboard.

### Deployment Execution (Saat Rilis)
- [ ] Merge PR ke branch `main` di GitHub.
- [ ] Pantau build log di **Railway** (pastikan container start berhasil, port 4000 aktif, dan database connect).
- [ ] Pantau build log di **Vercel** (pastikan output build sukses dan cache SPA route terupdate).
- [ ] Jika ada migrasi skema: jalankan `npx prisma migrate deploy` via Railway CLI atau dashboard release command.

### Post-Deployment Verification (Pasca-Rilis)
- [ ] Buka browser dan akses `https://komazi-pos.vercel.app`.
- [ ] Lakukan verifikasi Smoke Test (login kasir, buka POS, periksa antrean KDS, cek notifikasi realtime).
- [ ] Periksa log backend di Railway untuk memastikan tidak ada unhandled exception atau error 500.

---

## 9. PROSEDUR ROLLBACK CEPAT

Jika terjadi kendala fatal setelah rilis ke production, lakukan langkah mitigasi berikut secara sistematis:

### 1. Rollback Frontend (Vercel) — Waktu Eksekusi: < 30 Detik
1. Masuk ke **Vercel Dashboard** > Pilih project `komazi-pos`.
2. Klik tab **Deployments**.
3. Temukan deployment stabil terakhir yang bertanda *Production*.
4. Klik tombol **Instant Rollback** pada deployment tersebut.
5. Vercel akan langsung mengalihkan 100% traffic ke bundle frontend sebelumnya tanpa rebuild.

### 2. Rollback Backend (Railway) — Waktu Eksekusi: ~1-2 Menit
1. Masuk ke **Railway Dashboard** > Pilih service `komazi-pos-backend`.
2. Buka tab **Deployments**.
3. Cari commit terakhir yang stabil sebelum release bermasalah.
4. Klik menu opsi (tiga titik) > pilih **Redeploy** atau **Rollback to this deployment**.
5. Railway akan memutar kembali container ke image commit sebelumnya.

### 3. Rollback Database (Jika Skema Bermasalah)
* **Kasus A (Pola Expand-Contract):** Karena kolom lama belum dihapus, rollback kode backend (Langkah 2) sudah cukup memulihkan stabilitas aplikasi tanpa perlu menyentuh database.
* **Kasus B (Data Corrupted Fatal):**
  1. Hentikan container backend sementara untuk mencegah transaksi baru masuk.
  2. Pulihkan snapshot backup terbaru yang telah diverifikasi ke database live.
  3. Nyalakan kembali container backend.

---

## 10. PROSEDUR PENANGANAN INSIDEN (INCIDENT RUNBOOK)

### Skenario 1: Backend Railway Mengalami Crash / Restart Berulang (OOM)
* **Penyebab Utama:** Puppeteer Chromium kehabisan RAM saat pencetakan struk PDF massal.
* **Tindakan:**
  1. Periksa Railway CPU & RAM Metrics di dashboard.
  2. Tambahkan variable `DISABLE_PUPPETEER=true` di Railway variables untuk mengalihkan pencetakan ke format ESC/POS Bluetooth raw tanpa rendering Chromium.
  3. Restart container backend.

### Skenario 2: WebSockets KDS / Kasir Tidak Tersambung (Disconnected)
* **Penyebab Utama:** Mismatch URL WebSocket atau header CORS memblokir domain frontend.
* **Tindakan:**
  1. Buka console browser (`F12`), periksa apakah ada error `WebSocket connection to 'wss://...' failed`.
  2. Pastikan variable `VITE_SOCKET_URL` di Vercel mengarah ke domain Railway backend yang benar (tanpa akhiran `/api`).
  3. Pastikan `FRONTEND_URL` di Railway memuat domain Vercel yang sedang aktif.

### Skenario 3: Login Gagal dengan Pesan "Akses Ditolak / Server Error"
* **Penyebab Utama:** Variable `JWT_SECRET` di production hilang atau tidak aman sehingga server menolak start (*fail-closed* di [backend/src/utils/security.js](file:///d:/pos-komazi/backend/src/utils/security.js#L41-L52)).
* **Tindakan:**
  1. Cek logs Railway: jika muncul pesan `[SECURITY CRITICAL] Server berjalan di mode production tanpa JWT_SECRET...`, perbarui `JWT_SECRET` di Railway variables dengan string acak yang kuat.
  2. Lakukan redeploy.

---

## 11. VERIFIKASI PASCA-RILIS (SMOKE TEST CHECKLIST)

Jalankan pengujian cepat berikut segera setelah rilis production berhasil:

| No | Modul / Fitur | Langkah Pengujian | Hasil yang Diharapkan |
| :---: | :--- | :--- | :--- |
| 1 | **Autentikasi** | Login sebagai kasir dan owner di browser incognito. | Token JWT tersimpan, diarahkan ke layar sesuai role. |
| 2 | **Katalog Menu POS** | Buka halaman `/pos`, pilih produk varian dan custom note. | Item masuk keranjang dengan kalkulasi harga tepat. |
| 3 | **Transaksi Checkout** | Selesaikan pesanan dummy (Tunai / QRIS). | Invoice terbit, stok berkurang, modal struk muncul. |
| 4 | **Sinkronisasi KDS** | Buka halaman `/kds` di tab kedua saat pesanan baru dibuat. | Tiket pesanan baru langsung muncul secara realtime via WebSocket. |
| 5 | **Tombol BUMP KDS** | Klik tombol "Proses" atau "Siap Saji" pada tiket pesanan. | Status tiket berubah dan tersinkronisasi ke stasiun lain. |
| 6 | **Ekspor Excel** | Buka Laporan Transaksi dan klik "Ekspor ke Excel". | File `.xlsx` terunduh dengan header resmi Komazi & formula valid. |
| 7 | **Absensi Staf & Guard** | Buka modul HRIS & Absensi staf. | Deteksi radius geofence GPS dan validasi selfie berfungsi normal. |

---
*Dokumen ini wajib dijadikan acuan utama bagi seluruh tim pengembang sebelum melakukan modifikasi atau deployment pada sistem Komazi POS.*