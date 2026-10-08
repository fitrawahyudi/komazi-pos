# Implementation Guide — POS Web + Android Capacitor

## 1. Tujuan

Membangun POS F&B dengan **satu codebase React/Vite** yang dapat berjalan sebagai:

1. Web App — browser desktop/laptop/tablet
2. Android APK — React/Vite dibungkus Capacitor
3. Backend API — Node.js + Express
4. Database — MySQL
5. Realtime — Socket.IO
6. Thermal printer — Bluetooth/ESC-POS melalui native Android/Capacitor
7. Payment — QRIS/Pakasir melalui backend
8. AI — melalui backend
9. Telegram Bot — melalui backend

Prinsip utama:

> Semua business logic harus berada di backend/API atau shared frontend service. Fitur native Android harus memiliki fallback web atau graceful degradation.

---

# 2. Arsitektur Utama

```text
                         ┌──────────────────────┐
                         │       React/Vite     │
                         │   Shared POS UI      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Browser Web                      Capacitor
                    │                               │
                    │                         Android APK
                    │                               │
                    │                     ┌─────────┴─────────┐
                    │                     │ Native Capacitor  │
                    │                     │ Bluetooth/Printer │
                    │                     │ Camera/Files/etc. │
                    │                     └─────────┬─────────┘
                    │                               │
                    └──────────────┬────────────────┘
                                   │ HTTPS
                                   ▼
                         ┌──────────────────────┐
                         │ Node.js + Express    │
                         │ REST API + Socket.IO │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
                 MySQL          Pakasir            AI API
                    │               │                │
                    │               │                │
                    ▼               ▼                ▼
               POS Data          QRIS             AI Features

                         ┌──────────────────────┐
                         │ Telegram Bot         │
                         │ Notification/Report  │
                         └──────────────────────┘
```

---

# 3. Aturan Penting: Web dan APK Harus Berbagi Codebase

Jangan membuat:

```text
web/
android/
```

dengan dua aplikasi berbeda.

Gunakan:

```text
pos/
├── src/
├── public/
├── capacitor.config.ts
├── package.json
└── android/
```

React/Vite adalah UI utama.

Capacitor hanya menjadi bridge untuk fitur native.

```text
React Component
      ↓
Service/Adapter
      ↓
Platform detection
      ↓
Web implementation / Native implementation
```

Contoh:

```javascript
PrinterService.print(receipt)
```

Bukan:

```javascript
if (android) {
   // seluruh logic printer
}

if (web) {
   // seluruh logic printer
}
```

Business logic tetap sama. Yang berbeda hanya implementasi platform.

---

# 4. Struktur Frontend

Gunakan struktur:

```text
src/
├── assets/
├── components/
│   ├── ui/
│   ├── pos/
│   ├── kds/
│   ├── bds/
│   ├── inventory/
│   └── reports/
│
├── pages/
│   ├── Login/
│   ├── Dashboard/
│   ├── POS/
│   ├── Orders/
│   ├── KDS/
│   ├── BDS/
│   ├── Products/
│   ├── Inventory/
│   ├── Customers/
│   ├── Reports/
│   ├── Settings/
│   └── Admin/
│
├── services/
│   ├── api.js
│   ├── auth.service.js
│   ├── order.service.js
│   ├── payment.service.js
│   ├── printer.service.js
│   ├── bluetooth.service.js
│   ├── camera.service.js
│   ├── notification.service.js
│   ├── telegram.service.js
│   └── ai.service.js
│
├── adapters/
│   ├── printer/
│   │   ├── printer.web.js
│   │   └── printer.android.js
│   ├── bluetooth/
│   │   ├── bluetooth.web.js
│   │   └── bluetooth.android.js
│   └── notification/
│       ├── notification.web.js
│       └── notification.android.js
│
├── hooks/
├── contexts/
├── utils/
├── constants/
├── routes/
├── App.jsx
└── main.jsx
```

---

# 5. Environment Variables

Frontend:

```env
VITE_API_URL=https://your-backend.up.railway.app
```

Backend:

```env
PORT=3000

DATABASE_URL=mysql://...

JWT_SECRET=...

PAKASIR_API_KEY=...
PAKASIR_SLUG=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...

AI_API_KEY=...
```

Jangan pernah memasukkan secret:

```text
PAKASIR_API_KEY
TELEGRAM_BOT_TOKEN
AI_API_KEY
DATABASE_PASSWORD
JWT_SECRET
```

ke dalam:

```text
VITE_*
```

Karena variable `VITE_*` dapat masuk ke bundle frontend.

---

# 6. API URL Web dan APK

Web:

```text
https://pos-domain.com
       ↓
https://api-pos.up.railway.app
```

Android:

```text
POS APK
   ↓
https://api-pos.up.railway.app
```

Jangan menggunakan:

```text
http://localhost:3000
```

di APK.

`localhost` pada Android berarti perangkat Android itu sendiri.

---

# 7. Capacitor Setup

Install:

```bash
npm install @capacitor/core @capacitor/cli
```

Initialize:

```bash
npx cap init
```

Install Android:

```bash
npm install @capacitor/android
npx cap add android
```

Build:

```bash
npm run build
```

Sync:

```bash
npx cap sync android
```

Open Android Studio:

```bash
npx cap open android
```

Development workflow:

```bash
npm run build
npx cap sync android
npx cap open android
```

---

# 8. Capacitor Configuration

Contoh:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.namausaha.pos',
  appName: 'POS F&B',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

Gunakan app ID yang stabil sejak awal.

Contoh:

```text
com.firma.pos
```

Jangan sering mengubahnya setelah APK digunakan.

---

# 9. Platform Detection

Buat:

```javascript
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export const isAndroid = platform === 'android';
export const isWeb = platform === 'web';
```

Kemudian:

```javascript
if (isAndroid) {
   // fitur native
}
```

Namun lebih baik menggunakan service adapter.

---

# 10. Service Adapter

Contoh:

```javascript
export const PrinterService = {
  async connect(device) {
    if (isAndroid) {
      return AndroidPrinter.connect(device);
    }

    return WebPrinter.connect(device);
  },

  async print(receipt) {
    if (isAndroid) {
      return AndroidPrinter.print(receipt);
    }

    return WebPrinter.print(receipt);
  }
};
```

Dengan cara ini halaman POS tidak perlu mengetahui detail Bluetooth.

---

# 11. Thermal Printer

Target:

```text
React
 ↓
Capacitor
 ↓
Native Android Bluetooth
 ↓
Bluetooth Classic / BLE
 ↓
iWare RPP06N
 ↓
ESC/POS
```

Untuk printer thermal Bluetooth, jangan menjadikan Web Bluetooth sebagai fondasi utama POS produksi.

Implementasi native harus mendukung:

```text
scan/list paired device
connect
disconnect
print
feed
cut jika printer mendukung
cash drawer jika hardware mendukung
```

API internal yang disarankan:

```javascript
PrinterService.getDevices()

PrinterService.connect(deviceId)

PrinterService.disconnect()

PrinterService.isConnected()

PrinterService.print(receipt)

PrinterService.testPrint()
```

---

# 12. Printer Abstraction

Gunakan format:

```javascript
const receipt = {
  storeName: 'Nama Toko',
  orderNumber: 'A-1025',
  cashier: 'Fitra',
  type: 'TAKEAWAY',
  items: [
    {
      name: 'Burger',
      qty: 2,
      price: 25000,
      subtotal: 50000
    }
  ],
  subtotal: 50000,
  discount: 0,
  tax: 5000,
  total: 55000,
  paymentMethod: 'QRIS'
};
```

Kemudian:

```javascript
PrinterService.print(receipt);
```

Receipt formatter:

```text
Receipt data
    ↓
ESC/POS formatter
    ↓
byte array
    ↓
Bluetooth
    ↓
printer
```

Jangan mengirim HTML ke printer thermal.

---

# 13. Web Printer Fallback

Karena browser tidak selalu dapat mengakses printer Bluetooth secara langsung, Web POS harus mempunyai fallback:

```text
Print
 ↓
window.print()
 ↓
Browser print dialog
```

Untuk web:

```javascript
WebPrinter.print(receipt)
```

dapat menghasilkan:

```text
receipt HTML
```

kemudian:

```javascript
window.print();
```

Jadi:

```text
Android → Bluetooth thermal printer
Web     → Browser printing
```

---

# 14. Kamera

Gunakan abstraction:

```javascript
CameraService.takePhoto()
```

Android:

```text
Capacitor Camera
      ↓
Camera
```

Web:

```text
<input type="file" accept="image/*" capture>
```

Fitur yang menggunakan kamera:

- foto produk
- upload bukti
- scan QR
- scan barcode
- profil user

Jangan membuat halaman produk bergantung langsung pada API Android.

---

# 15. Barcode Scanner

Arsitektur:

```text
Scanner
   ↓
Barcode value
   ↓
ProductService.searchByBarcode()
   ↓
Product
   ↓
Add to Cart
```

Database:

```sql
products
---------
id
sku
barcode
name
category_id
price
cost
stock
station_id
is_active
```

Index:

```sql
CREATE INDEX idx_products_barcode
ON products(barcode);
```

---

# 16. QR Scanner

QR scanner dapat digunakan untuk:

- self order
- meja
- payment reference
- product lookup
- inventory
- customer membership

Contoh:

```text
QR meja
 ↓
TABLE-12
 ↓
POS
 ↓
Order dine-in
```

---

# 17. Notification

Android dapat menggunakan native notification.

Web dapat menggunakan:

```text
Web Notification API
```

Abstraction:

```javascript
NotificationService.notify({
  title: 'Order Baru',
  body: 'Order #1025 masuk'
});
```

Android:

```text
Native notification
```

Web:

```text
Browser notification
```

Jika permission ditolak, aplikasi tetap harus berjalan.

---

# 18. KDS dan BDS

KDS:

```text
Kitchen Display System
```

BDS:

```text
Bar Display System
```

Product memiliki station:

```text
BURGER → KITCHEN
FRIES → KITCHEN
COFFEE → BAR
ICE TEA → BAR
```

Database:

```sql
stations
--------
id
name
code
type
is_active
```

Product:

```sql
station_id
```

---

# 19. Order Status

Order:

```text
PENDING_PAYMENT
PAID
IN_PROGRESS
PARTIALLY_READY
READY
SERVED
COMPLETED
CANCELLED
REFUNDED
```

Order item:

```text
PENDING
ACCEPTED
PREPARING
READY
SERVED
CANCELLED
```

Jangan hanya menggunakan satu status untuk seluruh order.

Contoh:

```text
Order #1025

Burger    READY
Fries     READY
Ice Tea   PREPARING
```

Maka order:

```text
PARTIALLY_READY
```

---

# 20. Realtime KDS/BDS

Gunakan Socket.IO.

Backend:

```javascript
io.to(`station:${stationCode}`)
  .emit('order:new', order);
```

Contoh:

```text
station:KITCHEN_MAIN
station:BAR_MAIN
```

Events:

```text
order:new
order:updated
order:item:updated
station:updated
```

Frontend:

```javascript
socket.on('order:new', handleNewOrder);
```

---

# 21. Database Tetap Source of Truth

Jangan menjadikan Socket.IO sebagai database.

Flow:

```text
Database
   ↓
Socket.IO notification
   ↓
KDS update
```

Ketika reconnect:

```text
KDS
 ↓
GET /api/kds/orders
 ↓
Database
 ↓
Current state
```

---

# 22. Offline Mode

POS harus membedakan:

```text
ONLINE
OFFLINE
RECONNECTING
```

Offline dapat digunakan untuk fitur yang aman seperti:

- melihat menu yang sudah dicache
- membuka UI POS
- membuat draft cart
- melihat data lokal
- printer lokal jika native connection masih tersedia

Namun jangan menganggap pembayaran QRIS berhasil ketika backend belum mengonfirmasi.

Offline order yang belum tersinkron:

```text
LOCAL_PENDING
```

Setelah online:

```text
LOCAL_PENDING
 ↓
SYNC
 ↓
SERVER CONFIRMED
```

---

# 23. Jangan Offline-kan Pembayaran Secara Palsu

Tidak boleh:

```text
Customer scan QR
 ↓
Internet mati
 ↓
POS menganggap PAID
```

Yang benar:

```text
PENDING_PAYMENT
 ↓
Provider payment
 ↓
Webhook
 ↓
Backend verification
 ↓
PAID
```

---

# 24. Payment QRIS

Frontend:

```text
POST /api/payments/create
```

Backend:

```text
Backend
 ↓
Pakasir
 ↓
QRIS
 ↓
Customer
```

Webhook:

```text
Pakasir
 ↓
POST /api/webhooks/pakasir
 ↓
verify
 ↓
database
```

Wajib melakukan:

- signature verification
- order/invoice verification
- amount verification
- status verification
- idempotency

Jangan percaya status pembayaran yang dikirim dari frontend.

---

# 25. Payment State Machine

Gunakan:

```text
CREATED
PENDING
PAID
FAILED
EXPIRED
CANCELLED
REFUNDED
```

Contoh:

```text
Order
  ↓
PENDING_PAYMENT
  ↓
Payment CREATED
  ↓
Payment PENDING
  ↓
Webhook
  ↓
Payment PAID
  ↓
Order PAID
  ↓
KDS/BDS
  ↓
Print
```

---

# 26. Idempotency

Webhook bisa terkirim lebih dari sekali.

Jangan:

```text
webhook 1 → PAID
webhook 2 → PAID lagi
webhook 3 → PAID lagi
```

Gunakan unique event/reference.

Contoh:

```sql
UNIQUE(provider_transaction_id)
```

Atau:

```sql
UNIQUE(idempotency_key)
```

---

# 27. Inventory

Gunakan:

```text
products
inventory
stock_movements
recipes
recipe_items
suppliers
purchases
```

Stock movement:

```text
PURCHASE
SALE
ADJUSTMENT
WASTE
RETURN
TRANSFER
```

Jangan hanya menyimpan:

```text
stock = 100
```

tanpa history.

---

# 28. Recipe / BOM

Untuk F&B profesional:

```text
Burger
 ├── Bun 1 pcs
 ├── Patty 1 pcs
 ├── Cheese 1 slice
 └── Sauce 20 ml
```

Ketika Burger terjual:

```text
stock bun -= 1
stock patty -= 1
stock cheese -= 1
stock sauce -= 20ml
```

Ini diperlukan untuk:

- COGS
- stock forecasting
- food cost
- waste analysis
- profit

---

# 29. Transaction Order

Pembuatan order harus menggunakan database transaction.

Konsep:

```text
BEGIN

create order
create order items
validate price
validate stock
reserve/deduct stock jika flow mengharuskan
create payment

COMMIT
```

Jika error:

```text
ROLLBACK
```

Jangan membuat order setengah jadi.

---

# 30. Security

Wajib:

```text
HTTPS
JWT/session
RBAC
password hashing
input validation
SQL injection protection
rate limiting
CORS
secure headers
audit log
webhook verification
```

Role contoh:

```text
OWNER
ADMIN
MANAGER
CASHIER
KITCHEN
BAR
INVENTORY
ACCOUNTING
```

Contoh:

```text
CASHIER
✓ create order
✓ payment
✓ print receipt

✗ delete product
✗ change cost
✗ manage users
```

---

# 31. Backend Authorization

Jangan hanya menyembunyikan tombol di React.

Salah:

```text
React menyembunyikan tombol
```

tetapi API tetap dapat dipanggil.

Benar:

```text
React permission
+
Backend authorization
```

Contoh:

```text
DELETE /api/products/:id

requireAuth
requireRole('OWNER', 'ADMIN')
```

---

# 32. Audit Log

Simpan aktivitas penting:

```text
LOGIN
CREATE_ORDER
CANCEL_ORDER
REFUND
CHANGE_PRICE
CHANGE_STOCK
DELETE_PRODUCT
CHANGE_USER_ROLE
PAYMENT
PAYMENT_FAILED
```

Database:

```sql
audit_logs
----------
id
user_id
action
entity_type
entity_id
old_data
new_data
ip_address
created_at
```

---

# 33. Telegram

Telegram hanya menjadi notification/control layer.

Jangan:

```text
Telegram → langsung MySQL
```

Gunakan:

```text
Telegram
 ↓
Backend
 ↓
Service
 ↓
Database
```

Commands:

```text
/omzet
/stok
/menu_laris
/laporan
/prediksi
/profit
```

Bot harus melakukan authorization berdasarkan Telegram user/chat ID.

---

# 34. AI

AI tidak boleh mendapatkan:

```text
DATABASE_URL
DB password
JWT secret
Pakasir key
Telegram token
```

AI hanya mendapatkan data yang diperlukan.

Contoh:

```text
User
 ↓
POST /api/ai/business
 ↓
Backend
 ↓
ambil data penjualan
 ↓
sanitize/aggregate
 ↓
AI API
 ↓
response
```

Fitur:

```text
Sales forecasting
Demand prediction
Stock prediction
Menu recommendation
Peak hour analysis
Profit analysis
Waste prediction
AI business assistant
Automated report
```

---

# 35. AI Business Assistant

Contoh:

```text
User:
"menu apa yang paling laku minggu ini?"

POS
 ↓
Backend
 ↓
Sales aggregation
 ↓
AI
 ↓
Answer
```

AI tidak melakukan SQL mentah dari user.

Gunakan tool/function backend yang terkontrol:

```text
get_sales_summary()
get_top_products()
get_low_stock()
get_profit_summary()
get_peak_hours()
```

---

# 36. Dashboard

Dashboard utama:

```text
Today's Sales
Today's Orders
Average Order Value
Gross Profit
Low Stock
Pending Orders
Payment Success Rate
```

Charts:

```text
Sales by hour
Sales by day
Top products
Category sales
Payment methods
Profit
```

Jangan menghitung semua data besar di browser.

Gunakan endpoint agregasi:

```text
GET /api/reports/sales-summary
GET /api/reports/top-products
GET /api/reports/peak-hours
GET /api/reports/profit
```

---

# 37. Responsive UI

UI harus mempunyai mode:

```text
Desktop
Tablet
Mobile
Android POS
KDS
BDS
```

Contoh:

```text
Desktop POS
┌───────────────┬─────────────────┐
│ Categories    │ Cart            │
│ Products      │ Order Summary   │
└───────────────┴─────────────────┘
```

Mobile:

```text
Products
   ↓
Cart
   ↓
Checkout
```

KDS/BDS:

```text
┌─────────┐ ┌─────────┐
│ #1025   │ │ #1026   │
│ Burger  │ │ Chicken │
│ Fries   │ │ Rice    │
│         │ │         │
│ READY   │ │ COOKING │
└─────────┘ └─────────┘
```

---

# 38. Touch Friendly

Android POS harus menggunakan:

```css
min-height: 44px;
```

untuk tombol utama.

Jangan membuat tombol terlalu kecil.

Gunakan:

```text
large touch target
large quantity controls
clear status
minimal typing
```

---

# 39. Hardware Capability Layer

Buat capability check:

```javascript
const capabilities = {
  bluetooth: false,
  printer: false,
  camera: false,
  notifications: false,
  barcodeScanner: false
};
```

Saat aplikasi start:

```text
detect platform
 ↓
detect plugin
 ↓
detect permission
 ↓
detect device
 ↓
update capabilities
```

Contoh UI:

```text
Printer
● Connected

Bluetooth
● Enabled

Camera
● Available
```

Jika printer tidak tersedia:

```text
Printer tidak terhubung
[Hubungkan Printer]
[Cetak via Browser]
```

---

# 40. Graceful Degradation

Setiap fitur native harus mempunyai fallback.

| Fitur | Android | Web |
|---|---|---|
| POS | ✓ | ✓ |
| KDS | ✓ | ✓ |
| BDS | ✓ | ✓ |
| QRIS | ✓ | ✓ |
| AI | ✓ | ✓ |
| Telegram | Backend | Backend |
| Camera | Native | Browser |
| Bluetooth printer | Native | Browser print |
| Notification | Native | Web notification |
| File upload | Native/browser | Browser |
| Barcode | Native/plugin | Camera/input |
| Offline cache | Capacitor/browser | PWA/browser |

---

# 41. PWA

Selain Capacitor, jadikan React app sebagai PWA.

Tujuan:

```text
Browser
 ↓
Install Web App
```

Keuntungan:

- app-like experience
- caching
- offline UI
- installable
- faster loading

Namun PWA tidak menggantikan native Bluetooth thermal printing.

---

# 42. Local Storage

Gunakan local storage hanya untuk data ringan:

```text
theme
device settings
printer preference
selected branch
UI preferences
```

Jangan menyimpan:

```text
database password
API secret
payment secret
Telegram token
```

Untuk data lokal POS yang lebih kompleks gunakan IndexedDB/SQLite sesuai kebutuhan.

---

# 43. Secure Token Storage

Untuk Android production, jangan menyimpan credential sensitif sembarangan di:

```text
localStorage
```

Gunakan secure native storage/keychain-compatible approach untuk credential yang memang perlu disimpan.

Access token harus memiliki expiry dan refresh strategy yang aman.

---

# 44. Authentication

Flow:

```text
Login
 ↓
POST /api/auth/login
 ↓
Backend
 ↓
verify password
 ↓
issue session/token
 ↓
React
```

Logout:

```text
clear local auth state
invalidate session/refresh token
```

Gunakan timeout/session policy untuk kasir.

---

# 45. Multi Device

Contoh:

```text
Kasir Android
      ↓
Backend
      ↓
KDS Tablet
      ↓
Bar Tablet
      ↓
Dashboard Laptop
```

Semua melihat database yang sama.

Realtime:

```text
Order baru
 ↓
Backend
 ├── KDS event
 ├── BDS event
 ├── Dashboard event
 └── Telegram notification
```

---

# 46. Printer Assignment

Setiap device dapat memiliki printer default:

```text
device_settings
---------------
device_id
printer_id
station_id
```

Contoh:

```text
Kasir 1
 ↓
Printer Counter

Kitchen Tablet
 ↓
Kitchen Printer

Bar Tablet
 ↓
Bar Printer
```

---

# 47. Kitchen/Bar Printing

Selain receipt, dapat mencetak kitchen ticket:

```text
ORDER #1025

TABLE 12

2x Burger
1x Fries

NOTE:
No spicy
```

Routing:

```text
Burger → Kitchen printer
Fries → Kitchen printer
Coffee → Bar printer
```

---

# 48. Order Routing

Backend menentukan station.

Contoh:

```javascript
function routeOrderItem(item) {
  return item.product.station_id;
}
```

Jangan percaya station dari frontend.

Frontend hanya mengirim:

```text
product_id
qty
modifier
note
```

Backend mengambil station dari database.

---

# 49. Modifier

Produk dapat memiliki modifier:

```text
Burger
 ├── Extra cheese
 ├── No onion
 ├── Spicy
 └── Extra sauce
```

Database:

```text
modifier_groups
modifiers
product_modifier_groups
order_item_modifiers
```

Modifier juga dapat memengaruhi:

```text
price
recipe
station
```

---

# 50. Discount

Discount harus dihitung backend.

Frontend:

```text
"diskon 20%"
```

tidak boleh menjadi sumber kebenaran.

Backend:

```text
validate promo
validate date
validate usage limit
calculate discount
save result
```

---

# 51. Refund

Refund membutuhkan:

```text
permission
reason
amount
payment reference
audit log
```

Status:

```text
PAID
 ↓
REFUND_REQUESTED
 ↓
REFUNDED
```

Jangan menghapus order yang sudah dibayar.

---

# 52. Customer/Loyalty

Optional:

```text
customers
loyalty_transactions
points
```

Flow:

```text
Order
 ↓
Customer
 ↓
Earn points
```

Gunakan ledger untuk point transaction, bukan hanya mengubah angka saldo tanpa history.

---

# 53. Table Management

Dine-in:

```text
TABLE 01
TABLE 02
TABLE 03
...
```

Status:

```text
AVAILABLE
OCCUPIED
WAITING_PAYMENT
CLEANING
RESERVED
```

QR meja:

```text
https://pos-domain.com/order/table/12
```

QR harus menggunakan token/random ID, bukan ID database mentah jika memungkinkan.

---

# 54. Self Order

Flow:

```text
Customer scan QR
 ↓
Digital Menu
 ↓
Select items
 ↓
Create order
 ↓
Payment
 ↓
Webhook
 ↓
KDS/BDS
```

Customer tidak mendapatkan akses admin.

Gunakan public order session yang dibatasi.

---

# 55. API Structure

```text
/api/auth
/api/users
/api/products
/api/categories
/api/orders
/api/order-items
/api/payments
/api/webhooks
/api/kds
/api/bds
/api/inventory
/api/recipes
/api/suppliers
/api/customers
/api/reports
/api/telegram
/api/ai
/api/settings
/api/audit
```

---

# 56. Contoh Order API

Create:

```http
POST /api/orders
```

Body:

```json
{
  "type": "DINE_IN",
  "tableId": 12,
  "items": [
    {
      "productId": 1,
      "qty": 2,
      "modifiers": [],
      "note": "No onion"
    }
  ]
}
```

Backend:

```text
validate
 ↓
calculate
 ↓
transaction
 ↓
save
 ↓
return order
```

---

# 57. KDS API

```http
GET /api/kds/orders
GET /api/kds/orders/:id
PATCH /api/kds/items/:id/status
```

BDS:

```http
GET /api/bds/orders
PATCH /api/bds/items/:id/status
```

Authorization:

```text
KITCHEN → KDS
BAR → BDS
MANAGER → both
OWNER → both
```

---

# 58. Realtime Security

Socket.IO connection harus authenticated.

Contoh:

```text
socket connect
 ↓
verify auth
 ↓
identify user
 ↓
join authorized station
```

Jangan izinkan user mengirim:

```text
join station:OWNER
```

sesuka hati.

Backend harus menentukan station yang boleh diakses.

---

# 59. Server Timestamp

Gunakan server timestamp:

```text
created_at
accepted_at
preparing_at
ready_at
served_at
completed_at
```

Timer KDS:

```text
serverNow - created_at
```

bukan hanya:

```javascript
setInterval(...)
```

karena timer frontend dapat reset ketika reload.

---

# 60. Delay Warning

Contoh:

```text
0–10 min
Normal

10–15 min
Warning

>15 min
Delayed
```

Batas waktu harus configurable per station/product.

Delay warning bukan status utama.

---

# 61. Backup

Backup MySQL secara rutin.

Minimal:

```text
daily backup
weekly retention
```

Simpan backup di lokasi terpisah dari database utama.

Test restore secara berkala.

Backup yang tidak pernah diuji restore belum bisa dianggap aman.

---

# 62. Logging

Backend log:

```text
request
error
payment
webhook
authentication
printer-related frontend events jika dikirim
AI errors
Telegram errors
```

Jangan log:

```text
password
API keys
payment secret
JWT secret
full card/payment credentials
```

---

# 63. Error Handling

Frontend harus memiliki:

```text
Loading
Empty
Error
Offline
Retry
Success
```

Contoh:

```text
Tidak dapat terhubung ke server.

[ Coba Lagi ]
```

Jangan hanya:

```javascript
console.log(error);
```

---

# 64. API Error Format

Gunakan format konsisten:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order tidak ditemukan"
  }
}
```

Frontend dapat memproses berdasarkan:

```text
error.code
```

bukan berdasarkan teks message.

---

# 65. Deployment

## Frontend

```text
React/Vite
 ↓
GitHub
 ↓
Vercel
```

Environment:

```text
VITE_API_URL
```

## Backend

```text
Node.js/Express
 ↓
GitHub
 ↓
Railway
```

## Database

```text
MySQL
 ↓
Railway
```

---

# 66. Android Build

Development:

```bash
npm run build
npx cap sync android
npx cap open android
```

Release:

```text
React build
 ↓
Capacitor sync
 ↓
Android Studio
 ↓
signed APK/AAB
```

Untuk Play Store gunakan AAB.

Untuk instalasi manual/internal gunakan APK.

---

# 67. Android Permissions

Permission harus mengikuti kebutuhan plugin dan versi Android.

Kemungkinan kebutuhan:

```text
Bluetooth
Camera
Notifications
Storage/media
```

Untuk Android modern, Bluetooth permissions dapat mencakup:

```text
BLUETOOTH_SCAN
BLUETOOTH_CONNECT
```

Jangan meminta permission yang tidak diperlukan.

Jelaskan kepada user kenapa permission dibutuhkan.

---

# 68. Printer Permission Flow

Contoh:

```text
Open Settings
 ↓
Printer
 ↓
Scan/Paired Devices
 ↓
Select iWare RPP06N
 ↓
Connect
 ↓
Test Print
 ↓
Save as default
```

Jangan meminta user memasukkan MAC address setiap kali.

Simpan device identifier yang aman.

---

# 69. Printer Connection Recovery

Jika printer disconnect:

```text
print
 ↓
connection failed
 ↓
retry
 ↓
reconnect
 ↓
print
```

Jika gagal:

```text
Printer tidak tersedia.

[Reconnect]
[Try Another Printer]
[Print via Browser]
```

Jangan membuat order gagal hanya karena printer offline.

Order sudah tersimpan di backend.

---

# 70. Print Queue

Gunakan queue:

```text
print_queue
-----------
id
order_id
printer_id
payload
status
attempts
last_error
created_at
```

Status:

```text
PENDING
PRINTING
PRINTED
FAILED
```

Keuntungan:

```text
Order sukses
 ↓
Print queue
 ↓
Printer
```

Printer error tidak merusak transaksi.

---

# 71. Double Print Protection

Jangan mencetak dua kali karena user menekan tombol dua kali.

Gunakan:

```text
print_job_id
```

dan status:

```text
PENDING
PRINTED
```

Jika sudah:

```text
PRINTED
```

tampilkan:

```text
Cetak ulang?
```

bukan otomatis print lagi.

---

# 72. Payment + Print + KDS

Flow production:

```text
Customer checkout
       ↓
Create order
       ↓
PENDING_PAYMENT
       ↓
Create QRIS
       ↓
Customer pays
       ↓
Provider webhook
       ↓
Verify payment
       ↓
DB = PAID
       ↓
Transaction commit
       ↓
Socket.IO
   ┌───┴────┐
   ▼        ▼
  KDS      BDS
       ↓
Print receipt
```

Print dan KDS tidak boleh menjadi syarat utama agar payment dianggap berhasil.

---

# 73. Important Rule

Urutan:

```text
Payment verification
       ↓
Database state
       ↓
Realtime notification
       ↓
Printer
```

Bukan:

```text
Printer berhasil
       ↓
anggap payment berhasil
```

---

# 74. Testing Matrix

Setiap fitur harus dites pada:

```text
Chrome Desktop
Android Chrome
Android APK
Tablet
Slow network
Offline
Reconnect
Printer connected
Printer disconnected
Payment pending
Payment success
Payment timeout
Webhook duplicate
```

---

# 75. Test KDS

Test:

```text
Order baru
Item kitchen
Item bar
Mixed order
Cancel item
Ready item
Partial ready
All ready
Reconnect
Refresh
Two KDS devices
```

Acceptance:

```text
Tidak ada order hilang.
Tidak ada duplicate ticket.
Status konsisten dengan database.
```

---

# 76. Test Payment

Test:

```text
payment created
payment pending
payment success
payment failed
payment expired
duplicate webhook
wrong amount
wrong invoice
invalid signature
```

Acceptance:

```text
Tidak ada pembayaran yang dianggap PAID tanpa verification.
```

---

# 77. Test Printer

Test:

```text
connected
disconnected
reconnect
empty receipt
long product name
many items
discount
tax
QRIS
special characters
large order
duplicate print
```

---

# 78. Test Offline

Simulasi:

```text
Internet ON
 ↓
create draft
 ↓
Internet OFF
 ↓
UI tetap terbuka
 ↓
Internet ON
 ↓
sync
```

Pastikan tidak ada duplicate order saat reconnect.

---

# 79. Performance

Frontend:

```text
lazy loading
code splitting
image compression
pagination
virtualized lists jika diperlukan
memoization seperlunya
```

Backend:

```text
pagination
indexes
query optimization
connection pooling
caching
```

Database:

```text
index foreign keys
index barcode
index order status
index created_at
index payment reference
```

---

# 80. Database Index Minimal

Contoh:

```sql
CREATE INDEX idx_orders_created_at
ON orders(created_at);

CREATE INDEX idx_orders_status
ON orders(status);

CREATE INDEX idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX idx_products_barcode
ON products(barcode);

CREATE INDEX idx_stock_movements_product_id
ON stock_movements(product_id);

CREATE INDEX idx_payments_order_id
ON payments(order_id);
```

Sesuaikan index dengan query aktual.

---

# 81. Folder Backend

```text
server/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── sockets/
│   ├── jobs/
│   ├── integrations/
│   │   ├── pakasir/
│   │   ├── telegram/
│   │   └── ai/
│   ├── utils/
│   └── app.js
│
├── prisma/
│   └── schema.prisma
│
└── package.json
```

Jika memakai Sequelize/Knex/mysql2, sesuaikan struktur ORM.

---

# 82. Shared Business Rules

Harga:

```text
Backend = source of truth
```

Stock:

```text
Backend = source of truth
```

Payment:

```text
Payment provider + backend = source of truth
```

Order status:

```text
Database = source of truth
```

KDS realtime:

```text
Socket.IO = delivery mechanism
```

Printer:

```text
Device capability
```

---

# 83. Web vs APK Rule

Gunakan:

```text
Shared UI
Shared API
Shared business state
Shared validation
Shared order flow
```

Platform-specific:

```text
Bluetooth
Camera implementation
Native notifications
Filesystem
Printer
App lifecycle
```

---

# 84. Final Feature Map

```text
                    POS
                     │
        ┌────────────┼────────────┐
        │            │            │
      WEB          ANDROID      BACKEND
        │            │            │
      React       Capacitor    Express
        │            │            │
        └──────┬─────┘            │
               │                  │
               └──── HTTPS ───────┘
                                  │
             ┌────────────────────┼─────────────────┐
             │                    │                 │
            MySQL              Payment             AI
             │                    │                 │
             ├── Orders          QRIS              ML/LLM
             ├── Products
             ├── Inventory
             ├── Users
             ├── Customers
             └── Reports

             Backend
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
       KDS     BDS    Telegram
        │       │
        └── Socket.IO
```

---

# 85. Urutan Implementasi yang Disarankan

## Phase 1 — Foundation

```text
React/Vite
Express
MySQL
Authentication
RBAC
Products
Categories
Orders
```

## Phase 2 — POS

```text
Cart
Checkout
Payment
Receipt
Printer abstraction
Dashboard
```

## Phase 3 — Capacitor

```text
Capacitor
Android
Native printer
Camera
Notifications
Barcode
```

## Phase 4 — Operations

```text
Inventory
Recipe/BOM
Stock movement
KDS
BDS
Station routing
Table management
```

## Phase 5 — Realtime

```text
Socket.IO
KDS realtime
BDS realtime
Printer queue
Reconnect handling
```

## Phase 6 — Payment

```text
Pakasir
QRIS
Webhook
Verification
Idempotency
Refund flow
```

## Phase 7 — Telegram

```text
Payment notification
Low stock
Daily report
Commands
Authorization
```

## Phase 8 — AI

```text
Sales analytics
Forecast
Stock prediction
Menu recommendation
Business assistant
```

## Phase 9 — Professionalization

```text
Audit log
Backup
Monitoring
Advanced reports
Multi-device
Multi-station
Performance optimization
Security hardening
```

---

# 86. Definition of Done

Project dianggap siap production jika:

### Web

```text
✓ Login
✓ POS
✓ Payment
✓ Order
✓ Dashboard
✓ KDS
✓ BDS
✓ Inventory
✓ Reports
```

### Android

```text
✓ Login
✓ POS
✓ API HTTPS
✓ Bluetooth printer
✓ Camera
✓ Barcode
✓ Notification
✓ Reconnect
```

### Backend

```text
✓ Authentication
✓ RBAC
✓ Validation
✓ Transactions
✓ Payment webhook
✓ Socket.IO
✓ Audit log
✓ Error handling
✓ Rate limiting
```

### Database

```text
✓ Foreign keys
✓ Index
✓ Transaction
✓ Backup
✓ Migration
```

### Payment

```text
✓ Dynamic QRIS
✓ Webhook
✓ Signature verification
✓ Amount verification
✓ Idempotency
✓ Payment state machine
```

### Reliability

```text
✓ Printer failure does not lose order
✓ Network failure does not corrupt order
✓ Duplicate webhook is safe
✓ KDS reconnects correctly
✓ Refresh does not lose server state
```

---

# 87. Prinsip Arsitektur Final

Gunakan 7 prinsip:

1. **One React codebase**
2. **Backend sebagai source of truth**
3. **Database sebagai source of truth untuk state**
4. **Native feature melalui adapter/service**
5. **Web memiliki fallback**
6. **Payment selalu diverifikasi backend**
7. **Hardware failure tidak boleh menghilangkan transaksi**

Arsitektur final:

```text
                 ┌──────────────────────┐
                 │    React/Vite POS    │
                 │      One Codebase    │
                 └──────────┬───────────┘
                            │
                 ┌──────────┴───────────┐
                 │                      │
              Browser               Capacitor
                 │                      │
                 │                  Android
                 │                      │
                 │              Native Services
                 │              ├─ Printer
                 │              ├─ Bluetooth
                 │              ├─ Camera
                 │              ├─ Barcode
                 │              └─ Notification
                 │                      │
                 └──────────┬───────────┘
                            │ HTTPS
                            ▼
                  ┌────────────────────┐
                  │ Node.js / Express  │
                  │ REST + Socket.IO   │
                  └─────────┬──────────┘
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
      MySQL               Pakasir               AI
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
                       Telegram
```

**Target akhir:** web dan APK bukan dua aplikasi berbeda. Keduanya adalah dua platform dari POS yang sama, dengan backend, database, authentication, order, payment, KDS/BDS, inventory, AI, dan reporting yang sama. Perbedaan hanya berada pada fitur yang memang membutuhkan kemampuan native Android seperti Bluetooth thermal printer, kamera, scanner, notifikasi, dan filesystem.
