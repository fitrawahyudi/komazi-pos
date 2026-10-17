# Intent: Komazi AI Proactive & Predictive Intelligence Engine

## Status: COMPLETED & VERIFIED (100%)
**Tanggal Konfirmasi:** 2026-10-11  
**Tanggal Penyelesaian:** 2026-10-11  
**Stakeholder:** Owner & Store Manager Komazi Coffee & Workspace  

---

## 1. Executive Summary
Mengembangkan fitur Komazi AI dari asisten teks pasif menjadi **Autonomous Proactive & Predictive Intelligence Engine** di Telegram. Sistem ini secara mandiri menghitung laju pemakaian bahan baku (burn-rate), memprediksi jam sibuk (peak hour), memproyeksikan target omset harian, dan mengirimkan kartu visual infografis HD ke Telegram Owner & Manager tanpa harus ditanya secara manual.

---

## 2. Definisi Kebutuhan (Statement of Intent)

- **Outcome:** Komazi AI bertransformasi menjadi *Autonomous Proactive & Predictive Intelligence Engine* di Telegram yang mengirimkan laporan kartu visual grafis HD (infografis), memadukan briefing rutin harian dan peringatan darurat cerdas.
- **User:** Owner dan Store Manager Komazi Coffee & Workspace.
- **Why now:** Komazi AI saat ini masih pasif (hanya menjawab jika ditanya di web POS), fitur `/prediksi` masih statis/hardcoded, dan belum ada peringatan dini otomatis sehingga operasional berisiko kehabisan bahan baku krusial di tengah jam ramai.
- **Success:** Bot Telegram otomatis mengirimkan kartu visual HD:
  1. **Morning Briefing (08:00 WIB):** Prediksi jam sibuk (*peak hour*), estimasi lonjakan pesanan, dan target omset hari ini.
  2. **Smart Emergency Alert (Real-Time):** Peringatan hitung mundur habisnya bahan baku (*burn-rate countdown*) jika diprediksi habis sebelum jam tutup toko.
  3. **Closing Wrap-up (22:00 WIB):** Rekapitulasi performa omset nyata vs proyeksi AI sepanjang hari.
- **Constraint:** Setiap pesan proaktif **wajib menyertakan kartu visual HD** (memanfaatkan engine `generateBotImage` yang sudah ada di backend), dan kalkulasi prediksi murni menggunakan agregasi data historis transaksi database (bebas halusinasi).
- **Out of scope:** Voice POS (input pesanan suara di kasir), pemesanan otomatis ke supplier eksternal (*auto-purchase order*), dan perombakan modal chat di frontend POS.

---

## 3. Komponen Utama Arsitektur
1. **Engine Prediksi (`aiPredictiveEngine.js`):**
   - Perhitungan laju habis bahan baku per jam (*burn-rate per hour*).
   - Estimasi sisa waktu (*hours until stockout*) dan perkiraan jam ludes.
   - Analisis lonjakan jam ramai (*peak hour forecasting*) berbasis historis hari yang sama.
   - Estimasi target omset harian.
2. **Template Kartu Visual HD (`aiPredictiveTemplate.js`):**
   - `renderAiMorningBriefingCard`: Kartu proyeksi omset & jam sibuk.
   - `renderAiStockoutAlertCard`: Kartu bahaya hitung mundur stok habis.
   - `renderAiEveningWrapupCard`: Kartu evaluasi penutupan realisasi vs target.
3. **Autonomous Proactive Scheduler (`aiProactiveScheduler.js`):**
   - Cron rutin Morning (08:00 WIB) & Evening (22:00 WIB).
   - Periodic monitor (setiap 30 menit) dengan filter *anti-spam cooldown*.
   - Dispatcher gambar ke penerima Telegram Owner/Manager.
4. **Interactive Bot Control & REST API:**
   - Perintah Telegram `/prediksi`, `/briefing`, `/cek_stok_kritis`, dan `/evaluasi_ai` menghasilkan kartu visual secara on-demand.
   - REST API `GET /api/ai/forecast` & `POST /api/ai/proactive/trigger`.

---

## 4. Hasil Verifikasi End-to-End
- **Engine Math Verification:** Teruji akurat menghitung burn-rate bahan baku, kurva distribusi jam sibuk 4 minggu historis, dan komparasi penutupan via `test-ai-predictive-e2e.js`.
- **Puppeteer Rendering:** Ketiga tipe kartu visual (`ai_morning_briefing`, `ai_stockout_alert`, `ai_evening_wrapup`) teruji menghasilkan buffer gambar PNG HD (>370KB per kartu) tanpa crash browser pool.
- **Anti-Spam Cooldown:** Mekanisme anti-spam 3 jam terverifikasi mencegah pengiriman peringatan stok berulang ke Telegram.
- **REST & Webhook:** Endpoint REST terverifikasi dan otorisasi role OWNER/MANAGER berfungsi optimal.
