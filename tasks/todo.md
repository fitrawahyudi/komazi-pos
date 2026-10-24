# Task Breakdown Checklist: Komazi AI Upgrade

- [x] **Task 1: Isolasi Riwayat Chat Komazi AI per-Role (Frontend)**
  - [x] Update `aiAnalyticsStore.js` to store `messagesByRole: { OWNER: [], MANAGER: [], CASHIER: [], BARISTA: [], KITCHEN: [] }`
  - [x] Ensure switching accounts or opening modal loads role-specific conversation
  - [x] Scope `clearChat` to current active role only
  - [x] Update persistence partializer in `aiAnalyticsStore.js` with versioned key `komazi-ai-chat-history-v2`
- [x] **Task 2: Ekstensi Konteks Database Komazi AI & Sensor Data Sensitif (Backend)**
  - [x] Extend `komaziAiContextAggregator.js` and `salesAnalyticsEngine.js` to aggregate Expenses, Fixed Assets, Shift Cash Audits, CRM Loyalty Members, Recipes, Workspace
  - [x] Add recursive redaction filter (`redactSensitiveData`) for sensitive fields (passwords, hashes, supervisor PINs, tokens)
  - [x] Enforce role-based visibility rules (Owner/Manager vs Cashier/Barista/Kitchen)
- [x] **Task 3: Integrasi Eksekusi Cron Job via Chatbot AI (Backend)**
  - [x] Add scheduling & cron job intent detection in `aiPromptComposer.js` & `aiAnalyticsController.js`
  - [x] Connect `aiAnalyticsController.js` to `universalSchedulerAgent` & `jobRegistryService`
  - [x] Implement natural language cron parsing for recurring reports and reminders
  - [x] Enforce authorization (only OWNER/MANAGER can create/manage cron jobs, polite refusal for Cashier)
- [x] **Task 4: Pengujian & Verifikasi End-to-End**
  - [x] Add frontend unit test 17 for role-based chat isolation & greeting (`frontend/tests/frontend.test.js`)
  - [x] Run backend verification tests for AI cron job creation, sensitive data redaction, and database context (`backend/tests/test-ai-role-isolation-and-cron.js`)
  - [x] Run full frontend test suite (17/17 PASS) & production Vite build (SUCCESS)

# Task Breakdown Checklist: Perbaikan Koneksi Kabel Printer Thermal (USB & Serial)

- [x] **Task 1: Dual Mode WebUSB (Direct) & Web Serial (COM Port)**
  - [x] Implementasi Direct WebUSB (`navigator.usb`) untuk printer POS-58/POS-80 (Epson, Panda, Xprinter, Iware) tanpa perlu driver virtual COM
  - [x] Implementasi Web Serial (`navigator.serial`) dengan pilihan baud rate (9600, 19200, 38400, 57600, 115200) untuk konverter CH340 / CP2102 / PL2303
  - [x] Mengatasi stream writer lock leak dengan `try ... finally { writer.releaseLock(); }`
  - [x] Chunking transfer data (1024 bytes WebUSB, 512 bytes Web Serial) mencegah buffer overrun
- [x] **Task 2: Integrasi UI & Modal Koneksi Kabel**
  - [x] Buat komponen modal mandiri `UsbModal.jsx` dengan tab Direct WebUSB & Serial COM, tombol Test Print, Feed Paper, dan Buka Laci Kasir (RJ-11)
  - [x] Hubungkan Sidebar (`openUsbModal`), PrinterPage, dan ThermalReceiptModal
  - [x] Terapkan arsitektur anti-double UI (modal di-mount tunggal di `Layout.jsx`)
- [x] **Task 3: Pemulihan Koneksi Otomatis & Event Disconnect**
  - [x] Event listener `disconnect` pada `navigator.usb` & `navigator.serial` untuk deteksi kabel dicabut seketika
  - [x] Auto-reconnect saat reload halaman via `navigator.usb.getDevices()` & `navigator.serial.getPorts()`
  - [x] Perbaiki `printer.web.js` agar `connectionType === 'USB'` langsung memproses ESC/POS (bukan bypass ke dialog print browser)
- [x] **Task 4: Verifikasi & Testing Unit**
  - [x] Test 18: USB error sanitization & Windows driver claim detection
  - [x] Test 19: WebUSB bulk endpoint detection & Serial baud rate setup
  - [x] Test 20: USB receipt ESC/POS routing & RJ-11 cash drawer kick pulse
  - [x] 20/20 test frontend pass, build Vite sukses
