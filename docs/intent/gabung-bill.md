# Intent: Fitur Gabung Bill (Merge Bill)

## Ringkasan Niat Terkonfirmasi

- **Outcome:** Fitur "Gabung Bill" (*Merge Bill*) langsung di keranjang kasir (`CartSidebar.jsx`) untuk menggabungkan satu atau lebih tagihan tertahan (*open bills*) ke dalam pesanan keranjang aktif.
- **User:** Kasir POS yang melayani rombongan/pelanggan yang menggabungkan meja dan ingin membayar seluruh pesanan dalam satu pembayaran.
- **Why now:** Saat ini sudah ada fitur *Split Bill* (pisah tagihan), namun belum ada cara cepat untuk menyatukan beberapa tagihan tertahan tanpa kasir harus menghapus dan menginput ulang pesanan secara manual.
- **Success:** Kasir membuka pesanan di keranjang, menekan tombol **"Gabung Bill"**, memilih (multi-select) tagihan tertahan lain yang ingin dilebur via modal baru (`MergeBillModal`), seluruh item dari tagihan tersebut langsung ditarik ke keranjang (item identik otomatis digabung jumlah qty-nya), nomor meja diperbarui (misal *"Meja 1, 2"*), dan tagihan asal otomatis terhapus dari daftar *open bills* & backend agar tidak tertagih ganda.
- **Constraint:** Hanya tagihan tertahan aktif (*open bills*) yang bisa dipilih; tagihan yang sedang terbuka di keranjang saat ini tidak ditampilkan di daftar pilihan (mencegah duplikasi).
- **Out of scope:** Menggabungkan pesanan yang statusnya sudah lunas (*PAID*), serta pemilihan parsial item per tagihan (semua item dari bill yang dipilih ditarik utuh).
