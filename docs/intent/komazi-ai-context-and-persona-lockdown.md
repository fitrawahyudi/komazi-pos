# Intent: Komazi AI Context Intelligence & Persona Lockdown

## Status: COMPLETED & VERIFIED (100%)
**Tanggal Konfirmasi:** 2026-10-29  
**Tanggal Penyelesaian:** 2026-10-29  
**Stakeholder:** Owner Komazi Coffee & Workspace  

---

## 1. Ringkasan Masalah (Background & Pain Points)
Pada percakapan bot Telegram Komazi AI sebelumnya, terdapat kelemahan fatal yang membuat asisten terlihat kaku dan tidak cerdas:
1. **Kegagalan Menjawab Tanggal (Amnesia Konteks):** Saat pengguna menanyakan *"itu tanggal berapa?"*, bot berdalih kaku *"tidak bisa memastikan tanggalnya / tidak menyimpan tanggal eksplisit"* alih-alih mengaitkan langsung dengan data hari ini.
2. **Kebocoran Persona & Kata Ganti:** Bot masih menggunakan sapaan tidak resmi seperti *"Bapak"*, *"Pak"*, *"Bos"*, kata ganti orang pertama *"saya"* / *"aku"*, serta memanggil pengguna dengan nama placeholder *"Owner User"*.
3. **Format Tabel Berantakan di Telegram:** Permintaan data dalam bentuk tabel disajikan dengan sintaks markdown pipa mentah (`|---|---|`) yang tidak didukung secara visual oleh Telegram.

---

## 2. Definisi Kebutuhan (Statement of Intent)
- **Outcome:** Membuat Komazi AI cerdas mengenali konteks tanggal kalender riil secara otomatis, konsisten 100% pada identitas resmi Komazi (bebas dari dalih kaku, bebas kata "saya", bebas panggilan "Bapak", dan bebas sapaan "Owner User"), serta menampilkan tabel/data rapi di Telegram.
- **User:** Owner dan tim operasional Komazi saat berinteraksi dengan asisten Komazi di Telegram.
- **Why now:** Bot di Telegram memperlihatkan jawaban defensif dan format yang merusak citra asisten pintar kedai.
- **Success:**
  1. **Konteks Penanggalan Cerdas:** Saat ditanya *"itu tanggal berapa?"*, Komazi langsung menjawab lugas dan tegas tanggal kalender hari ini (contoh: *"Data penjualan tersebut adalah data hari ini, Kamis, 29 Oktober 2026 per pukul 20:45 WIB"*) tanpa alasan teknis.
  2. **Persona & Sanitasi Bersih:** Dihilangkan 100% sapaan *"Bapak"* dan kata ganti *"saya"*, serta nama pengguna diambil akurat dari profil/Telegram asli (bukan *"User"* statis).
  3. **Tampilan Tabel Rapi di Telegram:** Permintaan data berbentuk tabel di Telegram diformat rapi menggunakan code block monospace `<pre>` dengan garis pembatas kotak (`─`, `│`, `┼`), bukan markdown mentah `|---|---|`.
- **Constraint:** Menggunakan zona waktu resmi operasional kedai `Asia/Jakarta` (WIB) dan memanfaatkan data yang sudah ada di database tanpa mengubah skema tabel DB.
- **Out of scope:** Menambah charting grafik gambar baru untuk chat kasual biasa atau merombak arsitektur model AI eksternal.

---

## 3. Komponen Solusi yang Diimplementasikan
1. **Smart Calendar Date Binding (`aiContextService.js`):**
   - Menghitung tanggal panjang resmi Indonesia (`dateLongIndo`, e.g., *"Kamis, 29 Oktober 2026"*) dan jam WIB terkini.
   - Mengikat tanggal kalender riil ini secara eksplisit ke dalam header data operasional hari ini.
   - Memberikan aturan penalaran waktu & tanggal mutlak: melarang berdalih tidak tahu tanggal dan mewajibkan menjawab tanggal hari ini secara tegas.
2. **Eliminasi Placeholder "User" & Sapaan Non-Resmi (`aiToneFormatter.js` & `aiService.js`):**
   - Mengabaikan nama placeholder `User`, `Admin`, dsb., sehingga menghasilkan sapaan bersih `Owner`, `Kasir`, atau nama asli pengguna Telegram (`Owner Fitra`).
   - Menyaring dan mengganti seluruh sapaan informal (*Bapak*, *Pak*, *Ibu*, *Bu*, *Bos*, *Mas*, *Bro*, *Gan*) dengan nama role resmi.
   - Mengonversi semua kata ganti orang pertama (*saya*, *aku*, *kami*, *gue*) menjadi *Komazi*.
3. **Konverter Tabel Markdown Telegram (`aiToneFormatter.js` & `ai.js`):**
   - Fungsi `formatMarkdownTables()` mem-parse baris tabel markdown dan mengonversinya menjadi tabel monospace terstruktur dalam tag `<pre>...</pre>`.
   - Mengamankan blok `<pre>` dari gangguan escape HTML atau inline markdown formatter di Telegram.
4. **Penguatan Dynamic Fallback Context (`openclawClient.js`):**
   - Meneruskan `effectiveUser` yang membawa role dan nama pengguna Telegram asli ke klien OpenClaw/native cloud fallback, menghapus argumen statis `'OWNER', 'User'`.
5. **Anti-Repetisi & Pembersihan Perkenalan Robotik (`aiService.js` & `aiContextService.js`):**
   - Mencegah tumpang tindih penimpaan kata (*"Komazi Komazi"*), memotong kalimat perkenalan diri model yang kaku/berulang saat pengguna hanya menyapa (*"malam"*, *"halo"*), serta menghapus halusinasi nama acak (*"Owner Doni"*).

---

## 4. Hasil Verifikasi End-to-End
- **Unit Test Suite:** [`backend/tests/test-ai-persona-guardrail.js`](file:///d:/pos-komazi/backend/tests/test-ai-persona-guardrail.js)
  - PASS: Format sapaan bebas dari "Owner User" dan "Bos".
  - PASS: Sanitasi tangkapan layar Telegram nyata (pembersihan tuntas "saya", "Bapak", dan "Owner User").
  - PASS: Konversi tabel markdown ke blok monospace `<pre>` Telegram.
  - PASS: Context prompt memuat tanggal resmi dan aturan penalaran waktu.
- **Universal Scheduler Suite:** [`backend/tests/test-ai-universal-scheduler.js`](file:///d:/pos-komazi/backend/tests/test-ai-universal-scheduler.js) lulus 100%.
