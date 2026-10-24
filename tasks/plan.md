# Rencana Implementasi: Komazi AI Upgrade (Isolasi Role, Database Luas, Cron Job)

## Latar Belakang & Tujuan
Berdasarkan Statement of Intent terkonfirmasi:
1. **Isolasi Riwayat Chat per-Role**: Riwayat chat Owner tidak boleh bocor ke Kasir (dan sebaliknya).
2. **Kecerdasan Database Menyeluruh**: AI dapat menjawab seluruh data operasional & finansial kedai (omzet komparatif, pengeluaran, resep/bahan, pelanggan, shift, aset) dengan pembatasan hak akses role dan sensor data sensitif (password, PIN, token).
3. **Pembuatan & Manajemen Cron Job via AI**: Pengguna (Owner/Manager) dapat membuat dan menjadwalkan tugas otomatis (cron job) dalam bahasa alami di antarmuka web Komazi AI.

---

## Daftar Tugas Terurut (Vertical Slices)

### Task 1: Isolasi Riwayat Chat Komazi AI per-Role (Frontend)
- **Files touched:** `frontend/src/store/aiAnalyticsStore.js`, `frontend/src/components/analytics/AiSalesAssistantModal.jsx`
- **Tindakan:**
  - Ubah struktur penyimpanan pesan dari array tunggal `messages` menjadi `messagesByRole: { OWNER: [...], MANAGER: [...], CASHIER: [...], BARISTA: [...], KITCHEN: [...] }`.
  - Sinkronisasi `messages` aktif sesuai `role` user yang sedang login saat modal dibuka atau saat berganti user.
  - Pisahkan `clearChat` agar hanya menghapus riwayat role yang sedang aktif.
  - Partialize localStorage dengan key yang aman atau mapping per-role.
- **Verifikasi:**
  - Buka AI sebagai Owner, kirim pesan -> pesan tersimpan di role Owner.
  - Ganti ke Kasir -> pesan Owner tidak muncul, menampilkan pesan sambutan & riwayat Kasir.

### Task 2: Ekstensi Konteks Database Komazi AI & Sensor Data Sensitif (Backend)
- **Files touched:** `backend/src/services/ai/komaziAiContextAggregator.js`, `backend/src/services/salesAnalyticsEngine.js`, `backend/src/services/ai/aiPromptComposer.js`
- **Tindakan:**
  - Perluas agregator konteks operasional untuk mencakup:
    - Pengeluaran (Expense): total bulanan, kategori pengeluaran terbesar.
    - Pelanggan (Customer): total member, tier member, poin.
    - Aset & Inventaris: ringkasan nilai aset & penyusutan, stok bahan kritis & resep.
    - HRIS & Shift: kehadiran staf, ringkasan selisih kas terbaru.
    - Penjualan historis: perbandingan bulan ini vs bulan lalu, metode pembayaran.
  - Terapkan sensor data sensitif: string/objek yang mengandung `password`, `pin`, `token`, `secret`, `hash` wajib difilter/dihapus total.
  - Terapkan pembatasan role:
    - OWNER & MANAGER: Akses penuh (laba bersih, omzet lengkap, HPP, pengeluaran, gaji).
    - CASHIER, BARISTA, KITCHEN: Dibatasi pada SOP, menu resep, stok bahan, meja/workspace, dan shift terkait tanpa akses data laba/HPP/gaji.
- **Verifikasi:**
  - Test query AI seputar expense, customer, dan aset.
  - Pastikan tidak ada data password/PIN yang bocor dalam prompt AI.

### Task 3: Integrasi Eksekusi Cron Job via Chatbot AI (Backend)
- **Files touched:** `backend/src/controllers/aiAnalyticsController.js`, `backend/src/services/ai/aiPromptComposer.js`, `backend/src/services/ai/naturalScheduleParser.js` (atau parser cron)
- **Tindakan:**
  - Tambahkan deteksi intent penjadwalan cron (`CREATE_SCHEDULE`, `LIST_SCHEDULE`, `CANCEL_SCHEDULE`) di `aiPromptComposer.js` / controller.
  - Hubungkan dengan `jobRegistryService.createJob` dan `UniversalSchedulerAgent`.
  - Dukung sintaks bahasa alami seperti:
    - *"Jadwalkan rekap omzet setiap jam 22:00"* -> Cron: `0 22 * * *`, JobType: `REPORT`
    - *"Ingatkan cek stok bahan setiap hari jam 15:00"* -> Cron: `0 15 * * *`, JobType: `REMINDER`
    - *"Tampilkan daftar cron job aktif"* -> Query `ScheduledJob` aktif
  - Berikan pengamanan otorisasi: hanya role `OWNER` dan `MANAGER` yang diizinkan membuat/mengelola cron job. Role Kasir akan menerima pesan penolakan sopan bahwa pembuatan jadwal membutuhkan izin Owner/Manager.
- **Verifikasi:**
  - Kirim pertanyaan penjadwalan via endpoint `/ai/ask` -> Cron job tersimpan di database `ScheduledJob`.

### Task 4: Pengujian E2E & Verifikasi Frontend
- **Files touched:** `frontend/tests/frontend.test.js`, `backend/tests/test-ai-cron-and-role-isolation.js`
- **Tindakan:**
  - Buat unit & integrasi test untuk isolasi chat per-role di frontend.
  - Buat automated test di backend untuk memverifikasi cron job creation via AI dan sensor data sensitif.
  - Jalankan build frontend dan pastikan semua lulus.
