# Intent: Modal Pratinjau Pesanan pada Fitur Gabungkan Tagihan (Merge Bill)

## 1. Latar Belakang & Masalah
Pada fitur penggabungan tagihan (*Merge Bill*), kasir sebelumnya hanya melihat ringkasan satu baris item yang dipotong (`line-clamp-1`). Kasir kesulitan memastikan rincian lengkap pesanan (varian, catatan/modifiers, harga satuan, dan subtotal item) pada setiap tagihan yang hendak digabungkan. Hal ini berisiko menyebabkan salah pilih tagihan pelanggan yang berbeda.

## 2. Solusi & Implementasi
Menyediakan tombol **"Lihat Pesanan"** (dengan ikon `Eye`) pada setiap kartu tagihan di [`MergeBillModal.jsx`](file:///d:/pos-komazi/frontend/src/components/pos/MergeBillModal.jsx), yang membuka **Modal Pratinjau Pesanan Tertahan (Order Preview Modal)**:
- **Header**: Label tagihan, tipe pesanan (Dine-In / Take-Away), dan waktu simpan (*timestamp*).
- **Metadata**: Nomor meja dan nama pelanggan.
- **Rincian Item Lengkap**:
  - Nama produk & quantity
  - Badge varian (misal Ice / Hot)
  - Modifiers / Add-ons (misal Extra Shot)
  - Catatan khusus pelanggan (*notes*)
  - Harga satuan & subtotal per baris
- **Total Finansial**: Total nominal tagihan.
- **Aksi Cepat**: Kasir dapat langsung menekan tombol **"Pilih Tagihan Ini (+Gabung)"** atau **"Batal Pilih Tagihan Ini"** langsung dari dalam modal pratinjau tanpa perlu mencari kembali kartu di daftar utama.
