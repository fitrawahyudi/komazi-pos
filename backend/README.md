# KOMAZI POS — REST API Backend (Express.js + Prisma ORM + MySQL)

Backend REST API untuk **Komazi Coffee & Workspace POS**, dibangun sesuai arsitektur dan spesifikasi pada [`prd.md`](../prd.md).

---

## 🛠️ Tech Stack & Arsitektur

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MySQL 8 (database: `komazi_pos`)
- **ORM**: Prisma ORM
- **Keamanan**: Helmet, CORS, Express-Rate-Limit, BCryptJS
- **Autentikasi**: JSON Web Token (Access Token & Refresh Token)
- **Validasi**: Zod Schema Validator
- **Logging**: Morgan

---

## 📁 Struktur Folder

```
backend/
├── prisma/
│   ├── schema.prisma        # Skema Prisma Database MySQL
│   └── seed.js              # Seeder data pengguna, menu, workspace, bahan
├── src/
│   ├── config/              # db.js (Prisma Client)
│   ├── controllers/         # Logika endpoint (auth, product, order, shift, workspace, stock, report, setting)
│   ├── middlewares/         # auth (JWT), role (RBAC), validate (Zod), error handling
│   ├── routes/              # Modular Express router (/api/v1)
│   ├── validators/          # Zod schema validation
│   ├── utils/               # response helper, invoice numbering generator
│   ├── app.js               # Express application setup
│   └── server.js            # Server entrypoint
├── uploads/                 # Folder upload foto produk
├── test-api.js              # Script uji coba automated end-to-end
├── .env                     # Konfigurasi database & environment
└── package.json
```

---

## 📡 Daftar Endpoint REST API (`/api/v1`)

| Modul | Method & Path | Akses Role | Keterangan |
|---|---|---|---|
| **Auth** | `POST /api/v1/auth/login` | Publik | Login pengguna (username & password) |
| | `POST /api/v1/auth/refresh` | Publik | Memperbarui access token dengan refresh token |
| | `GET /api/v1/auth/me` | Semua | Mengambil profil user yang sedang login |
| **User** | `GET /api/v1/users` | Owner | Menampilkan seluruh staf kasir/manager |
| | `POST /api/v1/users` | Owner | Menambah akun staf baru |
| | `PATCH /api/v1/users/:id` | Owner | Mengubah role/status user |
| **Kategori** | `GET /api/v1/categories` | Semua | Daftar kategori menu |
| | `POST /api/v1/categories` | Manager+ | Tambah kategori baru |
| | `PATCH /api/v1/categories/:id` | Manager+ | Ubah nama kategori |
| | `DELETE /api/v1/categories/:id` | Manager+ | Hapus kategori |
| **Produk** | `GET /api/v1/products` | Semua | Daftar produk dengan filter & varian |
| | `GET /api/v1/products/:id` | Semua | Detail satu produk |
| | `POST /api/v1/products` | Manager+ | Tambah menu produk & varian |
| | `PATCH /api/v1/products/:id` | Manager+ | Ubah produk / tandai sold out |
| | `DELETE /api/v1/products/:id` | Manager+ | Hapus produk |
| **Pesanan** | `GET /api/v1/orders` | Kasir+ | Riwayat pesanan & filter status |
| | `POST /api/v1/orders` | Kasir+ | Buat pesanan kasir / simpan open bill |
| | `GET /api/v1/orders/:id` | Kasir+ | Detail invoice pesanan |
| | `POST /api/v1/orders/:id/pay` | Kasir+ | Bayar tagihan open bill |
| | `POST /api/v1/orders/:id/void` | Manager+ | Batalkan transaksi (wajib alasan & audit) |
| | `POST /api/v1/orders/:id/refund` | Manager+ | Refund transaksi (wajib alasan & audit) |
| **Shift** | `GET /api/v1/shifts/current` | Kasir+ | Status shift aktif kasir saat ini |
| | `POST /api/v1/shifts/open` | Kasir+ | Buka shift kasir (modal uang awal) |
| | `POST /api/v1/shifts/close` | Kasir+ | Tutup shift & hitung selisih kas |
| **Workspace** | `GET /api/v1/workspace/areas` | Semua | Denah & status meja workspace |
| | `POST /api/v1/workspace/areas` | Manager+ | Tambah area meja kerja baru |
| | `GET /api/v1/workspace/packages` | Semua | Daftar paket tarif durasi |
| | `POST /api/v1/workspace/packages` | Manager+ | Tambah paket tarif baru |
| | `GET /api/v1/workspace/sessions` | Kasir+ | Sesi pelanggan aktif |
| | `POST /api/v1/workspace/sessions` | Kasir+ | Check-in pelanggan (timer berjalan) |
| | `POST /api/v1/workspace/sessions/:id/checkout` | Kasir+ | Check-out & hitung overtime |
| **Stok** | `GET /api/v1/ingredients` | Manager+ | Daftar bahan baku & level stok |
| | `POST /api/v1/ingredients` | Manager+ | Tambah bahan baku baru |
| | `POST /api/v1/ingredients/:id/movements` | Manager+ | Catat mutasi: Masuk, Opname, Waste |
| **Laporan** | `GET /api/v1/reports/summary` | Manager+ | Ringkasan omzet, AOV, okupansi hari ini |
| | `GET /api/v1/reports/sales` | Manager+ | Tren penjualan per rentang hari |
| | `GET /api/v1/reports/products` | Manager+ | Peringkat produk paling laris |
| | `GET /api/v1/reports/export` | Manager+ | Unduh file laporan penjualan format CSV |
| **Pengaturan**| `GET /api/v1/settings` | Kasir+ | Profil usaha, tarif pajak & service fee |
| | `PUT /api/v1/settings` | Owner | Perbarui pengaturan usaha |

---

## 🚀 Cara Menjalankan Backend

1. **Pastikan MySQL berjalan** (misalnya melalui Laragon / XAMPP di port 3306).
2. **Masuk ke folder backend**:
   ```powershell
   cd d:\pos-komazi\backend
   ```
3. **Jalankan migrasi database & seeding**:
   ```powershell
   npm run db:setup
   ```
4. **Jalankan development server**:
   ```powershell
   npm run dev
   ```
   Server akan berjalan di: **`http://localhost:4000`**

5. **Menjalankan test otomatis**:
   ```powershell
   node test-api.js
   ```
