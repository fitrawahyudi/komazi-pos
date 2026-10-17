# Intent: Program Loyalitas & CRM Pelanggan (Customer Relationship Management)

## 1. Latar Belakang & Masalah
Dalam operasional cafe dan restoran modern (seperti fitur CRM pada Lapak POS), retensi pelanggan dan apresiasi pelanggan setia adalah kunci peningkatan omzet jangka panjang. Sebelumnya:
- Pelanggan belum memiliki insentif terintegrasi untuk kembali berkunjung.
- Poin loyalitas belum terhubung secara mulus dengan proses pembayaran kasir (POS).
- Kasir kesulitan menukarkan poin reward secara instan langsung di keranjang pembayaran.
- Data member belum dapat diekspor secara komprehensif ke Excel untuk keperluan pemasaran/broadcast promo.

## 2. Tujuan & Sasaran
1. **Otomatisasi Akumulasi Poin**: Setiap transaksi lunas (`PAID`) yang terhubung dengan pelanggan terdaftar akan otomatis menambahkan poin reward (1 poin per Rp 10.000 belanja), menambah `totalSpent`, dan `visitCount`.
2. **Kenaikan Tier Dinamis**: Pelanggan otomatis naik level tier (`SILVER` -> `GOLD` pada ≥ 200 poin -> `PLATINUM` pada ≥ 500 poin).
3. **Penukaran Poin Langsung di Kasir (POS Direct Redemption)**: Kasir dapat memilih pelanggan terdaftar dan menukarkan poin mereka secara langsung di popover diskon (nilai konversi: 1 poin = Rp 1.000 diskon tagihan).
4. **Proteksi & Audit Transaksi Poin**: Poin yang ditukarkan otomatis memicu pencatatan audit log dan mutasi pengurangan poin di database saat transaksi pembayaran selesai.
5. **Ekspor Database Member ke Excel**: Menyediakan tombol satu-klik di halaman CRM untuk mengunduh seluruh data member (nama, kontak WhatsApp, tier, saldo poin, riwayat belanja, dan tanggal bergabung).

## 3. Batasan & Lingkup Kerja
- **Tingkat Konversi**: 
  - Earn rate: Rp 10.000 belanja = 1 poin loyalty.
  - Redeem rate: 1 poin loyalty = Rp 1.000 potongan diskon belanja.
- **Maksimum Potongan**: Potongan dari poin loyalty tidak boleh melebihi subtotal belanja keranjang.
- **Konsistensi Inventory & Financial**: Penukaran poin dicatat sebagai diskon nominal pesanan sehingga tidak mengganggu kalkulasi HPP (COGS) maupun stok inventaris.
