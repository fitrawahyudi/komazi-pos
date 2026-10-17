# Spesifikasi Teknis: Informasi Shift Operasional & Tombol Batal di EditProfileModal

## 1. Objective
Melengkapi `EditProfileModal.jsx` dengan:
1. Menampilkan ringkasan status shift kerja aktif kasir dari `shiftStore.js` (jam buka, kas awal, jumlah transaksi).
2. Menampilkan informasi akun (*Bergabung sejak* / `createdAt`).
3. Menambahkan tombol "Batal" (`onClose`) pada footer modal.

## 2. Tech Stack & Dependensi
- **React 18**
- **Zustand:** `useShiftStore`, `useAuthStore`
- **Utilities:** `formatRupiah`, `formatDateTime` dari `utils/format`
- **Lucide Icons:** `Clock`, `Calendar`, `DollarSign`, `CheckCircle`, `AlertCircle`
- **Tailwind CSS:** Tokens `komazi-surface`, `komazi-border`, `komazi-teal`, `komazi-coral`

## 3. Komponen & Detail UI
- **Posisi Kartu Shift:** Ditempatkan di bawah informasi Hak Akses / Role, sebelum bagian ubah password.
- **Kondisi Shift Aktif:**
  - Menampilkan badge "Shift Aktif".
  - Waktu mulai shift (`formatDateTime(activeShift.openedAt)`).
  - Modal kas awal (`formatRupiah(activeShift.openingCash)`).
- **Kondisi Tanpa Shift:**
  - Menampilkan status "Belum Ada Shift Aktif".
- **Informasi Akun:**
  - Tanggal pendaftaran staf (`formatDateTime(user.createdAt)`).
- **Footer Modal:**
  - Tombol "Batal" dengan tipe `button` dan handler `onClose`.
  - Tombol "Simpan Perubahan" (`LoadingButton`).

## 4. Boundaries
- **Always:** Disable tombol Batal dan Simpan saat form sedang submitting.
- **Never:** Mengubah atau mereset state shift dari modal profil ini.
