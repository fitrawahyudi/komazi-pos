# Statement of Intent: Fitur QR Order Meja (Uji Coba Pembayaran Langsung)

**Tanggal:** 7 November 2026  
**Status:** Confirmed by User  
**Tujuan:** Menyediakan sistem pemesanan mandiri meja (*Customer QR Self-Order*) berbasis browser HP tanpa aplikasi tambahan, dengan metode pembayaran non-tunai langsung (Transfer Bank / QRIS Statis) yang diverifikasi manual oleh kasir di Web POS.

---

## 1. Outcome
Sistem pemesanan mandiri dari meja kafe di mana pelanggan memindai kode QR meja, memilih menu yang terbukti *ready*, melakukan pembayaran langsung via Transfer Bank atau QRIS Statis kedai, lalu mengunggah foto bukti bayar. Staf kasir kemudian memeriksa bukti transfer di Web POS untuk menyetujui pesanan sebelum diteruskan ke dapur/barista.

## 2. User & Stakeholders
* **Pelanggan Kedai:** Dapat memesan makanan/minuman langsung dari meja tanpa harus antre berdiri di kasir.
* **Kasir:** Tidak terbebani antrean input pesanan satu per satu, hanya perlu memverifikasi foto bukti transfer pelanggan.
* **Barista & Kitchen:** Menerima tiket pesanan yang sudah pasti lunas dan terkonfirmasi secara real-time di layar KDS.

## 3. Why Now
Mencegah penumpukan antrean tamu saat jam ramai/akhir pekan, sekaligus ingin diuji coba (*trial*) secara aman tanpa biaya sewa gateway pembayaran atau risiko komplain pesanan fiktif/salah transfer.

## 4. Success Criteria
1. **Proteksi Menu Habis (3 Lapis):**
   * Menu *sold out* otomatis berstatus non-aktif di katalog HP pelanggan.
   * Saat klik "Lanjut Bayar", sistem memvalidasi stok ulang secara *real-time*. Rekening/QRIS hanya muncul jika semua item 100% *ready*.
   * Staf kasir memiliki opsi tolak/ganti menu jika ada kendala fisik mendadak di dapur.
2. **Alur Pelanggan:** Tamu scan QR -> masukkan nama -> pilih menu -> transfer & upload bukti bayar di HP.
3. **Alur Kasir:** Notifikasi pesanan meja masuk di Web POS kasir -> kasir meninjau foto bukti transfer -> klik `[Konfirmasi Lunas]` -> pesanan menjadi `PAID`, stok bahan dipotong, dan tiket langsung dikirim ke KDS.

## 5. Constraints & Guardrails
* **Feature Flag Toggle:** Wajib ada tombol on/off di Pengaturan Web POS berstatus default **OFF (Non-Aktif)** selama masa percobaan. Jika toggle OFF, halaman QR meja menampilkan pesan ramah bahwa pemesanan di meja sedang ditutup dan tamu dipersilakan ke kasir.
* **Pencegahan Uang Masuk untuk Menu Kosong:** Nomor rekening/QRIS tujuan transfer baru dimunculkan ke layar tamu setelah validasi ketersediaan menu lolos.

## 6. Out of Scope
* Integrasi otomatis API Payment Gateway pihak ketiga (Midtrans/Xendit).
* Pembayaran tunai dari meja.
* Fitur *open bill* / bayar belakangan dari meja.
* Kewajiban login/daftar akun bagi pelanggan.

