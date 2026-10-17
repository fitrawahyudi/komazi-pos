# Alur Cetak Struk Tagihan (Pre-Bill / Check Bill) Dahulu Sebelum Konfirmasi Pembayaran

## Latar Belakang & Kebutuhan Kasir
Pada operasional kafe/resto (khususnya *dine-in* maupun *take-away*), sering kali pelanggan meminta struk tagihan (*check bill*) terlebih dahulu untuk:
1. Memeriksa kembali rincian pesanan (makanan, minuman, diskon, pajak PB1).
2. Memindai QRIS dinamis yang tercetak langsung di lembar struk tagihan.
3. Menyerahkan uang tunai atau melakukan transfer sebelum kasir menekan tombol final "Konfirmasi Pembayaran".

## Implementasi & Solusi di Komazi POS

### 1. Tombol "Cetak Struk Dahulu" di Modal Pembayaran (`PaymentModal.jsx`)
- Terletak di baris footer modal pembayaran: `[Batal]` | `[Cetak Struk Dahulu]` | `[Konfirmasi Pembayaran]`.
- **Tidak menutup modal pembayaran**: Kasir tetap berada di formulir pembayaran dengan metode terpilih (Cash/QRIS/Transfer/Debit) sehingga setelah pelanggan membayar, kasir hanya perlu menekan `[Konfirmasi Pembayaran]`.
- **Dukungan Printer Thermal Otomatis**:
  - Jika printer Bluetooth / USB kasir sudah terhubung (`printerStore.isConnected`), instruksi ESC/POS langsung dikirim ke printer thermal.
  - Jika printer belum terhubung atau kasir ingin mencetak via Web Browser / WhatsApp, modal pratinjau struk thermal (`ThermalReceiptModal`) akan terbuka secara mulus.
- **Tampilan Struk Tagihan Sementara**:
  - Memiliki tanda tegas: `*** TAGIHAN SEMENTARA (BILL) ***`.
  - Berstatus: `BELUM LUNAS`.
  - Dilengkapi rincian produk, subtotal, pajak/service, dan **QRIS Dinamis** (jika metode QRIS dipilih atau aktif).

### 2. Tombol "Cetak" (Bill) Langsung di Keranjang Kasir (`CartSidebar.jsx` & `PosPage.jsx`)
- Kasir di meja kasir maupun meja pelanggan dapat mencetak bill sementara langsung dari grid tombol tindakan pesanan:
  `[Hold / Simpan]` | `[Cetak]` | `[Split]` | `[Gabung]`.
- Memungkinkan pramusaji mengantar struk tagihan ke meja pelanggan sebelum pelanggan datang ke kasir.

### 3. File yang Dimodifikasi:
- `frontend/src/components/pos/PaymentModal.jsx`: Tombol cetak struk dahulu, fungsi snapshot `handlePrintBill`, penanganan status cetak.
- `frontend/src/components/pos/CartSidebar.jsx`: Tombol "Cetak" di action toolbar keranjang pesanan.
- `frontend/src/pages/PosPage.jsx`: Handler `handlePrintCurrentBill` untuk mengalirkan cetak bill dari keranjang.
- `frontend/src/components/pos/ThermalReceiptModal.jsx`: Banner visual `*** TAGIHAN SEMENTARA (BILL) ***` & `Status: BELUM LUNAS`.
- `frontend/src/utils/escpos.js`: Perintah ESC/POS printer thermal untuk banner struk tagihan sementara.
