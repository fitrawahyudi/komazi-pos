# Spesifikasi Teknis: Analitik Keuangan & Laporan Laba Rugi Mendalam (Fase 3)

## 1. Objective
1. Memperkaya respons endpoint `GET /api/reports/summary` dengan komputasi:
   - `todayCogs`: Total HPP bahan baku pesanan lunas hari ini.
   - `todayGrossProfit`: `todayRevenue - todayCogs`.
   - `profitMargin`: Persentase keuntungan kotor terhadap omzet (`(grossProfit / todayRevenue) * 100`).
   - `paymentBreakdown`: Rincian nominal terpisah untuk `CASH`, `QRIS`, `TRANSFER`, dan lainnya.
2. Memastikan seluruh perhitungan finansial tetap aman dari akses kasir melalui middleware `requireRole(['MANAGER', 'OWNER'])`.

## 2. Implementasi
- Di `reportController.js`:
  Query `todayOrders` menyertakan relasi `payments` dan `items` (`select: { lineCost: true }`).
  Iterasi menghitung nominal per metode pembayaran dan total HPP untuk kalkulasi laba kotor.
