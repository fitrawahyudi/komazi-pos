# Intent: Informasi Shift Operasional & Tombol Batal di EditProfileModal

## Ringkasan Niat Terkonfirmasi

- **Outcome:** Menambahkan kartu informasi operasional shift aktif & tanggal akun dibuat, serta melengkapi tombol "Batal" pada footer modal `EditProfileModal.jsx`.
- **User:** Staf kasir, barista, atau manajer yang membuka modal profil untuk melihat status akun dan informasi operasional mereka.
- **Why now:** Saat ini kasir tidak bisa melihat ringkasan shift yang sedang mereka pegang saat membuka profil, dan footer modal belum memiliki tombol "Batal" (*Cancel*) untuk membatalkan perubahan.
- **Success:** Di dalam modal profil tampil kartu informasi shift (status shift aktif/nonaktif, jam mulai shift, dan modal awal kas), tanggal akun terdaftar (*member since*), serta tombol "Batal" di samping tombol "Simpan Perubahan" yang menutup modal dengan aman.
- **Constraint:** Informasi shift bersifat *read-only* (hanya menampilkan data dari `useShiftStore` tanpa mengubah alur buka/tutup shift).
- **Out of scope:** Fitur tutup/buka shift baru (tetap berada di `ShiftModal.jsx`), dan migrasi database untuk field tambahan baru.
