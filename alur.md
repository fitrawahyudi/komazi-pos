# PANDUAN LENGKAP ALUR KERJA FITUR HRIS KOMAZI POS
## Human Resource Information System, Presensi, Jadwal & Payroll Terpadu

Dokumen ini menjelaskan **cara kerja, alur operasional, dan logika bisnis** dari fitur HRIS (Human Resource Information System) di Komazi Coffee & Workspace secara menyeluruh dan mudah dipahami.

---

## 1. Apa Itu Fitur HRIS di Komazi POS?

Fitur HRIS di Komazi POS adalah **sistem manajemen sumber daya manusia** yang terhubung langsung dengan sistem kasir (POS). Tujuannya agar operasional kedai kopi tidak lagi mengandalkan pencatatan absensi manual di buku atau kalkulasi gaji manual di spreadsheet Excel yang rawan salah hitung.

Sistem ini mengintegrasikan **6 pilar utama**:
1. **Data Staf & Jabatan:** Pengelolaan profil karyawan, departemen (Operasional, Bar, Dapur), status kontrak, dan struktur upah.
2. **Jadwal Kerja (Roster Shift):** Pembagian shift kerja harian (Pagi, Siang, Malam, Full Day).
3. **Presensi Digital (Attendance):** Pencatatan jam masuk (*Clock In*), jam pulang (*Clock Out*), serta perhitungan otomatis menit keterlambatan.
4. **Izin & Cuti (Leaves):** Pengajuan cuti tahunan, sakit, atau izin tanpa gaji dengan persetujuan bertingkat.
5. **Lembur (Overtime):** Pengajuan dan persetujuan jam lembur staf yang terhubung ke perhitungan upah lembur.
6. **Payroll Otomatis (Penggajian & Slip Gaji):** Kalkulasi gaji otomatis berbasis data kehadiran riil, lembur, dan denda keterlambatan menjadi slip gaji digital.

---

## 2. Peta Peran Pengguna (Siapa Melakukan Apa?)

Sistem HRIS Komazi menerapkan **Role-Based Access Control (RBAC)** dan prinsip keamanan **Maker-Checker** (pembuat pengajuan tidak boleh menyetujui pengajuannya sendiri).

| Peran (Role) | Akses di Menu HRIS | Tanggung Jawab Utama |
|---|---|---|
| **OWNER (Pemilik)** | **Akses Penuh (Full Control)** | • Menambah / mengedit data staf dan besaran gaji pokok, tunjangan harian, dan tarif lembur.<br>• Membuka periode gaji (*Create Payroll Period*).<br>• Memeriksa total pengeluaran kedai (*Total Payout*).<br>• Melakukan **Finalisasi** dan **Publikasi Slip Gaji**.<br>• Memeriksa seluruh riwayat *Audit Log*. |
| **MANAGER (Store Manager)** | **Operasional & Supervisi** | • Mengatur jadwal shift harian staf.<br>• Menyetujui (*Approve*) atau Menolak (*Reject*) pengajuan cuti, lembur, dan koreksi absen staf.<br>• Menjalankan kalkulasi awal draft gaji (*Calculate Payroll*).<br>• Menambah absensi manual jika terjadi kendala sistem di outlet.<br>• *Dilarang menghapus akun staf atau menyetujui pengajuan pribadinya sendiri.* |
| **STAF (Kasir, Barista, Kitchen)** | **Employee Self-Service (ESS)** | • Menekan tombol **Clock In** saat datang dan **Clock Out** saat selesai bertugas.<br>• Mengajukan koreksi absen jika lupa mencatat kehadiran.<br>• Mengajukan cuti/izin dan lembur.<br>• Melihat dan mengunduh slip gaji pribadi (*My Payslips*) setelah dipublikasikan Owner. |

---

## 3. Diagram Alur Hubungan Antar Modul HRIS

```mermaid
graph TD
    subgraph 1. SETUP KARYAWAN & JADWAL
        A[Owner / Manager Input Data Staf] --> B[Tentukan Gaji Pokok, Uang Harian & Tarif Lembur]
        B --> C[Manager Buat Jadwal Shift Harian]
    end

    subgraph 2. OPERASIONAL HARIAN
        C --> D[Staf Masuk Kerja: Clock-In]
        D --> E{Apakah Datang Terlambat?}
        E -- Ya --> F[Sistem Catat Late Minutes]
        E -- Tidak --> G[Status: Hadir Tepat Waktu]
        F --> H[Staf Pulang Kerja: Clock-Out]
        G --> H
        H --> I[Sistem Hitung Durasi Kerja Work Minutes]
    end

    subgraph 3. PENGAJUAN & PERSETUJUAN
        J[Staf Ajukan Cuti / Lembur / Koreksi Absen] --> K{Review oleh Manager/Owner}
        K -- Ditolak --> L[Status: REJECTED]
        K -- Disetujui --> M[Status: APPROVED]
    end

    subgraph 4. SIKLUS PENGGAJIAN (PAYROLL)
        I --> N[Owner Buka Periode Payroll Baru: DRAFT]
        M --> N
        N --> O[Klik 'Calculate Payroll']
        O --> P[Sistem Hitung Otomatis Gaji Bersih Semua Staf]
        P --> Q[Owner Review Total Payout -> Klik 'Finalize']
        Q --> R[Owner Klik 'Publish Payslips']
        R --> S[Staf Buka Menu: Slip Gaji Saya Muncul Otomatis!]
    end
```

---

## 4. Rincian 6 Alur Kerja Utama Fitur HRIS

---

### 🔹 ALUR 1: Pengelolaan Data Karyawan (Staff Onboarding)

Alur ini dilakukan ketika ada staf baru yang bergabung atau ada perubahan nilai upah staf.

1. **Akses Menu:** Masuk ke menu **HRIS ➡️ Tab Staf** (`/hris/staff`).
2. **Formulir Karyawan:** Owner/Manager menekan tombol **Tambah Karyawan**:
   - **Identitas Akun:** Nama Lengkap, Username, Password, No. HP.
   - **Penempatan Kerja:** Role POS (`CASHIER`, `BARISTA`, `KITCHEN`, `MANAGER`), Departemen (`Operasional`, `Bar Minuman`, `Dapur Makanan`), Jabatan (*Job Title*), dan Tipe Kontrak (*Full Time / Part Time*).
   - **Struktur Finansial (Sangat Penting untuk Payroll):**
     - **Gaji Pokok (*baseSalary*):** Gaji dasar bulanan (contoh: Rp 2.500.000).
     - **Uang Kehadiran Harian (*dailyAllowance*):** Tunjangan makan/transport per hari hadir (contoh: Rp 25.000/hari).
     - **Tarif Lembur per Jam (*hourlyOvertimeRate*):** Upah per 1 jam lembur yang disetujui (contoh: Rp 20.000/jam).
3. **Penyimpanan:** Data staf tersimpan di database MySQL, siap untuk dijadwalkan shift dan login ke sistem POS.

---

### 🔹 ALUR 2: Penjadwalan Shift Staf (Scheduling & Roster)

Jadwal shift berfungsi sebagai **patokan resmi** jam masuk kerja staf untuk menghitung keterlambatan.

1. **Akses Menu:** Masuk ke **HRIS ➡️ Tab Jadwal** (`/hris/schedule`).
2. **Pembuatan Shift:** Manager memilih tanggal, memilih nama staf, dan memilih shift:
   - **PAGI:** Pukul `08:00 - 16:00 WIB`
   - **SIANG:** Pukul `12:00 - 20:00 WIB`
   - **MALAM:** Pukul `15:00 - 23:00 WIB`
   - **FULL DAY:** Pukul `08:00 - 20:00 WIB`
3. **Publikasi Jadwal:** Jadwal otomatis berstatus `PUBLISHED` dan dapat langsung dilihat oleh seluruh staf sebagai acuan jadwal masuk kerja mereka.

---

### 🔹 ALUR 3: Presensi Harian & Koreksi Absensi (Attendance Lifecycle)

Alur ini dijalankan **setiap hari** oleh staf saat masuk dan pulang kerja.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. JAM DATANG   │       │ 2. SELAMA KERJA │       │ 3. JAM PULANG   │
│ Staf tekan      │ ────► │ Sistem pantau   │ ────► │ Staf tekan      │
│ [ Clock In ]    │       │ status aktif    │       │ [ Clock Out ]   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                                                   │
         ▼                                                   ▼
Dibandingkan dengan                                 Sistem hitung:
jadwal shift:                                       workMinutes = Out - In
• Datang <= 08:00 -> Hadir                          Tercatat di rekap
• Datang > 08:00 -> Late Minutes                    harian outlet
```

#### A. Langkah Clock-In (Jam Datang):
1. Staf membuka menu **HRIS ➡️ Tab Kehadiran** (`/hris/attendance`).
2. Tekan tombol **Clock In**.
3. Sistem mendeteksi jam saat tombol ditekan:
   - Sistem mencocokkan dengan jadwal staf hari ini. Jika staf dijadwalkan masuk jam `08:00` dan menekan Clock In jam `08:20`, sistem otomatis mencatat `lateMinutes: 20` dengan status `LATE` (pada tampilan tabel ditampilkan ramah pengguna sebagai `Terlambat (20m)`, atau misal `Terlambat (3j 45m)` jika terlambat jam & menit).
   - Jika belum ada jadwal khusus, sistem mencatat status default `PRESENT` dengan `lateMinutes: 0` (`Tepat Waktu`).
4. **Proteksi Anti-Duplikasi:** Staf tidak dapat melakukan Clock-In dua kali pada tanggal yang sama.

#### B. Langkah Clock-Out (Jam Pulang):
1. Di akhir jam kerja, staf kembali ke tab Kehadiran dan menekan tombol **Clock Out**.
2. Sistem otomatis menghitung durasi jam kerja riil:
   $$\text{workMinutes} = \text{Jam Clock Out} - \text{Jam Clock In}$$
3. Rekap kehadiran hari tersebut selesai dan tersimpan rapi.

#### C. Pengajuan Koreksi Absensi (Jika Lupa Absen / Ponsel Mati):
1. Jika kasir lupa Clock-In karena antrean pelanggan sangat ramai, staf dapat mengajukan **Koreksi Absensi** di panel bawah tab Kehadiran.
2. Masukkan jam masuk dan jam pulang yang sebenarnya beserta alasan (misal: *"Lupa clock in karena langsung menangani rombongan pelanggan 10 orang"*).
3. Status masuk ke daftar **PENDING**.
4. Manager atau Owner memeriksa pengajuan tersebut:
   - **Prinsip Maker-Checker:** Manajer dilarang menyetujui koreksi absensi atas nama dirinya sendiri.
   - Bila disetujui (**APPROVED**), catatan absensi staf pada tanggal tersebut otomatis dikoreksi di sistem.

---

### 🔹 ALUR 4: Pengajuan & Persetujuan Cuti (Leave Management)

1. **Pengajuan oleh Staf:**
   - Staf membuka **HRIS ➡️ Tab Cuti** (`/hris/leaves`).
   - Memilih tipe cuti:
     - `ANNUAL` (Cuti Tahunan)
     - `SICK` (Sakit / Izin Dokter)
     - `UNPAID` (Izin Tanpa Gaji)
     - `OTHER` (Izin Keperluan Mendesak)
   - Memasukkan tanggal mulai, tanggal selesai, dan alasan permohonan.
   - Status awal: `PENDING`.
2. **Pemeriksaan oleh Manager / Owner:**
   - Manager melihat pengajuan cuti yang masuk.
   - Memeriksa apakah kuota barista/kasir di tanggal tersebut mencukupi.
   - Menekan tombol **Setujui** (`APPROVED`) atau **Tolak** (`REJECTED`).
   - Staf yang bersangkutan dapat langsung melihat pembaruan status cutinya di layar.

---

### 🔹 ALUR 5: Pengajuan & Perhitungan Lembur (Overtime)

1. **Pengajuan Lembur:**
   - Jika staf diminta tetap berada di bar/dapur setelah jam shift selesai (misal ada pesanan katering atau event coworking), staf membuka **HRIS ➡️ Tab Lembur** (`/hris/overtimes`).
   - Memasukkan tanggal, durasi lembur (misal: `2.5 jam`), dan alasan pekerjaan.
   - Status awal: `PENDING`.
2. **Persetujuan Supervisor / Manager:**
   - Manager meninjau bukti pekerjaan lembur.
   - Menekan tombol **Setujui** (`APPROVED`).
3. **Dampak ke Payroll:**
   - Jam lembur yang berstatus `APPROVED` akan **secara otomatis ditarik saat perhitungan gaji bulanan** dan dikalikan dengan tarif lembur staf (`hourlyOvertimeRate`).

---

### 🔹 ALUR 6: Penggajian & Slip Gaji Digital (Payroll Lifecycle)

Modul ini adalah muara dari seluruh aktivitas absensi, cuti, dan lembur staf. Sistem payroll Komazi mengikuti **siklus 4 tahap yang aman**:

```
[ 1. DRAFT ] ────────► [ 2. CALCULATED ] ────────► [ 3. FINALIZED ] ────────► [ 4. PUBLISHED ]
Owner buat             Sistem hitung              Owner kunci angka          Slip gaji muncul
periode baru           rumus otomatis             pengeluaran kedai          di akun staf
```

#### Tahap 1: Pembukaan Periode Gaji (`DRAFT`)
- Owner membuka tab **HRIS ➡️ Tab Payroll** (`/hris/payroll`).
- Klik **Buat Periode Payroll**:
  - Masukkan nama periode: Contoh *"Oktober 2026"*
  - Tanggal Mulai: `2026-10-01`
  - Tanggal Selesai: `2026-10-31`
- Periode tersimpan dengan status awal `DRAFT`.

#### Tahap 2: Kalkulasi Gaji Otomatis (`CALCULATED`)
- Owner atau Manager menekan tombol **Hitung Ulang / Kalkulasi**.
- **Sistem backend bekerja otomatis:**
  1. Menghitung berapa hari staf hadir riil dalam rentang tanggal tersebut (`presentDays`).
  2. Menjumlahkan total jam lembur yang telah disetujui (`overtimeHours`).
  3. Menjumlahkan total menit keterlambatan (`lateMinutes`).
  4. Menerapkan rumus penghitungan gaji transparan:

$$\text{Tunjangan Harian} = \text{Uang Harian (dailyAllowance)} \times \text{Hari Hadir riil}$$

$$\text{Upah Lembur} = \text{Tarif Lembur per Jam (hourlyOvertimeRate)} \times \text{Total Jam Lembur Disetujui}$$

$$\text{Denda Terlambat} = \left\lfloor \frac{\text{Total Menit Terlambat}}{15} \right\rfloor \times \text{Rp 5.000}$$

$$\mathbf{Gaji\ Bersih\ (Net\ Salary)} = \mathbf{Gaji\ Pokok} + \mathbf{Tunjangan\ Harian} + \mathbf{Upah\ Lembur} + \mathbf{Bonus} - \mathbf{Potongan\ Terlambat}$$

- Seluruh draft slip gaji staf terbentuk otomatis dan total estimasi pengeluaran kedai (*Total Payout*) langsung tampil di layar Owner.

#### Tahap 3: Kunci Angka / Finalisasi (`FINALIZED`)
- Owner memeriksa lembar rekap gaji seluruh karyawan.
- Jika semua nominal sudah valid dan sesuai anggaran kedai, Owner menekan tombol **Finalisasi Periode**.
- Status berubah menjadi `FINALIZED`. Periode ini terkunci dan tidak dapat diubah-ubah lagi demi mencegah kecurangan finansial.

#### Tahap 4: Publikasi Slip Gaji (`PUBLISHED`)
- Owner menekan tombol **Publikasikan Slip Gaji**.
- Status periode dan seluruh slip gaji berubah menjadi `PUBLISHED`.
- **Hasil Akhir:** Seluruh staf (kasir, barista, kitchen) kini dapat membuka sub-tab **Slip Gaji Saya** untuk melihat slip gaji digital resmi mereka lengkap dengan rincian kehadiran, jam lembur, potongan, dan nominal gaji bersih yang akan diterima!

---

## 5. Contoh Skenario Nyata: "Budi si Barista"

Untuk mempermudah pemahaman, mari kita ikuti simulasi 1 bulan kerja **Budi (Barista)** di Komazi Coffee:

### 1. Data Kontrak Budi di Sistem:
- **Gaji Pokok:** Rp 2.400.000 / bulan
- **Uang Kehadiran Harian:** Rp 20.000 / hari
- **Tarif Lembur:** Rp 20.000 / jam

### 2. Aktivitas Kerja Budi Selama Bulan Oktober:
- Budi dijadwalkan kerja 25 hari.
- **Kehadiran riil:** Budi melakukan Clock-In & Clock-Out sebanyak **24 hari** (1 hari izin sakit resmi).
- **Keterlambatan:** Budi tercatat terlambat 2 kali (total 35 menit terlambat).
  - Denda terlambat: $\lfloor 35 / 15 \rfloor \times \text{Rp 5.000} = 2 \times \text{Rp 5.000} = \text{Rp 10.000}$.
- **Lembur Disetujui:** Budi membantu event kopi selama **5 jam lembur** yang disetujui Manager.

### 3. Hasil Perhitungan Otomatis Sistem saat Owner Klik "Calculate Payroll":
```
════════════════════════════════════════════════════════════════════
SLIP GAJI KOMAZI COFFEE & WORKSPACE (OKTOBER 2026)
Nama Karyawan : Budi Santoso
Jabatan       : Senior Barista (Bar Minuman)
Hari Hadir    : 24 Hari  |  Lembur Disetujui: 5 Jam
════════════════════════════════════════════════════════════════════
PENDAPATAN:
(+) Gaji Pokok                     : Rp 2.400.000
(+) Tunjangan Harian (24 x 20.000) : Rp   480.000
(+) Upah Lembur (5 jam x 20.000)   : Rp   100.000
(+) Bonus Khusus                   : Rp         0

POTONGAN:
(-) Denda Terlambat (35 menit)     : Rp   (10.000)
════════════════════════════════════════════════════════════════════
TOTAL GAJI BERSIH (TAKE HOME PAY)  : Rp 2.970.000
════════════════════════════════════════════════════════════════════
Status: PUBLISHED (Resmi Dikeluarkan oleh Manajemen Kedai)
```
> **Keuntungan:** Tidak ada perdebatan mengenai jam lembur atau jumlah hari hadir, karena semua data berasal langsung dari riwayat presensi dan persetujuan digital di sistem.

---

## 6. Jejak Audit & Keamanan Anti-Fraud (HrisAuditLog)

Seluruh aktivitas sensitif di modul HRIS otomatis dicatat ke dalam log audit (`HrisAuditLog`) dan tidak dapat dihapus:
- Siapa yang menambahkan karyawan baru.
- Siapa yang menyetujui atau menolak cuti dan lembur.
- Siapa yang menyetujui koreksi jam absen.
- Jam berapa payroll dihitung, difinalisasi, dan dipublikasikan beserta alamat IP pelakunya.

Jika sewaktu-waktu ada kejanggalan nominal atau data staf, Owner dapat membuka **HRIS ➡️ Tab Audit** (`/hris/audit`) untuk melihat rekam jejak digital secara transparan.

---

## 7. Pertanyaan yang Sering Diajukan (FAQ)

### Q1: Apakah kasir bisa melihat data gaji karyawan lain?
> **Tidak.** Kasir, barista, dan staf kitchen hanya memiliki akses ke **Employee Self-Service (ESS)**. Mereka hanya bisa melihat absensi mereka sendiri, mengajukan izin sendiri, dan melihat slip gaji milik mereka sendiri. Data gaji global hanya bisa dibuka oleh peran `OWNER`.

### Q2: Bagaimana jika internet di toko mati saat jam masuk kerja?
> Jika internet mati, staf dapat melapor ke Manager bertugas. Setelah koneksi kembali normal, Manager dapat menggunakan fitur **Tambah Absensi Manual** atau staf mengajukan **Koreksi Absensi** dengan menyertakan alasan.

### Q3: Apakah staf bisa menyetujui lembur atau cutinya sendiri?
> **Tidak.** Sistem menerapkan perlindungan *Maker-Checker Protection*. Jika seorang Manager mengajukan lembur atau cuti untuk dirinya sendiri, sistem akan menolak jika Manager tersebut mencoba menyetujuinya sendiri. Pengajuan tersebut wajib disetujui oleh Owner.

### Q4: Kapan slip gaji muncul di aplikasi staf?
> Slip gaji baru akan tampil di menu staf setelah Owner menekan tombol **Publikasikan (Publish)** pada periode payroll terkait. Selama statusnya masih `DRAFT` atau `CALCULATED`, staf belum dapat melihatnya agar manajemen bisa melakukan koreksi terlebih dahulu bila ada kekeliruan.

---

*Dokumen ini merupakan panduan resmi arsitektur dan alur operasional modul HRIS Komazi Coffee & Workspace.*
