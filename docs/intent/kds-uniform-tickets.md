# Intent: Kartu Tiket Seragam, Role Guard BUMP & Waktu Pesanan Statis KDS

## Ringkasan Niat Terkonfirmasi

- **Outcome:** 
  1. Kartu tiket pesanan KDS (`OrderTicket.jsx`) memiliki **tinggi yang seragam & konsisten** (*uniform fixed height* ~420px), dengan area item yang bisa di-scroll vertikal di dalam kartu dan tombol BUMP selalu terkunci rapi di bagian bawah (*sticky footer*).
  2. Seluruh baris item dapat di-tap langsung untuk BUMP status (ramah layar sentuh, target min. 44px).
  3. Menghapus spam notifikasi *toast* saat BUMP item agar antrean dapur tidak tertutup pesan *pop-up*.
  4. **Proteksi Hak Akses BUMP (Role Guard):** Hanya pengguna dengan role **`KITCHEN`** dan **`BARISTA`** yang berwenang melakukan BUMP (baik item maupun tiket). Role lain (*Manager*, *Owner*, dll) berada dalam mode pantau (*Monitor Mode / Read-Only*) dengan tampilan tombol yang terkunci/berlabel informatif.
  5. **Penghapusan Detik Berjalan:** Mengganti timer stopwatch detik yang terus berjalan pada tiket dengan **jam masuk pesanan** (`HH:mm`, misal `14:30`) yang statis dan tenang, sementara peringatan keterlambatan (*DELAYED*) tetap aktif jika melebihi batas waktu.
- **User:** Staf dapur & barista sebagai pelaksana BUMP, serta manajer/owner sebagai pemantau antrean.
- **Why now:** Tiket melar ke bawah saat pesanan banyak (merusak grid KDS), tombol per item kecil memicu spam *toast*, ada risiko peran non-dapur/bar mengubah status pengerjaan pesanan secara tidak sengaja, dan timer detik yang terus bergulir membebani performa render serta mengganggu konsentrasi staf dapur.
- **Success:**
  1. Semua kartu di grid KDS memiliki tinggi seragam; pesanan banyak item dapat di-scroll di dalam kartu tanpa melar.
  2. Tap pada baris item langsung mengubah status pengerjaan secara instan tanpa spam toast.
  3. Pengguna selain `KITCHEN` atau `BARISTA` tidak dapat melakukan BUMP dan melihat penanda *"Mode Pantau"*.
  4. Header tiket menampilkan jam masuk pesanan (`HH:mm`) yang tenang tanpa angka detik yang terus berputar.
- **Constraint:** Tetap kompatibel dengan tampilan layar TV (`KdsStandaloneScreen.jsx`).
- **Out of scope:** Perubahan hak akses login dasar atau modifikasi order di kasir POS.
