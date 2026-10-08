# Implementation — Bot Telegram Komazi POS (grammY)

| | |
|---|---|
| **Versi** | 1.0 (Draft) |
| **Tanggal** | 8 Oktober 2026 |
| **Dokumen induk** | `prd.md` |
| **Package utama** | [grammY](https://grammy.dev) + plugin resmi |
| **Lokasi kode** | `backend/src/bot/` |

---

## 1. Tujuan

Bot Telegram **Komazi POS** menjadi saluran interaksi cepat di luar aplikasi web, sehingga setiap peran bisa bekerja dan menerima informasi langsung dari Telegram.

| Peran | Yang dibantu bot |
|---|---|
| **Owner** | Ringkasan penjualan, laporan harian otomatis, notifikasi kejadian penting (void besar, selisih kas), kelola tautan akun |
| **Manager** | Persetujuan void/diskon, cek & update stok, tandai menu habis, laporan shift |
| **Kasir** | Buka/tutup shift, buat pesanan cepat, check-in/out workspace, cek status pesanan, minta persetujuan |
| **Barista** | Menerima antrean pesanan baru, ubah status *Diproses → Siap* |

Prinsip utama:
1. **Bot bukan sistem terpisah.** Bot berjalan di proses backend yang sama dan memanggil *service layer* yang sama dengan REST API, jadi aturan bisnis (pajak, diskon, stok, shift) tidak diduplikasi.
2. **Satu akun, satu peran.** Akun Telegram ditautkan ke `User` POS. Hak akses mengikuti role di database.
3. **Aman secara default.** Telegram ID yang belum tertaut tidak bisa melakukan apa pun.

### 1.1 Di Luar Lingkup
- Menggantikan layar kasir web (web tetap antarmuka utama untuk transaksi ramai).
- Pembayaran langsung di dalam Telegram (pencatatan metode bayar saja).
- Bot untuk pelanggan (publik). Fokus dokumen ini hanya staf internal.

---

## 2. Arsitektur

```
                       ┌──────────────────────────────────────────────┐
 Telegram ◄──────────► │ backend (Express.js)                         │
 (Bot API)   webhook   │                                              │
                       │  /api/v1/*      REST untuk frontend web      │
                       │  /telegram/*    webhook grammY               │
                       │                                              │
                       │  ┌──────────┐   ┌──────────────────────────┐ │
                       │  │ bot/     │──►│ services/ (logika bisnis)│ │
                       │  │ grammY   │   └──────────┬───────────────┘ │
                       │  └────▲─────┘              │ Prisma          │
                       │       │ events             ▼                 │
                       │  ┌────┴─────┐        ┌──────────┐            │
                       │  │ notifier │◄───────│  MySQL   │            │
                       │  └──────────┘        └──────────┘            │
                       └──────────────────────────────────────────────┘
```

- **Mode dev:** long polling (`bot.start()`), tanpa perlu domain publik.
- **Mode production:** webhook lewat Express + `secret_token`.
- **Notifikasi proaktif:** service memancarkan *event* (`order.paid`, `stock.low`, dst.), lalu `notifier` mengirim pesan ke role yang relevan.

---

## 3. Package

```bash
cd backend
npm i grammy @grammyjs/conversations @grammyjs/runner @grammyjs/auto-retry @grammyjs/ratelimiter node-cron
```

| Package | Fungsi |
|---|---|
| `grammy` | Framework bot (Bot, InlineKeyboard, webhookCallback) |
| `@grammyjs/conversations` | Alur multi-langkah (v2) seperti buka shift, pesanan, check-in |
| `@grammyjs/runner` | `sequentialize` agar update dari chat yang sama diproses berurutan |
| `@grammyjs/auto-retry` | Retry otomatis saat kena rate limit Telegram (429) |
| `@grammyjs/ratelimiter` | Batasi spam perintah per pengguna |
| `node-cron` | Laporan harian & pengecekan berkala |

> Plugin `conversations` v2 adalah *rewrite* total dari v1. Gunakan dokumentasi v2 saat mengikuti contoh.

---

## 4. Struktur Folder

Ditambahkan di dalam `backend/`:

```
backend/src/bot/
├── index.js                  # inisialisasi bot, middleware, registrasi
├── context.js                # helper tipe/konteks
├── commands.js               # daftar command per role + setMyCommands
├── middlewares/
│   ├── auth.js               # muat user dari telegramId
│   ├── role.js               # requireRole(...)
│   ├── error.js              # error handler global
│   └── audit.js              # catat aksi sensitif
├── handlers/
│   ├── start.js              # /start, /help, /menu, /whoami, penautikan akun
│   ├── cashier.js            # shift, order cepat, workspace, open bill
│   ├── barista.js            # antrean & status pesanan
│   ├── manager.js            # stok, habis, approval, laporan shift
│   └── owner.js              # ringkasan, laporan, kelola tautan
├── conversations/
│   ├── openShift.js
│   ├── closeShift.js
│   ├── quickOrder.js
│   ├── checkinWorkspace.js
│   ├── stockIn.js
│   └── requestApproval.js
├── keyboards/
│   └── index.js              # menu utama per role, pagination
├── notifier.js               # kirim notifikasi ke role/chat
├── events.js                 # EventEmitter yang dipakai services
├── jobs.js                   # cron: laporan harian, stok, workspace
└── utils/
    ├── format.js             # Rupiah, tanggal WIB, escape HTML
    └── callbacks.js          # skema callback_data
```

---

## 5. Perubahan Database (Prisma)

Edit `backend/prisma/schema.prisma`.

```prisma
enum Role {
  OWNER
  MANAGER
  CASHIER
  BARISTA            // ditambahkan (sebelumnya fase 2)
}

enum OrderStatus {
  OPEN
  PREPARING          // ditambahkan: sedang dibuat barista
  READY              // ditambahkan: siap diantar/diambil
  PAID
  VOIDED
  REFUNDED
}

enum ApprovalType {
  VOID_ORDER
  DISCOUNT
  REFUND
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

model User {
  // ...field yang sudah ada
  telegramId       String?   @unique      // chat id Telegram (private chat)
  telegramUsername String?
  telegramLinkedAt DateTime?

  linkCodes        TelegramLinkCode[]
  approvalsRequested ApprovalRequest[] @relation("Requester")
  approvalsDecided   ApprovalRequest[] @relation("Decider")
}

// Kode sekali pakai untuk menautkan akun POS ↔ Telegram
model TelegramLinkCode {
  id        Int       @id @default(autoincrement())
  userId    Int
  code      String    @unique              // 8 karakter acak
  expiresAt DateTime
  usedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Permintaan persetujuan Kasir → Manager/Owner
model ApprovalRequest {
  id            Int            @id @default(autoincrement())
  type          ApprovalType
  orderId       Int
  requesterId   Int
  deciderId     Int?
  status        ApprovalStatus @default(PENDING)
  reason        String
  payload       Json?                       // mis. { discountPct: 20 }
  createdAt     DateTime       @default(now())
  decidedAt     DateTime?

  requester User @relation("Requester", fields: [requesterId], references: [id])
  decider   User? @relation("Decider", fields: [deciderId], references: [id])

  @@index([status])
}
```

Setting tambahan (tabel `Setting` yang sudah ada):

| Key | Contoh nilai | Keterangan |
|---|---|---|
| `bot.barista_chat_id` | `-1001234567890` | Grup Telegram barista (opsional; jika kosong, kirim ke DM barista) |
| `bot.daily_report_time` | `22:00` | Jam kirim laporan harian (WIB) |
| `bot.void_alert_min` | `100000` | Void di atas nominal ini langsung dikabari ke Owner |

Jalankan migrasi:

```bash
npx prisma migrate dev --name add_telegram_bot
```

> `telegramId` disimpan sebagai `String` agar aman dari masalah serialisasi `BigInt` pada JSON.

---

## 6. Konfigurasi

### 6.1 Membuat Bot
1. Buka **@BotFather** di Telegram → `/newbot` → ikuti instruksi (nama: *Komazi POS*, username berakhiran `bot`).
2. Simpan **token** yang diberikan.
3. Atur lewat BotFather: `/setprivacy` → *Enable* (bot hanya melihat command/balasan di grup), `/setjoingroups` → sesuai kebutuhan (hanya jika ingin dipakai di grup barista).
4. Opsional: set foto profil bot dengan logo Komazi dan deskripsi singkat.

### 6.2 Environment (`backend/.env`)

```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_URL=https://api.komazi.example.com/telegram/hook
TELEGRAM_WEBHOOK_PATH=hook
TELEGRAM_WEBHOOK_SECRET=ganti_dengan_string_acak_panjang
BOT_LINK_CODE_TTL_MIN=10
TZ=Asia/Jakarta
```

> `.env` tidak boleh masuk repositori. Token yang bocor harus segera di-*revoke* lewat BotFather (`/revoke`).

---

## 7. Implementasi Inti

### 7.1 Inisialisasi Bot — `bot/index.js`

```js
import { Bot, GrammyError, HttpError } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import { limit } from "@grammyjs/ratelimiter";

import { auth } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/error.js";
import { registerStart } from "./handlers/start.js";
import { registerCashier } from "./handlers/cashier.js";
import { registerBarista } from "./handlers/barista.js";
import { registerManager } from "./handlers/manager.js";
import { registerOwner } from "./handlers/owner.js";

import { openShift } from "./conversations/openShift.js";
import { closeShift } from "./conversations/closeShift.js";
import { quickOrder } from "./conversations/quickOrder.js";
import { checkinWorkspace } from "./conversations/checkinWorkspace.js";
import { stockIn } from "./conversations/stockIn.js";
import { requestApproval } from "./conversations/requestApproval.js";

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// 1) Infrastruktur
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 5 }));
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));   // urut per chat
bot.use(limit({
  timeFrame: 2000,
  limit: 4,
  onLimitExceeded: (ctx) => ctx.reply("Terlalu cepat, mohon tunggu sebentar ya."),
}));

// 2) Autentikasi: isi ctx.user (null jika belum tertaut)
bot.use(auth);

// 3) Perintah pembatalan HARUS sebelum conversations
bot.command("batal", async (ctx) => {
  await ctx.conversation.exitAll();
  await ctx.reply("Proses dibatalkan.");
});

// 4) Conversations
bot.use(conversations());
bot.use(createConversation(openShift, "openShift"));
bot.use(createConversation(closeShift, "closeShift"));
bot.use(createConversation(quickOrder, "quickOrder"));
bot.use(createConversation(checkinWorkspace, "checkinWorkspace"));
bot.use(createConversation(stockIn, "stockIn"));
bot.use(createConversation(requestApproval, "requestApproval"));

// 5) Handlers per fitur/role
registerStart(bot);
registerCashier(bot);
registerBarista(bot);
registerManager(bot);
registerOwner(bot);

// 6) Error handler global
bot.catch(errorHandler);
```

> **Catatan penting:** `ctx.conversation` hanya tersedia setelah `conversations()` dipasang, dan `bot.command("batal")` didaftarkan *sebelum* `createConversation(...)` agar bisa memotong percakapan yang sedang berjalan.

### 7.2 Autentikasi — `middlewares/auth.js`

```js
import { prisma } from "../../config/prisma.js";

export async function auth(ctx, next) {
  const tgId = ctx.from?.id?.toString();
  if (!tgId || ctx.chat?.type !== "private") {
    ctx.user = null;                     // di grup: tidak ada identitas staf
    return next();
  }
  ctx.user = await prisma.user.findFirst({
    where: { telegramId: tgId, isActive: true },
  });
  return next();
}
```

### 7.3 Guard Role — `middlewares/role.js`

```js
export const requireRole = (...roles) => async (ctx, next) => {
  if (!ctx.user) {
    return ctx.reply("Akun Telegram Anda belum tertaut. Minta kode tautan ke Owner, lalu kirim /start KODE.");
  }
  if (!roles.includes(ctx.user.role)) {
    return ctx.reply("Anda tidak memiliki akses untuk perintah ini.");
  }
  return next();
};
```

Pemakaian:

```js
bot.command("tutup_shift", requireRole("CASHIER", "MANAGER", "OWNER"), (ctx) =>
  ctx.conversation.enter("closeShift"));
```

### 7.4 Penautikan Akun — `handlers/start.js`

**Alur:**
1. Owner (di web atau via bot `/tautkan`) memilih staf → sistem membuat `TelegramLinkCode` (8 karakter, berlaku 10 menit, sekali pakai).
2. Staf membuka bot dan mengirim `/start KODE`.
3. Bot memvalidasi kode, mengisi `User.telegramId`, menandai kode terpakai, lalu menampilkan menu sesuai role.

```js
import { prisma } from "../../config/prisma.js";
import { setCommandsForUser } from "../commands.js";
import { mainMenu } from "../keyboards/index.js";

export function registerStart(bot) {
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const code = ctx.match?.trim();

    // Sudah tertaut → tampilkan menu
    if (ctx.user && !code) {
      return ctx.reply(`Halo, ${ctx.user.name}! (${ctx.user.role})`, {
        reply_markup: mainMenu(ctx.user.role),
      });
    }

    if (!code) {
      return ctx.reply("Selamat datang di Komazi POS ☕\nKirim: /start KODE_TAUTAN");
    }

    const link = await prisma.telegramLinkCode.findUnique({
      where: { code },
      include: { user: true },
    });

    if (!link || link.usedAt || link.expiresAt < new Date() || !link.user.isActive) {
      return ctx.reply("Kode tidak valid atau sudah kedaluwarsa. Minta kode baru ke Owner.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: link.userId },
        data: {
          telegramId: ctx.from.id.toString(),
          telegramUsername: ctx.from.username ?? null,
          telegramLinkedAt: new Date(),
        },
      }),
      prisma.telegramLinkCode.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await setCommandsForUser(bot, ctx.from.id, link.user.role);
    await ctx.reply(`Berhasil! Akun tertaut sebagai ${link.user.name} (${link.user.role}).`, {
      reply_markup: mainMenu(link.user.role),
    });
  });

  bot.command("whoami", (ctx) =>
    ctx.reply(ctx.user ? `${ctx.user.name} — ${ctx.user.role}` : "Belum tertaut."));

  bot.command("menu", (ctx) =>
    ctx.user
      ? ctx.reply("Menu utama:", { reply_markup: mainMenu(ctx.user.role) })
      : ctx.reply("Akun belum tertaut."));
}
```

### 7.5 Command per Role — `commands.js`

Telegram mendukung daftar command berbeda per chat, sehingga setiap peran hanya melihat perintah miliknya di menu `/`.

```js
const COMMON = [
  { command: "menu", description: "Tampilkan menu utama" },
  { command: "whoami", description: "Info akun saya" },
  { command: "batal", description: "Batalkan proses berjalan" },
];

export const ROLE_COMMANDS = {
  CASHIER: [
    { command: "buka_shift", description: "Buka shift & input modal kas" },
    { command: "tutup_shift", description: "Tutup shift" },
    { command: "order", description: "Buat pesanan cepat" },
    { command: "pesanan", description: "Pesanan aktif / open bill" },
    { command: "workspace", description: "Status area workspace" },
    { command: "checkin", description: "Check-in workspace" },
    { command: "checkout", description: "Check-out workspace" },
    { command: "approval", description: "Ajukan void/diskon" },
  ],
  BARISTA: [
    { command: "antrean", description: "Lihat antrean pesanan" },
  ],
  MANAGER: [
    { command: "approval", description: "Persetujuan menunggu" },
    { command: "stok", description: "Cek stok bahan" },
    { command: "stok_masuk", description: "Catat stok masuk" },
    { command: "habis", description: "Tandai menu habis/tersedia" },
    { command: "laporan", description: "Laporan hari ini" },
    { command: "workspace", description: "Status area workspace" },
  ],
  OWNER: [
    { command: "ringkasan", description: "Ringkasan penjualan" },
    { command: "laporan", description: "Laporan per periode" },
    { command: "approval", description: "Persetujuan menunggu" },
    { command: "stok", description: "Cek stok bahan" },
    { command: "tautkan", description: "Buat kode tautan staf" },
  ],
};

export async function setCommandsForUser(bot, telegramId, role) {
  await bot.api.setMyCommands(
    [...COMMON, ...(ROLE_COMMANDS[role] ?? [])],
    { scope: { type: "chat", chat_id: Number(telegramId) } },
  );
}
```

> Command Telegram hanya boleh huruf kecil, angka, dan underscore (maks. 32 karakter). Pastikan nama seperti `buka_shift` sesuai aturan ini.

### 7.6 Menu Utama per Role — `keyboards/index.js`

```js
import { InlineKeyboard } from "grammy";

export function mainMenu(role) {
  const kb = new InlineKeyboard();
  switch (role) {
    case "CASHIER":
      kb.text("🧾 Pesanan Baru", "go:order").text("📋 Pesanan Aktif", "go:orders").row()
        .text("💻 Workspace", "go:workspace").text("⏱ Shift", "go:shift");
      break;
    case "BARISTA":
      kb.text("☕ Antrean", "go:queue");
      break;
    case "MANAGER":
      kb.text("✅ Approval", "go:approval").text("📦 Stok", "go:stock").row()
        .text("🚫 Menu Habis", "go:soldout").text("📊 Laporan", "go:report");
      break;
    case "OWNER":
      kb.text("📊 Ringkasan", "go:summary").text("✅ Approval", "go:approval").row()
        .text("📦 Stok", "go:stock").text("🔗 Tautkan Staf", "go:link");
      break;
  }
  return kb;
}
```

### 7.7 Skema `callback_data`

Batas `callback_data` Telegram adalah **64 byte**, jadi gunakan format ringkas `domain:aksi:id`.

| Pola | Contoh | Arti |
|---|---|---|
| `go:<fitur>` | `go:order` | Navigasi menu |
| `cat:<id>` | `cat:3` | Pilih kategori |
| `prd:<id>` | `prd:15` | Pilih produk |
| `qty:<+/->` | `qty:+` | Ubah jumlah |
| `pay:<metode>` | `pay:CASH` | Pilih metode bayar |
| `ord:<aksi>:<id>` | `ord:ready:128` | Aksi pada pesanan (barista) |
| `apr:<ok/no>:<id>` | `apr:ok:12` | Setujui/tolak approval |
| `area:<id>` | `area:4` | Pilih area workspace |

Selalu panggil `ctx.answerCallbackQuery()` agar indikator loading di tombol hilang.

---

## 8. Percakapan (Conversations)

> **Aturan emas conversations v2:** fungsi percakapan dijalankan ulang (*replay*) setiap ada update baru. Karena itu, **semua efek samping** (query/tulis database, panggilan service, `Date.now()`, angka acak) wajib dibungkus `conversation.external(() => ...)` agar tidak terjalankan berulang.
>
> Konteks `ctx.user` dari middleware luar tidak otomatis ada di dalam conversation, jadi ambil lewat helper `getBotUser`.

Helper bersama:

```js
// bot/context.js
import { prisma } from "../config/prisma.js";

export const getBotUser = (conversation, ctx) =>
  conversation.external(() =>
    prisma.user.findFirst({ where: { telegramId: ctx.from.id.toString(), isActive: true } }));
```

### 8.1 Buka Shift — `conversations/openShift.js`

```js
import { getBotUser } from "../context.js";
import { shiftService } from "../../services/shift.service.js";
import { rupiah } from "../utils/format.js";

export async function openShift(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);

  const current = await conversation.external(() => shiftService.getCurrent(user.id));
  if (current) return ctx.reply("Anda masih memiliki shift yang aktif.");

  await ctx.reply("Masukkan modal kas awal (angka saja, mis. 500000):");

  let amount;
  while (true) {
    const { message } = await conversation.waitFor("message:text");
    amount = Number(message.text.replace(/\D/g, ""));
    if (amount > 0) break;
    await ctx.reply("Nominal tidak valid. Coba lagi atau /batal.");
  }

  await conversation.external(() => shiftService.open(user.id, amount));
  await ctx.reply(`✅ Shift dibuka. Modal kas ${rupiah(amount)}.`);
}
```

### 8.2 Pesanan Cepat — `conversations/quickOrder.js` (kerangka)

Alur: **kategori → produk → jumlah → (ulang / selesai) → tipe pesanan → metode bayar → konfirmasi**.

```js
import { InlineKeyboard } from "grammy";
import { getBotUser } from "../context.js";
import { menuService } from "../../services/menu.service.js";
import { orderService } from "../../services/order.service.js";
import { rupiah, esc } from "../utils/format.js";

export async function quickOrder(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  const shift = await conversation.external(() => orderService.requireOpenShift(user.id));
  if (!shift) return ctx.reply("Buka shift dulu dengan /buka_shift.");

  const categories = await conversation.external(() => menuService.listCategories());
  const cart = [];                                   // [{ productId, name, price, qty }]

  while (true) {
    // 1) Pilih kategori
    const kbCat = new InlineKeyboard();
    categories.forEach((c) => kbCat.text(c.name, `cat:${c.id}`).row());
    if (cart.length) kbCat.text("✅ Selesai", "cart:done");
    await ctx.reply("Pilih kategori:", { reply_markup: kbCat });

    const catCtx = await conversation.waitForCallbackQuery(/^(cat:\d+|cart:done)$/);
    await catCtx.answerCallbackQuery();
    if (catCtx.callbackQuery.data === "cart:done") break;

    // 2) Pilih produk
    const catId = Number(catCtx.callbackQuery.data.split(":")[1]);
    const products = await conversation.external(() => menuService.listAvailable(catId));
    const kbPrd = new InlineKeyboard();
    products.forEach((p) => kbPrd.text(`${p.name} · ${rupiah(p.price)}`, `prd:${p.id}`).row());
    await ctx.reply("Pilih menu:", { reply_markup: kbPrd });

    const prdCtx = await conversation.waitForCallbackQuery(/^prd:\d+$/);
    await prdCtx.answerCallbackQuery();
    const product = products.find((p) => p.id === Number(prdCtx.callbackQuery.data.split(":")[1]));

    // 3) Jumlah
    await ctx.reply(`Jumlah untuk <b>${esc(product.name)}</b>? (kirim angka)`, { parse_mode: "HTML" });
    let qty;
    while (true) {
      const { message } = await conversation.waitFor("message:text");
      qty = parseInt(message.text, 10);
      if (qty >= 1 && qty <= 50) break;
      await ctx.reply("Jumlah tidak valid (1–50).");
    }
    cart.push({ productId: product.id, name: product.name, price: Number(product.price), qty });
    await ctx.reply(`➕ ${qty}× ${esc(product.name)} masuk keranjang.`, { parse_mode: "HTML" });
  }

  // 4) Tipe pesanan
  await ctx.reply("Tipe pesanan:", {
    reply_markup: new InlineKeyboard().text("Dine-in", "type:DINE_IN").text("Take-away", "type:TAKE_AWAY"),
  });
  const typeCtx = await conversation.waitForCallbackQuery(/^type:(DINE_IN|TAKE_AWAY)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.callbackQuery.data.split(":")[1];

  // 5) Ringkasan dari service (hitung pajak/service sesuai pengaturan, bukan di bot)
  const preview = await conversation.external(() => orderService.preview({ items: cart, type }));
  const lines = preview.items.map((i) => `${i.qty}× ${esc(i.name)} — ${rupiah(i.lineTotal)}`).join("\n");
  await ctx.reply(
    `<b>Ringkasan</b>\n${lines}\n\nSubtotal: ${rupiah(preview.subtotal)}\nPajak: ${rupiah(preview.tax)}\n<b>Total: ${rupiah(preview.total)}</b>`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("💵 Tunai", "pay:CASH").text("📱 QRIS", "pay:QRIS").row()
        .text("🏦 Transfer", "pay:TRANSFER").text("🕓 Open Bill", "pay:OPEN").row()
        .text("❌ Batal", "pay:CANCEL"),
    },
  );

  const payCtx = await conversation.waitForCallbackQuery(/^pay:(CASH|QRIS|TRANSFER|OPEN|CANCEL)$/);
  await payCtx.answerCallbackQuery();
  const method = payCtx.callbackQuery.data.split(":")[1];
  if (method === "CANCEL") return ctx.reply("Pesanan dibatalkan.");

  // 6) Simpan (satu-satunya efek samping, dibungkus external)
  const order = await conversation.external(() =>
    orderService.createFromBot({ cashierId: user.id, shiftId: shift.id, items: cart, type, payment: method }));

  await ctx.reply(`✅ Pesanan <b>${order.invoiceNo}</b> tersimpan.${method === "OPEN" ? "\nStatus: Open Bill." : ""}`, { parse_mode: "HTML" });
  // event "order.created" dipancarkan oleh orderService → notifier mengirim ke barista
}
```

> Untuk tunai, tambahkan satu langkah: bot meminta nominal uang diterima dan menampilkan kembalian. Untuk QRIS/transfer, kasir cukup menekan "sudah diterima" setelah memeriksa mutasi.

### 8.3 Check-in Workspace — `conversations/checkinWorkspace.js` (kerangka)

```js
import { InlineKeyboard } from "grammy";
import { workspaceService } from "../../services/workspace.service.js";

export async function checkinWorkspace(conversation, ctx) {
  const areas = await conversation.external(() => workspaceService.listAvailableAreas());
  if (!areas.length) return ctx.reply("Semua area sedang terisi.");

  const kbArea = new InlineKeyboard();
  areas.forEach((a) => kbArea.text(a.name, `area:${a.id}`).row());
  await ctx.reply("Pilih area:", { reply_markup: kbArea });
  const areaCtx = await conversation.waitForCallbackQuery(/^area:\d+$/);
  await areaCtx.answerCallbackQuery();
  const areaId = Number(areaCtx.callbackQuery.data.split(":")[1]);

  const packages = await conversation.external(() => workspaceService.listPackages());
  const kbPkg = new InlineKeyboard();
  packages.forEach((p) => kbPkg.text(p.name, `pkg:${p.id}`).row());
  await ctx.reply("Pilih paket:", { reply_markup: kbPkg });
  const pkgCtx = await conversation.waitForCallbackQuery(/^pkg:\d+$/);
  await pkgCtx.answerCallbackQuery();
  const packageId = Number(pkgCtx.callbackQuery.data.split(":")[1]);

  await ctx.reply("Nama pelanggan?");
  const { message } = await conversation.waitFor("message:text");

  const session = await conversation.external(() =>
    workspaceService.checkIn({ areaId, packageId, customerName: message.text.trim() }));

  await ctx.reply(`✅ Check-in berhasil.\nArea: ${session.area.name}\nBerakhir: ${session.endsAtLabel}`);
}
```

### 8.4 Permintaan Approval — `conversations/requestApproval.js`

Alur: Kasir memilih pesanan → jenis (void/diskon) → alasan → bot membuat `ApprovalRequest` dan mengirim kartu persetujuan ke **semua Manager & Owner**.

Pesan yang diterima Manager:

```
🔔 Permintaan Persetujuan #12
Jenis   : VOID
Pesanan : KMZ-20261008-0031 (Rp 85.000)
Kasir   : Rina
Alasan  : Salah input menu

[✅ Setujui]  [❌ Tolak]
```

Handler tombol (`handlers/manager.js`):

```js
bot.callbackQuery(/^apr:(ok|no):(\d+)$/, requireRole("MANAGER", "OWNER"), async (ctx) => {
  const [, decision, id] = ctx.match;
  const result = await approvalService.decide({
    id: Number(id),
    deciderId: ctx.user.id,
    approve: decision === "ok",
  });

  if (!result.ok) {
    await ctx.answerCallbackQuery({ text: result.message, show_alert: true });   // mis. sudah diputuskan
    return;
  }
  await ctx.answerCallbackQuery({ text: "Tersimpan" });
  await ctx.editMessageText(`${decision === "ok" ? "✅ Disetujui" : "❌ Ditolak"} oleh ${ctx.user.name}`);
  await notifier.toUser(result.request.requesterId, `Permintaan #${id} ${decision === "ok" ? "disetujui" : "ditolak"}.`);
});
```

Aturan: hanya keputusan **pertama** yang berlaku (`approvalService.decide` memakai update bersyarat `WHERE status = 'PENDING'`); Manager lain yang menekan tombol akan mendapat pesan "sudah diputuskan". Permintaan kedaluwarsa otomatis setelah 30 menit.

### 8.4 Tutup Shift, Stok Masuk
- **`closeShift`**: bot menampilkan kas seharusnya (dari service), meminta kas aktual, menghitung selisih, lalu mengirim ringkasan ke Manager/Owner. Ditolak jika masih ada *open bill*.
- **`stockIn`**: pilih bahan → input jumlah → catatan opsional → tulis `StockMovement(PURCHASE)`.

---

## 9. Handler Per Role

### 9.1 Barista — `handlers/barista.js`

Pesanan baru otomatis masuk ke barista (DM atau grup). Tombol di bawah pesan:

```js
// notifier mengirim:
//   🆕 Pesanan KMZ-...-0031 · Dine-in · Meja 4
//   2× Latte (Iced), 1× Croissant
//   [▶️ Proses]  
bot.callbackQuery(/^ord:(prep|ready):(\d+)$/, requireRole("BARISTA", "MANAGER"), async (ctx) => {
  const [, action, id] = ctx.match;
  const status = action === "prep" ? "PREPARING" : "READY";

  const res = await orderService.setStatus(Number(id), status, ctx.user.id);
  if (!res.ok) return ctx.answerCallbackQuery({ text: res.message, show_alert: true });

  await ctx.answerCallbackQuery();
  const kb = status === "PREPARING"
    ? new InlineKeyboard().text("✅ Siap", `ord:ready:${id}`)
    : undefined;
  await ctx.editMessageReplyMarkup({ reply_markup: kb });

  if (status === "READY") {
    await notifier.toUser(res.order.cashierId, `☕ Pesanan ${res.order.invoiceNo} sudah siap (meja ${res.order.tableNo ?? "-"}).`);
  }
});
```

Perintah `/antrean` menampilkan seluruh pesanan berstatus `OPEN`/`PREPARING` yang belum selesai.

> Karena `ctx.chat.type` pada grup bukan `private`, `ctx.user` bernilai `null` di grup. Untuk tombol di grup barista, tentukan identitas lewat `ctx.from.id` (cocokkan ke `User.telegramId`) di dalam handler tersebut, atau gunakan DM barista.

### 9.2 Kasir — `handlers/cashier.js`
- `/buka_shift`, `/tutup_shift`, `/order`, `/checkin` → masuk ke conversation terkait.
- `/pesanan` → daftar open bill dengan tombol **Bayar** / **Tambah item** / **Ajukan Void**.
- `/workspace` → daftar area dengan status 🟢 tersedia / 🔴 terisi (sisa waktu) / 🟡 segera habis, dan tombol **Check-out** per sesi aktif.
- `/checkout` → pilih sesi aktif → bot menghitung durasi & tarif (termasuk overtime) → tombol **Gabung ke pesanan F&B** atau **Bayar sendiri**.

### 9.3 Manager — `handlers/manager.js`
- `/approval` → daftar permintaan `PENDING` dengan tombol Setujui/Tolak.
- `/stok` → daftar bahan, urut dari stok paling tipis; ikon ⚠️ bila di bawah minimum.
- `/stok_masuk` → conversation `stockIn`.
- `/habis` → daftar menu dengan tombol *toggle* "habis/tersedia".
- `/laporan` → ringkasan hari ini (omzet, jumlah transaksi, metode bayar, top 5 produk).

### 9.4 Owner — `handlers/owner.js`
- `/ringkasan` → omzet hari ini vs kemarin, jumlah transaksi, okupansi workspace.
- `/laporan` → pilih periode (hari ini, kemarin, 7 hari, bulan ini) via tombol.
- `/tautkan` → pilih staf → bot membuat kode tautan 8 karakter berlaku 10 menit.

```js
bot.command("tautkan", requireRole("OWNER"), async (ctx) => {
  const staff = await userService.listUnlinked();          // staf aktif tanpa telegramId
  const kb = new InlineKeyboard();
  staff.forEach((u) => kb.text(`${u.name} (${u.role})`, `link:${u.id}`).row());
  await ctx.reply("Tautkan akun staf:", { reply_markup: kb });
});

bot.callbackQuery(/^link:(\d+)$/, requireRole("OWNER"), async (ctx) => {
  const code = await telegramLinkService.generate(Number(ctx.match[1]));   // crypto.randomBytes
  await ctx.answerCallbackQuery();
  await ctx.reply(`Kode: <code>${code}</code>\nBerlaku ${process.env.BOT_LINK_CODE_TTL_MIN} menit. Minta staf mengirim:\n<code>/start ${code}</code>`, { parse_mode: "HTML" });
});
```

---

## 10. Notifikasi Otomatis

### 10.1 Event → Penerima

| Event | Pemicu | Penerima | Isi |
|---|---|---|---|
| `order.created` | Pesanan baru (web/bot) | Barista (DM/grup) | Daftar item + tombol Proses |
| `order.ready` | Barista menekan Siap | Kasir pembuat pesanan | "Pesanan siap" |
| `order.voided` | Void disetujui | Owner (jika ≥ `bot.void_alert_min`) | Detail & alasan |
| `approval.requested` | Kasir mengajukan | Manager + Owner | Kartu persetujuan |
| `stock.low` | Stok ≤ minimum | Manager + Owner | Nama bahan, sisa, minimum |
| `workspace.expiring` | Sisa waktu ≤ 10 menit | Kasir yang bertugas | Area, nama pelanggan |
| `shift.closed` | Shift ditutup | Manager + Owner | Ringkasan & selisih kas |
| `report.daily` | Cron 22:00 WIB | Owner | Laporan harian |

### 10.2 Events — `bot/events.js`

```js
import { EventEmitter } from "node:events";
export const events = new EventEmitter();
```

Service memancarkan event **setelah** transaksi database berhasil:

```js
// services/order.service.js
events.emit("order.created", order);
```

### 10.3 Notifier — `bot/notifier.js`

```js
import { bot } from "./index.js";
import { prisma } from "../config/prisma.js";
import { events } from "./events.js";
import { buildOrderCard } from "./keyboards/index.js";

async function safeSend(chatId, text, extra) {
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", ...extra });
  } catch (err) {
    // 403 = bot diblokir user → kosongkan tautan agar tidak error berulang
    if (err.error_code === 403) {
      await prisma.user.updateMany({ where: { telegramId: String(chatId) }, data: { telegramId: null } });
    } else {
      console.error("[notifier]", chatId, err.description ?? err.message);
    }
  }
}

export const notifier = {
  async toUser(userId, text, extra) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (u?.telegramId) await safeSend(u.telegramId, text, extra);
  },
  async toRoles(roles, text, extra) {
    const users = await prisma.user.findMany({
      where: { role: { in: roles }, isActive: true, telegramId: { not: null } },
    });
    await Promise.all(users.map((u) => safeSend(u.telegramId, text, extra)));
  },
};

// Subscriber
events.on("order.created", async (order) => {
  const { text, keyboard } = buildOrderCard(order);
  const groupId = await getSetting("bot.barista_chat_id");
  if (groupId) await safeSend(groupId, text, { reply_markup: keyboard });
  else await notifier.toRoles(["BARISTA"], text, { reply_markup: keyboard });
});
// ...subscriber lain: stock.low, approval.requested, shift.closed, dst.
```

### 10.4 Jadwal — `bot/jobs.js`

```js
import cron from "node-cron";

export function startJobs() {
  // Laporan harian ke Owner — 22:00 WIB
  cron.schedule("0 22 * * *", sendDailyReport, { timezone: "Asia/Jakarta" });

  // Stok menipis — tiap jam pada jam operasional
  cron.schedule("0 8-22 * * *", checkLowStock, { timezone: "Asia/Jakarta" });

  // Workspace hampir habis — tiap menit
  cron.schedule("* * * * *", checkExpiringSessions, { timezone: "Asia/Jakarta" });

  // Approval kedaluwarsa — tiap 5 menit
  cron.schedule("*/5 * * * *", expireApprovals, { timezone: "Asia/Jakarta" });
}
```

Cegah notifikasi ganda: simpan penanda (mis. kolom `lowStockNotifiedAt` atau cache in-memory per bahan) dan hanya kirim ulang bila status berubah.

---

## 11. Integrasi ke Server Express

```js
// backend/src/server.js
import "dotenv/config";
import app from "./app.js";
import { bot } from "./bot/index.js";
import "./bot/notifier.js";
import { startJobs } from "./bot/jobs.js";

const port = process.env.PORT || 4000;

app.listen(port, async () => {
  console.log(`API berjalan di :${port}`);

  if (process.env.NODE_ENV === "production") {
    await bot.init();
    await bot.api.setWebhook(process.env.TELEGRAM_WEBHOOK_URL, {
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
  } else {
    await bot.api.deleteWebhook();
    bot.start({ onStart: (me) => console.log(`Bot @${me.username} aktif (polling)`) });
  }

  startJobs();
});
```

```js
// backend/src/app.js  (tambahkan route webhook)
import { webhookCallback } from "grammy";
import { bot } from "./bot/index.js";

if (process.env.NODE_ENV === "production") {
  app.post(
    `/telegram/${process.env.TELEGRAM_WEBHOOK_PATH}`,
    webhookCallback(bot, "express", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET }),
  );
}
```

> Pasang route webhook **sebelum** middleware yang memodifikasi body secara agresif, dan jangan kenakan rate limit Express pada path ini (Telegram mengirim dari IP tertentu).

---

## 12. Utilitas

```js
// bot/utils/format.js
export const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n));

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const fmtTime = (d) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(d);
```

Gunakan `parse_mode: "HTML"` dan **selalu** `esc()` untuk teks dari pengguna (nama pelanggan, catatan) agar tidak merusak format atau menyisipkan markup.

Penanganan error global:

```js
// bot/middlewares/error.js
import { GrammyError, HttpError } from "grammy";

export async function errorHandler(err) {
  const ctx = err.ctx;
  const e = err.error;
  if (e instanceof GrammyError) console.error("Telegram API error:", e.description);
  else if (e instanceof HttpError) console.error("Gagal menghubungi Telegram:", e);
  else console.error("Error handler:", e);

  try {
    await ctx.reply("Terjadi kesalahan. Silakan coba lagi atau gunakan aplikasi web.");
  } catch { /* abaikan */ }
}
```

---

## 13. Keamanan

| Risiko | Mitigasi |
|---|---|
| Orang asing memakai bot | Semua command (kecuali `/start`) butuh `ctx.user`; penautikan hanya lewat kode sekali pakai berumur 10 menit |
| Kode tautan ditebak | 8 karakter dari `crypto.randomBytes`, sekali pakai, ada batas percobaan per Telegram ID |
| Webhook dipalsukan | `secret_token` diverifikasi grammY; path webhook dirahasiakan; hanya HTTPS |
| Eskalasi hak akses | Role dibaca dari database pada **setiap** update, bukan dari cache lama |
| Staf berhenti kerja | Menonaktifkan `User` di web otomatis memutus akses bot; opsi kosongkan `telegramId` |
| Data sensitif bocor di grup | Grup barista hanya menerima info pesanan (tanpa nominal pembayaran atau data pelanggan) |
| Spam/flood | `@grammyjs/ratelimiter` + `sequentialize` |
| Aksi sensitif tak terlacak | Void, diskon, approval, tutup shift, tautan akun → tulis ke `AuditLog` dengan `source: "telegram"` |
| Tombol lama ditekan ulang | Handler selalu memeriksa status terkini di database (idempoten) |
| Injeksi markup | `esc()` untuk semua input pengguna pada pesan HTML |
| Token bocor | Simpan di `.env`/secret manager, rotasi via BotFather `/revoke` |

---

## 14. Pengujian

**Unit**
- `rupiah`, `esc`, parser angka.
- `approvalService.decide` (hanya keputusan pertama yang sah).
- `orderService.preview` (pajak, service, diskon) — dipakai bersama web dan bot.

**Manual / UAT** (gunakan bot terpisah untuk staging, mis. `komazi_pos_dev_bot`)

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Pengguna belum tertaut mengirim `/order` | Ditolak dengan petunjuk tautan |
| 2 | Tautkan akun dengan kode valid | Role & menu sesuai; kode tidak bisa dipakai lagi |
| 3 | Tautkan dengan kode kedaluwarsa | Ditolak |
| 4 | Kasir membuat pesanan lewat bot | Pesanan muncul di web; barista menerima notifikasi |
| 5 | Barista menekan Proses → Siap | Status berubah, kasir menerima notifikasi |
| 6 | Kasir mengajukan void | Manager & Owner menerima kartu; keputusan pertama berlaku |
| 7 | Barista mencoba `/stok_masuk` | Ditolak (tidak berwenang) |
| 8 | `/batal` di tengah conversation | Proses berhenti bersih |
| 9 | Server restart saat percakapan berjalan | Pengguna diminta mengulang dengan jelas (lihat §16) |
| 10 | Stok melewati batas minimum | Manager & Owner dinotifikasi sekali |
| 11 | Pengguna memblokir bot | Tidak ada error beruntun; tautan dibersihkan |
| 12 | Laporan harian pukul 22:00 WIB | Terkirim ke Owner dengan angka sama seperti dashboard web |

**Kriteria penerimaan:** angka di bot = angka di web untuk periode yang sama; pesanan dari bot dan web memakai satu aturan perhitungan; tidak ada aksi sensitif tanpa jejak di `AuditLog`.

---

## 15. Deployment

1. Pastikan backend dapat diakses lewat **HTTPS** publik (Nginx + sertifikat Let's Encrypt).
2. Isi `.env` production, jalankan `npx prisma migrate deploy`.
3. Jalankan dengan PM2: `pm2 start src/server.js --name komazi-api`. Saat start, aplikasi memanggil `setWebhook` otomatis.
4. Verifikasi dengan `getWebhookInfo`:
   ```
   https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
   Pastikan `url` benar dan `last_error_message` kosong.
5. Gunakan **satu instance** backend untuk bot. Jika kelak di-*scale* ke beberapa instance, state conversation harus dipindah ke penyimpanan bersama.
6. Pisahkan bot **staging** dan **production** (dua token berbeda).

---

## 16. Keterbatasan & Catatan

- **State conversation** secara default disimpan di memori proses. Jika server restart, percakapan yang sedang berjalan hilang; pengguna cukup memulai ulang perintah. Untuk produksi skala lebih besar, gunakan penyimpanan persisten (mis. Redis) sesuai dokumentasi plugin conversations.
- Bot adalah **pelengkap**. Untuk jam ramai dengan banyak item, antarmuka web tetap lebih cepat.
- Telegram membatasi pengiriman pesan (sekitar 30 pesan/detik global, 1 pesan/detik per chat). `autoRetry` menangani lonjakan, tetapi hindari menyiarkan notifikasi besar sekaligus.
- Tombol inline pada pesan lama tetap bisa ditekan; itulah mengapa setiap handler memvalidasi status terbaru.

---

## 17. Rencana Implementasi

| Tahap | Pekerjaan | Estimasi |
|---|---|---|
| **B0** | Buat bot di BotFather, env, migrasi Prisma (telegramId, link code, approval, enum baru) | 0,5 hari |
| **B1** | Fondasi: `bot/index.js`, auth, role guard, error handler, integrasi Express (polling + webhook) | 1 hari |
| **B2** | Penautikan akun (`/start KODE`, `/tautkan`), command & menu per role | 1 hari |
| **B3** | Kasir: buka/tutup shift, pesanan cepat, open bill | 2 hari |
| **B4** | Barista: notifikasi pesanan + status Proses/Siap | 1 hari |
| **B5** | Workspace: status area, check-in/out | 1 hari |
| **B6** | Manager/Owner: approval, stok, menu habis, ringkasan & laporan | 2 hari |
| **B7** | Notifikasi otomatis & cron (stok, workspace, laporan harian) | 1 hari |
| **B8** | Audit log, rate limit, pengujian UAT, deploy webhook | 1–2 hari |

**Urutan prioritas MVP bot:** B0 → B1 → B2 → B4 → B3 → B6 (approval & ringkasan) → B7 → B5 → B8.

### Checklist Definisi Selesai
- [ ] Akun staf dapat ditautkan dan diputus
- [ ] Setiap role hanya melihat command miliknya
- [ ] Pesanan dari bot muncul di web dan sebaliknya
- [ ] Barista menerima & memperbarui status pesanan dari Telegram
- [ ] Alur approval void/diskon berjalan end-to-end
- [ ] Notifikasi stok, workspace, dan laporan harian terkirim tepat waktu
- [ ] Semua aksi sensitif tercatat di `AuditLog`
- [ ] Webhook production tervalidasi (`getWebhookInfo` tanpa error)
- [ ] Token & secret tidak ada di repositori

---

## 18. Pertanyaan Terbuka
1. Apakah barista akan memakai **grup Telegram bersama** atau DM masing-masing? (Menentukan setting `bot.barista_chat_id`.)
2. Apakah role **Barista** masuk MVP, atau tetap fase 2 seperti di `prd.md`? (Dokumen ini mengasumsikan masuk.)
3. Batas nominal void/diskon yang wajib persetujuan Manager?
4. Apakah kasir boleh menerima pembayaran QRIS/transfer langsung dari bot, atau hanya mencatat setelah memeriksa mutasi secara manual?
5. Jam laporan harian dan penerima tambahan selain Owner?
6. Apakah perlu bahasa lain selain Indonesia?

---

## 19. Referensi
- Dokumentasi grammY: https://grammy.dev
- Plugin conversations (v2): https://grammy.dev/plugins/conversations
- Telegram Bot API: https://core.telegram.org/bots/api
- Dokumen proyek: `prd.md`