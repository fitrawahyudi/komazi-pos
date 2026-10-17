# Intent: Penguatan Hak Akses (RBAC) & Proteksi Data Sensitif (Fase 1)

## Ringkasan Niat Terkonfirmasi

- **Outcome:**
  1. **Isolasi Riwayat Shift per Kasir:** Kasir (`CASHIER`) hanya dapat melihat riwayat shift kasir miliknya sendiri saat mengakses riwayat shift. Hanya `OWNER` dan `MANAGER` yang dapat melihat riwayat shift seluruh staf dan memantau selisih kas toko.
  2. **Proteksi Konfigurasi Hardware & Printer:** Menambahkan otorisasi `requireRole(['OWNER', 'MANAGER'])` pada pembaruan profil printer (`updatePrinter`) di backend, serta membuka akses navigasi `Printer Kasir` di [Sidebar.jsx](file:///d:/pos-komazi/frontend/src/components/layout/Sidebar.jsx) dan [App.jsx](file:///d:/pos-komazi/frontend/src/App.jsx) untuk role `CASHIER` agar kasir dapat melakukan pairing printer Bluetooth/USB di meja kasir.
  3. **Penegakan Scoped Route Guards:** Memastikan halaman manajemen sensitif (`/menu`, `/stock`, `/reports`, `/settings`) terkunci secara absolut di sisi frontend dan backend, serta mencegah kebocoran data HPP dan margin keuntungan ke kasir frontliner.
- **User:**
  - Owner & Manager (pemilik kendali penuh atas data margin, HPP, resep, pengaturan, dan seluruh riwayat shift kasir).
  - Kasir (fokus transaksi kasir, pairing printer kasir, dan rekonsiliasi shift mandiri).
- **Why now:**
  - Menghindari kebocoran data sensitif (margin laba toko, selisih uang kas kasir lain, dan pengaturan hardware) ke frontliner, sekaligus memperbaiki bug navigasi printer kasir.
- **Success:**
  - Kasir tidak dapat melihat riwayat shift kasir lain via API maupun UI.
  - Kasir dapat mengakses menu Printer Kasir (`/printer`) untuk koneksi printer Bluetooth/USB.
  - Endpoint pembaruan printer (`updatePrinter`) diproteksi role.
  - Backend dan frontend build 100% lulus tanpa error.
- **Out of scope:**
  - Pembuatan modul absensi digital (Fase 4).
  - Bulk import produk Excel/CSV (Fase 2).
