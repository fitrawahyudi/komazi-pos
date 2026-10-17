# Intent: Analitik Keuangan & Laporan Laba Rugi Mendalam (Fase 3)

## Ringkasan Niat Terkonfirmasi

- **Outcome:**
  1. **Perhitungan Laba Bersih & Margin Otomatis:** `getSummary` di [reportController.js](file:///d:/pos-komazi/backend/src/controllers/reportController.js) kini otomatis menghitung HPP (`todayCogs`), laba kotor riil (`todayGrossProfit`), dan persentase margin laba (`profitMargin`) berdasarkan item yang terjual.
  2. **Breakdown Pembayaran Multikanal:** Rincian penerimaan terpisah untuk Tunai (`CASH`), `QRIS`, `TRANSFER`, dan metode lainnya untuk audit harian.
  3. **Ekspor Excel & CSV:** Laporan transaksi dapat diekspor langsung ke spreadsheet Excel `.xlsx` maupun `.csv` dengan pemisah rapi untuk pembukuan.
- **User:**
  - Owner & Manager untuk evaluasi profitabilitas dan penutupan buku harian/bulanan.
- **Why now:**
  - Menghilangkan proses hitung manual Excel dan memberikan transparansi margin bisnis real-time.
- **Success:**
  - Owner dapat melihat margin keuntungan kotor dan breakdown metode pembayaran langsung dari ringkasan laporan.
