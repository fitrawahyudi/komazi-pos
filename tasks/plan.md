# Implementation Plan: Preview Kertas Thermal & Toggle Cetak Otomatis Pesanan KDS

## Overview
Menambahkan fitur **Preview Kertas Thermal** (simulasi visual struk/tiket 58mm & 80mm) pada modal pengaturan printer KDS, serta **Toggle Cetak Otomatis (Auto-Print)** saat ada pesanan baru masuk dari kasir/POS secara realtime via WebSocket.

---

## Architecture Decisions

1. **Preview Kertas Thermal di `KdsPrinterModal.jsx`**:
   - Menambahkan Tab ke-3: **Pratinjau Kertas (Paper Preview)** dengan tampilan visual kertas struk kasir realistis (background putih, font-mono, dashed dividers, efek robekan kertas bergerigi).
   - Mendukung switch antara:
     - **Tiket Dapur / Bar (Kitchen Ticket)**: Fokus nama meja, kuantitas item tebal, varian, dan catatan menu khusus.
     - **Struk Pembayaran (Customer Receipt)**: Detail harga, pajak, total, dan pesan footer.
   - Pilihan lebar kertas real-time: **58mm** (300px) vs **80mm** (380px).
   - Tombol **"Cetak Contoh Preview"** untuk langsung menguji cetak tampilan ke printer Bluetooth yang tersambung.

2. **Toggle Cetak Otomatis Pesanan Baru (Auto-Print on New Order)**:
   - Ditempatkan di Tab **Format & Fitur** pada `KdsPrinterModal.jsx`.
   - Terhubung dengan `autoPrintKitchenOnCheckout` di `printerStore` (tersimpan permanen di localStorage).
   - Memberikan indikator status: jika toggle aktif namun printer Bluetooth belum terhubung, sistem menampilkan peringatan ramah.

3. **Eksekusi Auto-Print di `KdsStandaloneScreen.jsx` & `KdsPage.jsx`**:
   - Pada handler realtime `onOrderNew(newOrder)` di `useKdsSocket`:
     - Memeriksa apakah pesanan relevan dengan station aktif.
     - Jika `autoPrintKitchenOnCheckout` aktif dan `isConnected` true:
       Memanggil `printKitchenTicketForOrder(newOrder, { stationName, items })` secara otomatis, disertai notifikasi toast keberhasilan.

---

## Task List

### Phase 1: KDS Printer Modal Upgrade
- [x] Task 1: Add Paper Preview Tab & Auto-Print Toggle in `KdsPrinterModal.jsx`

### Phase 2: Realtime Auto-Print Trigger
- [x] Task 2: Wire Auto-Print on `onOrderNew` in `KdsStandaloneScreen.jsx` and `KdsPage.jsx`

### Phase 3: Verification & Build Check
- [x] Task 3: Unit Tests & Production Build Verification

