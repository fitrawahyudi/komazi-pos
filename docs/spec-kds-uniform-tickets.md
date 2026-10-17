# Spesifikasi Teknis: Kartu Tiket KDS Seragam & Role Guard BUMP

## 1. Objective
1. Memberikan ukuran tinggi yang seragam dan konsisten (~420px) pada seluruh kartu tiket pesanan di KDS (`OrderTicket.jsx`) agar tata letak grid antrean KDS rapi dan tidak melar saat ada pesanan dengan banyak item.
2. Area daftar item di dalam kartu dapat di-scroll vertikal (`overflow-y-auto`) dengan scrollbar yang rapi, sementara header tiket dan tombol BUMP selalu terkunci di posisinya (*sticky top & bottom*).
3. Seluruh baris item dapat di-tap langsung untuk mengubah status BUMP (ramah layar sentuh) tanpa memicu spam pesan *toast*.
4. Menerapkan proteksi peran (*role guard*): Hanya staf dengan role `KITCHEN` atau `BARISTA` yang diizinkan melakukan BUMP (baik item maupun tiket). Role lain (Manager, Owner) berada dalam *Mode Pantau* (*read-only*).

## 2. Tech Stack & Komponen
- **Frontend Framework:** React 18
- **Komponen Target:**
  - `frontend/src/components/kds/OrderTicket.jsx`
  - `frontend/src/pages/KdsPage.jsx`
  - `frontend/src/pages/KdsStandaloneScreen.jsx`
- **Design Tokens:** Tailwind CSS (`komazi-surface`, `komazi-border`, `komazi-coral`, dll)

## 3. Detail Implementasi

### 3.1 Struktur Layout `OrderTicket.jsx`
- **Root Card:** `h-[420px] max-h-[420px] flex flex-col justify-between overflow-hidden ...`
- **Header:** `shrink-0 p-3.5 border-b`
- **Scrollable Body:** `flex-1 overflow-y-auto overscroll-contain p-3 space-y-2`
- **Footer:** `shrink-0 p-3 border-t`

### 3.2 Interaksi BUMP Item & Spam Toast
- Mengubah setiap baris item menjadi elemen interaktif (button) yang dapat di-tap seluruh barisnya jika `canBump` aktif dan item belum selesai (`!isItemDone`).
- Di `KdsPage.jsx`: Menghapus panggilan `toast.success` pada `handleBumpItem` agar layar tidak tertimbun tumpukan toast saat kasir/dapur memproses banyak item berturut-turut.

### 3.3 Proteksi Role Guard
- `canBump = isKitchen || isBarista`
- Di `KdsPage.jsx`:
  - Validasi guard di `handleBumpItem` dan `handleBumpTicket`.
  - Teruskan prop `canBump={canBump}` ke `StationPanel` dan `OrderTicket`.
- Di `OrderTicket.jsx`:
  - Jika `!canBump`:
    - Baris item tidak dapat di-klik untuk BUMP.
    - Footer tombol BUMP tiket digantikan dengan banner informatif *"Mode Pantau (Hanya Staf Dapur/Bar yang dapat BUMP)"*.

### 3.4 Tampilan Waktu Pesanan & Penghapusan Detik Berjalan
- Mengganti stopwatch menit:detik (`elapsedSeconds`) dengan **jam masuk pesanan** (`HH:mm`, contoh: `14:30`) yang statis dan tenang menggunakan `formatTime(order.createdAt)`.
- Mengurangi interval re-render jam di `KdsPage.jsx` dari 1 detik (`1000ms`) menjadi 15 detik (`15000ms`) untuk menghemat baterai layar tablet dan performa rendering dapur.
- Logika deteksi keterlambatan (*DELAYED / WARNING*) tetap dihitung secara akurat dalam menit terhadap `Date.now()` server timestamp, sehingga kartu tetap otomatis berubah warna menjadi merah/berkedip saat melebihi batas waktu (5m untuk Bar, 10m untuk Dapur).

## 4. Boundaries
- **Always:** Pastikan `canBump` memiliki default yang aman (false jika role bukan kitchen/bar).
- **Never:** Menghilangkan data pesanan atau mengubah format status Socket.IO.
