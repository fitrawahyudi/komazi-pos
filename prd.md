# PRD — Komazi POS (Coffee & Workspace)

| | |
|---|---|
| **Versi** | 1.0 (Draft) |
| **Tanggal** | 1 Oktober 2026 |
| **Produk** | Aplikasi Web Point of Sale (POS) Komazi |
| **Status** | Perencanaan |

---

## 1. Ringkasan Produk

Komazi adalah bisnis **Coffee & Workspace**: menjual makanan/minuman sekaligus menyediakan ruang kerja. Aplikasi **Komazi POS** adalah aplikasi web untuk mencatat transaksi penjualan, mengelola menu dan stok, mengelola penggunaan workspace (per jam/hari), serta menyajikan laporan penjualan bagi pemilik.

### 1.1 Masalah yang Diselesaikan
- Pencatatan transaksi manual rawan salah dan lambat saat jam ramai.
- Stok bahan (kopi, susu, dll.) sulit dipantau, sehingga sering kehabisan atau terbuang.
- Penggunaan workspace (durasi & tagihan) sulit dilacak bersamaan dengan pesanan F&B.
- Pemilik tidak punya laporan harian/bulanan yang cepat dan akurat.

### 1.2 Tujuan
1. Mempercepat proses transaksi kasir (target: < 30 detik per transaksi sederhana).
2. Menyediakan laporan penjualan real-time.
3. Memantau stok bahan dan memberi peringatan stok menipis.
4. Mengintegrasikan tagihan workspace dengan pesanan F&B dalam satu struk.

### 1.3 Metrik Keberhasilan
| Metrik | Target |
|---|---|
| Waktu rata-rata per transaksi | < 30 detik |
| Selisih stok sistem vs fisik | < 3% |
| Waktu muat halaman kasir | < 2 detik |
| Adopsi kasir (transaksi tercatat di sistem) | 100% setelah 2 minggu go-live |

---

## 2. Pengguna & Peran

| Peran | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Owner** | Pemilik bisnis | Semua fitur, laporan, pengaturan, manajemen user |
| **Manager** | Pengelola operasional | Menu, stok, laporan, void/refund, tutup shift |
| **Kasir** | Operator harian | Transaksi, buka/tutup shift, workspace check-in/out |
| **Barista** *(opsional, fase 2)* | Penyiap pesanan | Melihat antrean pesanan (kitchen display) |

---

## 3. Ruang Lingkup

### 3.1 MVP (Fase 1)
- Autentikasi & manajemen user/role
- Manajemen kategori & produk (menu) + varian/add-on
- Transaksi kasir (keranjang, diskon, pajak, pembayaran)
- Metode bayar: Tunai, QRIS (manual/statis), Transfer
- Cetak/preview struk (browser print)
- Manajemen shift kasir
- Manajemen stok bahan sederhana + peringatan stok minimum
- Modul workspace: paket per jam/hari, check-in/check-out, tagihan
- Dashboard & laporan penjualan dasar (harian/bulanan, export CSV)

### 3.2 Fase 2
- Resep/BOM (pengurangan stok bahan otomatis per menu)
- Kitchen/Barista display
- Membership & poin loyalti
- Integrasi payment gateway (QRIS dinamis, mis. Midtrans/Xendit)
- Reservasi workspace online
- Printer thermal (ESC/POS) & laci kas
- Mode offline (PWA)

### 3.3 Di Luar Lingkup (Saat Ini)
- Aplikasi mobile native
- Multi-cabang penuh (struktur data disiapkan, UI belum)
- Integrasi akuntansi eksternal

---

## 4. Kebutuhan Fungsional

### 4.1 Autentikasi & User
- **FR-01** Login dengan email/username + password.
- **FR-02** Sesi menggunakan JWT (access + refresh token).
- **FR-03** Role-based access control (Owner, Manager, Kasir).
- **FR-04** Owner dapat membuat, menonaktifkan, dan mereset password user.

### 4.2 Manajemen Menu
- **FR-10** CRUD kategori (mis. Kopi, Non-Kopi, Makanan, Snack).
- **FR-11** CRUD produk: nama, SKU, kategori, harga, foto, status aktif/nonaktif.
- **FR-12** Varian (ukuran: Regular/Large; suhu: Hot/Iced) dengan selisih harga.
- **FR-13** Add-on/modifier (extra shot, oat milk, topping).
- **FR-14** Tandai produk "habis" secara manual.

### 4.3 Transaksi Kasir (POS)
- **FR-20** Pilih produk via grid kategori + pencarian.
- **FR-21** Keranjang: ubah qty, catatan per item, hapus item.
- **FR-22** Tipe pesanan: Dine-in, Take-away; opsional nomor meja.
- **FR-23** Diskon: nominal/persen per item atau per transaksi (dengan batas sesuai role).
- **FR-24** Pajak (PPN) dan service charge yang dapat dikonfigurasi.
- **FR-25** Pembayaran tunggal atau split (tunai + non-tunai); hitung kembalian otomatis.
- **FR-26** Simpan pesanan sebagai *open bill* (belum dibayar) dan lanjutkan nanti.
- **FR-27** Struk: preview, cetak via browser, nomor invoice unik (mis. `KMZ-20261001-0001`).
- **FR-28** Void/refund memerlukan otorisasi Manager/Owner dan alasan wajib.

### 4.4 Workspace
- **FR-30** Master data area/meja kerja (mis. Meja Komunal 1–10, Private Room A).
- **FR-31** Paket tarif: per jam, per 3 jam, harian, dengan harga & batas waktu.
- **FR-32** Check-in pelanggan (nama/no. HP, area, paket) → timer berjalan.
- **FR-33** Check-out: hitung durasi & tarif otomatis, termasuk overtime.
- **FR-34** Tagihan workspace dapat digabung dengan pesanan F&B dalam satu invoice.
- **FR-35** Tampilan status area: Tersedia / Terisi / Segera berakhir.

### 4.5 Stok & Inventori
- **FR-40** CRUD bahan baku (kopi, susu, gula, cup, dll.) dengan satuan.
- **FR-41** Stok masuk (pembelian), penyesuaian (stock opname), pencatatan waste.
- **FR-42** Batas stok minimum + notifikasi di dashboard.
- **FR-43** *(Fase 2)* Resep per produk → stok bahan berkurang otomatis saat transaksi.

### 4.6 Shift Kasir
- **FR-50** Buka shift dengan modal awal kas.
- **FR-51** Tutup shift: hitung kas yang seharusnya vs kas aktual, catat selisih.
- **FR-52** Ringkasan shift per metode pembayaran.

### 4.7 Laporan & Dashboard
- **FR-60** Dashboard: penjualan hari ini, jumlah transaksi, rata-rata nilai transaksi, produk terlaris, stok menipis.
- **FR-61** Laporan penjualan per rentang tanggal, kategori, produk, kasir, metode bayar.
- **FR-62** Laporan penggunaan workspace (okupansi, pendapatan).
- **FR-63** Export CSV (dan PDF pada fase 2).

### 4.8 Pengaturan
- **FR-70** Profil usaha (nama, alamat, logo, footer struk).
- **FR-71** Pengaturan pajak, service charge, mata uang (IDR).
- **FR-72** Manajemen metode pembayaran.

---

## 5. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| **Performa** | Respons API p95 < 500 ms; halaman kasir interaktif < 2 dtk |
| **Keamanan** | Hash password (bcrypt), JWT, validasi input, rate limiting, CORS terbatas, HTTPS |
| **Ketersediaan** | Target uptime 99% selama jam operasional |
| **Kegunaan** | Responsif untuk tablet (utama), desktop, dan mobile; target sentuh ≥ 44px |
| **Audit** | Log aktivitas sensitif (void, refund, diskon, ubah harga, tutup shift) |
| **Backup** | Backup database harian otomatis |
| **Lokalisasi** | Bahasa Indonesia, format Rupiah (`Rp 25.000`), zona waktu WIB (Asia/Jakarta) |
| **Aksesibilitas** | Kontras warna minimal WCAG AA |

---

## 6. Technology Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | **React.js (JavaScript)**, dibangun dengan Vite |
| CSS | **TailwindCSS** |
| Backend | **Express.js (Node.js)** |
| Database | **MySQL 8** |
| ORM | **Prisma ORM** |

**Pustaka pendukung yang direkomendasikan**

| Kebutuhan | Pustaka |
|---|---|
| Routing | React Router |
| Server state / fetching | TanStack Query + Axios |
| State lokal (keranjang) | Zustand |
| Form & validasi | React Hook Form + Zod |
| Ikon | lucide-react |
| Grafik | Recharts |
| Notifikasi | react-hot-toast |
| Auth | jsonwebtoken, bcrypt |
| Validasi backend | Zod |
| Keamanan | helmet, cors, express-rate-limit |
| Logging | pino / morgan |
| Upload gambar | multer |

### 6.1 Arsitektur

```
┌────────────────────┐   HTTPS / JSON   ┌────────────────────┐      ┌──────────┐
│  React + Tailwind  │ ───────────────► │  Express.js API    │ ───► │  MySQL   │
│  (SPA, Vite)       │ ◄─────────────── │  (REST, JWT, Zod)  │ Prisma│          │
└────────────────────┘                  └────────────────────┘      └──────────┘
```

### 6.2 Struktur Folder (2 Folder: `frontend` & `backend`)

Proyek dibagi menjadi dua folder terpisah dan independen, masing-masing memiliki `package.json` dan dependensinya sendiri.

```
komazi-pos/
├── frontend/                   # React.js + TailwindCSS
│   ├── public/
│   ├── src/
│   │   ├── assets/             # logo, gambar
│   │   ├── components/         # ui/, layout/, pos/, workspace/
│   │   ├── pages/              # Login, POS, Menu, Stock, Workspace, Reports, Settings
│   │   ├── hooks/
│   │   ├── services/           # axios instance + API modules
│   │   ├── store/              # zustand (cart, auth)
│   │   ├── utils/              # formatRupiah, date
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env
│   └── package.json
│
└── backend/                    # Express.js + Prisma ORM + MySQL
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.js
    ├── src/
    │   ├── config/
    │   ├── controllers/
    │   ├── middlewares/        # auth, role, validate, error
    │   ├── routes/
    │   ├── services/           # business logic
    │   ├── validators/         # zod schemas
    │   ├── utils/
    │   ├── app.js
    │   └── server.js
    ├── uploads/                # foto produk
    ├── .env
    └── package.json
```

**Menjalankan proyek**

| Folder | Perintah | Alamat default |
|---|---|---|
| `backend` | `npm install` → `npx prisma migrate dev` → `npm run dev` | `http://localhost:4000` |
| `frontend` | `npm install` → `npm run dev` | `http://localhost:5173` |

---

## 7. Desain Database (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  OWNER
  MANAGER
  CASHIER
}

enum OrderType {
  DINE_IN
  TAKE_AWAY
}

enum OrderStatus {
  OPEN
  PAID
  VOIDED
  REFUNDED
}

enum PaymentMethod {
  CASH
  QRIS
  TRANSFER
}

enum SessionStatus {
  ACTIVE
  COMPLETED
}

enum StockMovementType {
  PURCHASE
  ADJUSTMENT
  WASTE
  SALE
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  username  String   @unique
  password  String
  role      Role     @default(CASHIER)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders    Order[]
  shifts    Shift[]
  auditLogs AuditLog[]
}

model Category {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  sortOrder Int       @default(0)
  products  Product[]
}

model Product {
  id         Int      @id @default(autoincrement())
  categoryId Int
  sku        String?  @unique
  name       String
  price      Decimal  @db.Decimal(12, 2)
  imageUrl   String?
  isActive   Boolean  @default(true)
  isSoldOut  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category   Category        @relation(fields: [categoryId], references: [id])
  variants   ProductVariant[]
  orderItems OrderItem[]

  @@index([categoryId])
}

model ProductVariant {
  id         Int     @id @default(autoincrement())
  productId  Int
  name       String                                  // contoh: "Large", "Iced"
  extraPrice Decimal @default(0) @db.Decimal(12, 2)

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model Order {
  id          Int         @id @default(autoincrement())
  invoiceNo   String      @unique
  cashierId   Int
  shiftId     Int?
  type        OrderType   @default(DINE_IN)
  tableNo     String?
  customerName String?
  status      OrderStatus @default(OPEN)
  subtotal    Decimal     @db.Decimal(12, 2)
  discount    Decimal     @default(0) @db.Decimal(12, 2)
  tax         Decimal     @default(0) @db.Decimal(12, 2)
  serviceFee  Decimal     @default(0) @db.Decimal(12, 2)
  total       Decimal     @db.Decimal(12, 2)
  voidReason  String?
  createdAt   DateTime    @default(now())
  paidAt      DateTime?

  cashier    User              @relation(fields: [cashierId], references: [id])
  shift      Shift?            @relation(fields: [shiftId], references: [id])
  items      OrderItem[]
  payments   Payment[]
  workspace  WorkspaceSession[]

  @@index([createdAt])
  @@index([status])
}

model OrderItem {
  id          Int     @id @default(autoincrement())
  orderId     Int
  productId   Int
  productName String                                   // snapshot nama saat transaksi
  variantName String?
  qty         Int
  unitPrice   Decimal @db.Decimal(12, 2)
  discount    Decimal @default(0) @db.Decimal(12, 2)
  note        String?
  lineTotal   Decimal @db.Decimal(12, 2)

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])
}

model Payment {
  id        Int           @id @default(autoincrement())
  orderId   Int
  method    PaymentMethod
  amount    Decimal       @db.Decimal(12, 2)
  reference String?
  createdAt DateTime      @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

model Shift {
  id             Int       @id @default(autoincrement())
  cashierId      Int
  openingCash    Decimal   @db.Decimal(12, 2)
  closingCash    Decimal?  @db.Decimal(12, 2)
  expectedCash   Decimal?  @db.Decimal(12, 2)
  openedAt       DateTime  @default(now())
  closedAt       DateTime?

  cashier User    @relation(fields: [cashierId], references: [id])
  orders  Order[]
}

model WorkspaceArea {
  id       Int     @id @default(autoincrement())
  name     String  @unique
  capacity Int     @default(1)
  isActive Boolean @default(true)

  sessions WorkspaceSession[]
}

model WorkspacePackage {
  id            Int     @id @default(autoincrement())
  name          String                                 // "1 Jam", "Harian"
  durationMin   Int
  price         Decimal @db.Decimal(12, 2)
  overtimePerHr Decimal @default(0) @db.Decimal(12, 2)
  isActive      Boolean @default(true)

  sessions WorkspaceSession[]
}

model WorkspaceSession {
  id           Int           @id @default(autoincrement())
  areaId       Int
  packageId    Int
  orderId      Int?
  customerName String
  phone        String?
  checkInAt    DateTime      @default(now())
  checkOutAt   DateTime?
  status       SessionStatus @default(ACTIVE)
  charge       Decimal?      @db.Decimal(12, 2)

  area    WorkspaceArea    @relation(fields: [areaId], references: [id])
  package WorkspacePackage @relation(fields: [packageId], references: [id])
  order   Order?           @relation(fields: [orderId], references: [id])
}

model Ingredient {
  id       Int     @id @default(autoincrement())
  name     String  @unique
  unit     String                                      // gram, ml, pcs
  stock    Decimal @default(0) @db.Decimal(12, 2)
  minStock Decimal @default(0) @db.Decimal(12, 2)

  movements StockMovement[]
}

model StockMovement {
  id           Int               @id @default(autoincrement())
  ingredientId Int
  type         StockMovementType
  qty          Decimal           @db.Decimal(12, 2)    // + masuk, - keluar
  note         String?
  createdAt    DateTime          @default(now())

  ingredient Ingredient @relation(fields: [ingredientId], references: [id])
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String                                     // VOID_ORDER, APPLY_DISCOUNT, ...
  detail    Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model Setting {
  key   String @id
  value String
}
```

> **Catatan:** Gunakan `Decimal` untuk semua nilai uang. Nama & harga produk disalin (snapshot) ke `OrderItem` agar riwayat transaksi tidak berubah saat menu diedit.

---

## 8. Rancangan API (REST)

Base URL: `/api/v1` — Semua endpoint (selain login) memerlukan header `Authorization: Bearer <token>`.

| Modul | Method & Endpoint | Role |
|---|---|---|
| **Auth** | `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` | Semua |
| **User** | `GET/POST /users` · `PATCH /users/:id` | Owner |
| **Kategori** | `GET/POST /categories` · `PATCH/DELETE /categories/:id` | Manager+ |
| **Produk** | `GET/POST /products` · `GET/PATCH/DELETE /products/:id` | GET: Semua, lainnya: Manager+ |
| **Order** | `GET/POST /orders` · `GET /orders/:id` · `PATCH /orders/:id` (open bill) | Kasir+ |
| | `POST /orders/:id/pay` | Kasir+ |
| | `POST /orders/:id/void` · `POST /orders/:id/refund` | Manager+ |
| **Shift** | `POST /shifts/open` · `POST /shifts/close` · `GET /shifts/current` | Kasir+ |
| **Workspace** | `GET/POST /workspace/areas` · `GET/POST /workspace/packages` | GET: Semua, lainnya: Manager+ |
| | `POST /workspace/sessions` (check-in) · `POST /workspace/sessions/:id/checkout` · `GET /workspace/sessions?status=ACTIVE` | Kasir+ |
| **Stok** | `GET/POST /ingredients` · `POST /ingredients/:id/movements` | Manager+ |
| **Laporan** | `GET /reports/summary` · `/reports/sales` · `/reports/products` · `/reports/workspace` · `/reports/export` | Manager+ |
| **Setting** | `GET/PUT /settings` | Owner |

**Format respons standar**

```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "meta": { "page": 1, "limit": 20, "total": 120 }
}
```

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": [{ "field": "qty", "message": "Minimal 1" }]
}
```

---

## 9. Design System & UI

### 9.1 Identitas Visual (dari Logo Komazi)

Logo Komazi berlatar **hitam**, dengan wordmark **KOMAZI** berwarna **coral-merah**, tagline *Coffee & Workspace* dengan warna yang sama, dan ornamen berbentuk **X/daun berwarna teal gelap** di belakang huruf "K". Dari sini diturunkan tema **dark mode** sebagai tema utama.

> ⚠️ Nilai HEX di bawah adalah estimasi visual dari gambar logo. Sebelum implementasi, sebaiknya diverifikasi dengan *color picker* pada file logo asli.

### 9.2 Palet Warna

| Token | HEX (estimasi) | Penggunaan |
|---|---|---|
| `komazi-black` | `#0A0A0A` | Latar utama aplikasi |
| `komazi-surface` | `#141414` | Kartu, panel, sidebar |
| `komazi-surface-2` | `#1E1E1E` | Input, hover, elemen terangkat |
| `komazi-border` | `#2A2A2A` | Garis pembatas |
| `komazi-coral` | `#FF5A4D` | **Warna primer**: tombol utama, judul, aksen, item aktif |
| `komazi-coral-dark` | `#E0453A` | Hover/pressed pada tombol primer |
| `komazi-coral-soft` | `#FF5A4D` @ 15% | Latar badge/highlight halus |
| `komazi-teal` | `#1F6F6B` | **Warna sekunder**: tombol sekunder, info, status tersedia |
| `komazi-teal-light` | `#2FA39C` | Hover/teks aksen teal di atas gelap |
| `komazi-text` | `#F5F5F5` | Teks utama |
| `komazi-muted` | `#9A9A9A` | Teks sekunder, placeholder |
| `success` | `#3DBE7A` | Pembayaran berhasil, stok aman |
| `warning` | `#F5B544` | Stok menipis, workspace segera berakhir |
| `danger` | `#EF4444` | Void, hapus, error |

Aturan penggunaan: ±60% hitam/abu gelap, ±30% teks terang, ±10% coral & teal sebagai aksen. Teks di atas tombol coral memakai **hitam atau putih sesuai kontras** (cek WCAG AA).

### 9.3 Konfigurasi Tailwind

```js
// frontend/tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        komazi: {
          black: "#0A0A0A",
          surface: "#141414",
          "surface-2": "#1E1E1E",
          border: "#2A2A2A",
          coral: { DEFAULT: "#FF5A4D", dark: "#E0453A" },
          teal: { DEFAULT: "#1F6F6B", light: "#2FA39C" },
          text: "#F5F5F5",
          muted: "#9A9A9A",
        },
        success: "#3DBE7A",
        warning: "#F5B544",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem" },
      boxShadow: { glow: "0 0 0 3px rgba(255,90,77,0.25)" },
    },
  },
  plugins: [],
};
```

### 9.4 Tipografi
- **Judul / brand:** Poppins (Semibold–Bold), bentuk membulat serupa wordmark logo.
- **Isi & angka:** Inter (Regular–Semibold), gunakan `tabular-nums` pada harga.
- Skala: 12 / 14 / 16 / 20 / 24 / 32 px.

### 9.5 Komponen Utama

| Komponen | Spesifikasi |
|---|---|
| **Tombol primer** | `bg-komazi-coral hover:bg-komazi-coral-dark rounded-xl font-semibold` |
| **Tombol sekunder** | `bg-komazi-teal hover:bg-komazi-teal-light` atau outline teal |
| **Tombol bahaya** | Outline/solid `danger`, wajib konfirmasi |
| **Kartu produk** | `bg-komazi-surface border border-komazi-border rounded-2xl`, foto atas, nama, harga coral |
| **Input** | `bg-komazi-surface-2 border-komazi-border focus:ring-komazi-coral` |
| **Badge status** | Pill kecil; warna sesuai status (success/warning/danger/teal) |
| **Sidebar** | Latar `surface`, item aktif: teks coral + latar `coral-soft` + garis kiri coral |
| **Modal** | Latar `surface`, overlay `black/70`, sudut `2xl` |

### 9.6 Layout Halaman

**1. Login**
Latar hitam, logo Komazi di tengah, form username/password, tombol coral.

**2. Halaman Kasir (POS)** — halaman terpenting, dioptimalkan untuk tablet landscape
```
┌────────┬──────────────────────────────────┬──────────────────┐
│Sidebar │  [Cari produk…]                  │  Pesanan #KMZ-…  │
│ (ikon) │  [Semua][Kopi][Non-Kopi][Food]   │  Dine-in ▾ Meja  │
│        │  ┌─────┐┌─────┐┌─────┐┌─────┐    │  ───────────────  │
│        │  │Menu ││Menu ││Menu ││Menu │    │  Latte  x2  50rb │
│        │  └─────┘└─────┘└─────┘└─────┘    │  Croissant x1    │
│        │  ┌─────┐┌─────┐┌─────┐┌─────┐    │  ───────────────  │
│        │  │Menu ││Menu ││Menu ││Menu │    │  Subtotal / PPN  │
│        │  └─────┘└─────┘└─────┘└─────┘    │  TOTAL  Rp 80rb  │
│        │                                  │  [ BAYAR ]       │
└────────┴──────────────────────────────────┴──────────────────┘
```

**3. Workspace** — grid kartu area dengan status berwarna (hijau tersedia, coral terisi, kuning segera habis), timer hitung mundur, tombol Check-in/Check-out.

**4. Menu & Kategori** — tabel + form (modal) dengan upload foto.

**5. Stok** — tabel bahan, indikator stok menipis, form stok masuk/opname.

**6. Laporan / Dashboard** — kartu ringkasan (omzet, transaksi, rata-rata), grafik penjualan (garis coral), produk terlaris (bar teal), tabel detail + export.

**7. Pengaturan** — profil usaha, pajak, metode pembayaran, user.

### 9.7 Prinsip UX
- Alur kasir minimal klik; tombol besar dan ramah sentuh.
- Konfirmasi untuk aksi destruktif (void, hapus).
- Umpan balik instan (toast) setelah aksi.
- Shortcut keyboard di desktop (mis. `F2` cari produk, `F9` bayar).
- Skeleton loading dan *empty state* yang jelas.

---

## 10. Alur Pengguna Utama

**A. Transaksi F&B**
1. Kasir login → buka shift (input modal kas).
2. Pilih produk → atur qty/varian/catatan.
3. Pilih tipe pesanan (dine-in / take-away) → terapkan diskon bila perlu.
4. Klik **Bayar** → pilih metode → konfirmasi.
5. Sistem menyimpan transaksi, mengurangi stok (fase 2), menampilkan struk.

**B. Sesi Workspace**
1. Kasir klik area tersedia → **Check-in** (nama, paket).
2. Timer berjalan; sistem memberi peringatan mendekati batas waktu.
3. Saat selesai → **Check-out** → tarif (+ overtime) dihitung.
4. Tagihan digabung dengan pesanan F&B pelanggan → bayar dalam satu invoice.

**C. Tutup Shift**
1. Kasir klik **Tutup Shift** → hitung uang fisik.
2. Sistem menampilkan kas seharusnya, selisih, dan ringkasan per metode bayar.
3. Manager meninjau laporan shift.

---

## 11. Aturan Bisnis
- Nomor invoice: `KMZ-YYYYMMDD-NNNN` (reset harian).
- Perhitungan: `total = subtotal − diskon + service + pajak` (urutan dapat dikonfigurasi di pengaturan).
- Pembulatan total ke Rp 100 terdekat (opsional, dapat diaktifkan).
- Transaksi berstatus `PAID` **tidak dapat diubah**; koreksi hanya via void/refund dengan alasan & otorisasi.
- Kasir hanya dapat memberi diskon hingga batas tertentu; di atas itu butuh PIN Manager.
- Sesi workspace yang belum check-out saat tutup hari ditandai untuk ditinjau.
- Tidak boleh menutup shift jika masih ada *open bill*.

---

## 12. Keamanan
- Password di-hash dengan bcrypt (cost ≥ 10).
- JWT access token pendek (±15 menit) + refresh token (±7 hari).
- Validasi semua input di server dengan Zod; Prisma mencegah SQL injection lewat parameterized query.
- `helmet`, CORS whitelist, dan rate limit khusus endpoint login.
- Variabel rahasia hanya di `.env` (tidak masuk repositori).
- Audit log untuk aksi sensitif.

---

## 13. Deployment & Lingkungan
| Lingkungan | Keterangan |
|---|---|
| **Development** | Lokal: `vite dev` + `nodemon`, MySQL lokal/Docker |
| **Production** | VPS (mis. Ubuntu) + Nginx (reverse proxy & static file frontend), PM2 untuk Express, MySQL terkelola/terpisah |
| **CI/CD** | GitHub Actions: lint → test → build → deploy |
| **Migrasi DB** | `prisma migrate deploy` saat rilis |
| **Backup** | `mysqldump` terjadwal harian + retensi 14 hari |

Variabel lingkungan inti:
```
DATABASE_URL="mysql://user:pass@localhost:3306/komazi_pos"
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PORT=4000
FRONTEND_URL=http://localhost:5173
TZ=Asia/Jakarta
```

---

## 14. Roadmap

| Fase | Durasi (estimasi) | Cakupan |
|---|---|---|
| **0. Persiapan** | 1 minggu | Finalisasi PRD, desain UI (wireframe/prototipe), setup repositori |
| **1. Fondasi** | 1–2 minggu | Setup monorepo, Prisma schema + seed, auth & role, layout dasar + design system |
| **2. Inti POS** | 2–3 minggu | Menu/kategori, halaman kasir, pembayaran, struk, shift |
| **3. Workspace & Stok** | 2 minggu | Modul workspace, stok bahan, peringatan stok |
| **4. Laporan** | 1–2 minggu | Dashboard, laporan, export CSV |
| **5. QA & UAT** | 1–2 minggu | Pengujian, perbaikan bug, pelatihan kasir |
| **6. Go-live** | 1 minggu | Deploy production, pendampingan awal |
| **Fase 2+** | Menyusul | Resep/BOM, loyalti, payment gateway, kitchen display, PWA offline |

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Koneksi internet putus saat jam ramai | Transaksi terhenti | Rencanakan PWA/offline (fase 2); sementara siapkan prosedur cadangan manual |
| Kasir sulit beradaptasi | Adopsi rendah | UI sederhana, pelatihan singkat, masa paralel dengan pencatatan lama |
| Data stok tidak akurat | Laporan menyesatkan | Stock opname rutin, log pergerakan stok |
| Kesalahan perhitungan uang | Kerugian finansial | Tipe `Decimal`, unit test perhitungan, snapshot harga di order |
| Printer thermal tidak kompatibel | Struk tak tercetak | Mulai dengan cetak browser; uji perangkat sebelum fase 2 |

---

## 16. Pertanyaan Terbuka
1. Apakah Komazi hanya 1 outlet atau ada rencana multi-cabang dalam waktu dekat?
2. Perangkat kasir utama: tablet, laptop, atau PC? Apakah sudah ada printer thermal (ukuran 58/80 mm)?
3. Apakah tarif workspace sudah ditetapkan (per jam/hari/bulanan)? Apakah ada membership bulanan?
4. Pajak PPN dan service charge diberlakukan? Berapa persentasenya?
5. Metode pembayaran apa saja yang diterima (tunai, QRIS, debit, e-wallet)?
6. Apakah stok bahan akan dilacak per resep sejak awal atau cukup stok barang jadi dulu?
7. Apakah perlu pelacakan data pelanggan (nomor HP) untuk loyalti?
8. Font & kode warna resmi brand: apakah ada panduan brand (brand guideline) yang bisa dijadikan acuan?

---

## 17. Lampiran — Acuan Visual Brand

- **Logo:** lingkaran hitam, wordmark "KOMAZI" coral, ornamen X teal gelap, tagline "COFFEE & WORKSPACE".
- **Gaya:** modern, hangat, dark-mode, dengan aksen coral yang hidup dan teal yang tenang sebagai penyeimbang.
