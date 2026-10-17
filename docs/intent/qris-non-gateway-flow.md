# Intent: Optimalisasi Alur Kasir QRIS Dinamis Non-Gateway

## 1. Latar Belakang & Masalah
Toko menggunakan QRIS Statis Merchant Bank yang diubah secara *on-the-fly* menjadi QRIS Dinamis (nominal belanja terkunci pas) tanpa berlangganan payment gateway aggregator (seperti Midtrans/Xendit) untuk menghindari potongan fee MDR tambahan.
Namun sebelumnya:
- Modal pembayaran menampilkan pesan *"Mendeteksi transfer masuk otomatis (Webhook aktif)..."* yang membingungkan kasir karena bank penerbit QRIS tidak mengirim webhook ke server lokal/web toko.
- Kasir tidak memiliki panduan SOP visual dan tidak memiliki tempat memasukkan nomor referensi RRN dari bukti bayar pelanggan.

## 2. Solusi & Implementasi
Pada [`PaymentModal.jsx`](file:///d:/pos-komazi/frontend/src/components/pos/PaymentModal.jsx):
1. **Ringkasan Nominal & Merchant yang Jelas**: Menampilkan total tagihan (terkunci pas) dan nama merchant bank pemilik QRIS.
2. **Kartu SOP Verifikasi Kasir**:
   - Arahkan pelanggan scan QRIS m-banking/e-wallet.
   - Periksa bukti bayar centang hijau di HP pelanggan / dengar speaker QRIS Soundbox bank.
   - Klik **"Konfirmasi QRIS Lunas"**.
3. **Input Opsional Nomor Referensi (RRN)**: Kasir dapat mencatat 4 digit terakhir nomor referensi bukti transaksi untuk kemudahan rekonsiliasi shift kasir.
4. **Tombol Konfirmasi Jelas**: Mengubah label tombol menjadi **"Konfirmasi QRIS Lunas"** agar kasir tidak ragu menyelesaikan transaksi secara langsung.
5. **Standby Mode**: Indikator auto-detect tetap standby jika toko menghubungkan notifikasi webhook mutasi bank di kemudian hari.
