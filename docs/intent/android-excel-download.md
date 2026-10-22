# Intent: Android Excel Template Download & Export

## Ringkasan Masalah
Pada aplikasi Android Komazi POS yang di-build menggunakan Capacitor, seluruh aksi unduh template impor Excel (`downloadMenuTemplate`, `downloadIngredientTemplate`, dsb) dan ekspor laporan (`exportOrdersToExcel`, `exportZReportToExcel`) sebelumnya menggunakan fungsi bawaan `XLSX.writeFile()` dan pembuatan elemen link HTML `<a download="...">` dengan blob URL.

Pada Capacitor WebView Android, event klik tautan blob/download diabaikan secara default (*silent drop*) karena tidak ada download listener native browser, sehingga tombol "Download Template" tampak tidak merespons sama sekali.

## Solusi yang Diimplementasikan
1. **Plugin Native Filesystem**:
   - Menambahkan `@capacitor/filesystem` (versi 8.1.5) yang terintegrasi langsung dengan core Capacitor 8.
   - Mengonfigurasi permission `READ_EXTERNAL_STORAGE` dan `WRITE_EXTERNAL_STORAGE` (maxSdkVersion 29) serta `android:requestLegacyExternalStorage="true"` di `AndroidManifest.xml`.
2. **Helper Universal `fileSaver.js`**:
   - `saveWorkbook(wb, fileName, options)`: Jika berjalan di native Android (`Capacitor.isNativePlatform()`), workbook di-encode ke base64 lalu ditulis ke `Directory.Documents` (folder Dokumen publik Android) dan diindeks oleh MediaScanner. Memunculkan notifikasi toast konfirmasi sukses.
   - `saveBlobFile(blob, fileName)`: Mengonversi blob (seperti file CSV) menjadi base64 dan menyimpannya ke `Directory.Documents`.
   - Tetap mempertahankan fallback download berbasis browser standar jika aplikasi dijalankan via web browser (desktop/laptop).
3. **Penyelarasan Seluruh Titik Ekspor**:
   - Mengalihkan semua pemanggilan `XLSX.writeFile` pada 9 fungsi download template Excel, ekspor riwayat pesanan, dan ekspor Z-Report ke helper `saveWorkbook()`.
   - Mengalihkan ekspor CSV di `excel.js`, `exportReport.js`, dan `ShiftHistoryPage.jsx` ke helper `saveBlobFile()`.
4. **Verifikasi & Build**:
   - Sinkronisasi aset web dan plugin ke direktori Android via `npx cap sync android`.
   - Menambahkan automated unit test (Test #13) di `frontend.test.js` untuk memastikan keandalan penyimpanan workbook dan blob di berbagai platform.
