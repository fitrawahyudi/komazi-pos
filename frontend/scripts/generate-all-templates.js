import XLSX from 'xlsx-js-style';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../');
const targets = [
  path.join(rootDir, 'templates'),
  path.join(rootDir, 'frontend/public/templates'),
  path.join(rootDir, 'frontend/dist/templates'),
  path.join(rootDir, 'frontend/android/app/src/main/assets/public/templates'),
];

targets.forEach((dir) => {
  if (fs.existsSync(path.dirname(dir))) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Styling Tokens (Persis Screenshot: Dark Forest Green #105932, white bold, border, autofilter)
const STYLES = {
  header: {
    fill: { patternType: 'solid', fgColor: { rgb: '105932' } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '0B3D22' } },
      bottom: { style: 'thin', color: { rgb: '0B3D22' } },
      left: { style: 'thin', color: { rgb: '0B3D22' } },
      right: { style: 'thin', color: { rgb: '0B3D22' } },
    },
  },
  title: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '105932' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  subtitle: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  cell: {
    font: { name: 'Calibri', sz: 11, color: { rgb: '111827' } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  cellZebra: {
    fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
    font: { name: 'Calibri', sz: 11, color: { rgb: '111827' } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  wajibBadge: {
    fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } },
    font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'DC2626' } },
    alignment: { vertical: 'center', horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  opsionalBadge: {
    font: { name: 'Calibri', sz: 10, color: { rgb: '6B7280' } },
    alignment: { vertical: 'center', horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  guideText: {
    font: { name: 'Calibri', sz: 10.5, color: { rgb: '374151' } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  bulletText: {
    font: { name: 'Calibri', sz: 10.5, color: { rgb: '374151' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
};

function getColLetter(idx) {
  let l = '';
  let t = idx;
  while (t >= 0) {
    l = String.fromCharCode((t % 26) + 65) + l;
    t = Math.floor(t / 26) - 1;
  }
  return l;
}

function buildDataSheet(columns, exampleRows = []) {
  const headers = columns.map((c) => c.name);
  const aoa = [headers];
  exampleRows.forEach((r) => {
    aoa.push(headers.map((h) => (r[h] !== undefined ? r[h] : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: c.wch || Math.max(c.name.length + 4, 16) }));
  ws['!rows'] = [{ hpt: 26 }];

  headers.forEach((_, colIdx) => {
    const cellRef = `${getColLetter(colIdx)}1`;
    if (ws[cellRef]) ws[cellRef].s = STYLES.header;
  });

  exampleRows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    headers.forEach((h, colIdx) => {
      const cellRef = `${getColLetter(colIdx)}${rowNum}`;
      if (ws[cellRef]) {
        const val = row[h];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...STYLES.cell,
          alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
        };
      }
    });
  });

  const lastCol = getColLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastCol}${Math.max(exampleRows.length + 1, 2)}` };
  return ws;
}

function buildInstructionSheet(title, guideColumns, notes = []) {
  const aoa = [
    [title, '', ''],
    ['', '', ''],
    ['Nama Kolom', 'Wajib?', 'Penjelasan'],
  ];

  guideColumns.forEach((col) => {
    aoa.push([col.name, col.required ? 'WAJIB' : 'tidak', col.desc]);
  });

  aoa.push(['', '', '']);
  aoa.push(['Catatan', '', '']);
  notes.forEach((note) => {
    aoa.push([`• ${note}`, '', '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 80 }];
  ws['!rows'] = [{ hpt: 26 }, { hpt: 12 }, { hpt: 24 }];

  if (ws['A1']) ws['A1'].s = STYLES.title;
  ['A3', 'B3', 'C3'].forEach((cell) => {
    if (ws[cell]) ws[cell].s = STYLES.header;
  });

  guideColumns.forEach((col, idx) => {
    const rowNum = idx + 4;
    if (ws[`A${rowNum}`]) {
      ws[`A${rowNum}`].s = {
        ...STYLES.cell,
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } },
      };
    }
    if (ws[`B${rowNum}`]) {
      ws[`B${rowNum}`].s = col.required ? STYLES.wajibBadge : STYLES.opsionalBadge;
    }
    if (ws[`C${rowNum}`]) {
      ws[`C${rowNum}`].s = STYLES.guideText;
    }
  });

  const catatanRowNum = guideColumns.length + 5;
  if (ws[`A${catatanRowNum}`]) ws[`A${catatanRowNum}`].s = STYLES.subtitle;
  notes.forEach((_, nIdx) => {
    const rowNum = catatanRowNum + 1 + nIdx;
    if (ws[`A${rowNum}`]) ws[`A${rowNum}`].s = STYLES.bulletText;
  });

  return ws;
}

function buildReferenceSheet(headers, rows = []) {
  const aoa = [headers];
  rows.forEach((r) => {
    aoa.push(headers.map((h) => (r[h] !== undefined && r[h] !== null ? r[h] : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => {
    let maxLen = h.length;
    rows.slice(0, 50).forEach((r) => {
      const s = String(r[h] ?? '');
      if (s.length > maxLen) maxLen = s.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 40) };
  });
  ws['!rows'] = [{ hpt: 24 }];

  headers.forEach((_, colIdx) => {
    const cellRef = `${getColLetter(colIdx)}1`;
    if (ws[cellRef]) ws[cellRef].s = STYLES.header;
  });

  rows.forEach((r, rowIdx) => {
    const rowNum = rowIdx + 2;
    const isEven = rowIdx % 2 === 0;
    const baseStyle = isEven ? STYLES.cell : STYLES.cellZebra;

    headers.forEach((h, colIdx) => {
      const cellRef = `${getColLetter(colIdx)}${rowNum}`;
      if (ws[cellRef]) {
        const val = r[h];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...baseStyle,
          alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
        };
      }
    });
  });

  const lastCol = getColLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastCol}${Math.max(rows.length + 1, 2)}` };
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAFTAR BUILDER 9 TEMPLATE RESMI
// ─────────────────────────────────────────────────────────────────────────────
const templateBuilders = [
  // 1. Resep Produk (BOM)
  {
    fileName: 'template_import_resep_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'SKU Produk*', wch: 18 },
          { name: 'Nama Varian', wch: 18 },
          { name: 'Nama Sumber Persediaan*', wch: 30 },
          { name: 'Jumlah per 1 Produk*', wch: 22 },
        ],
        [
          { 'SKU Produk*': 'SKU-001', 'Nama Varian': '', 'Nama Sumber Persediaan*': 'Gula Pasir', 'Jumlah per 1 Produk*': 0.05 },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Resep',
        [
          { name: 'SKU Produk*', required: true, desc: 'SKU produk yang memakai resep ini. Semua baris dengan SKU sama = satu resep.' },
          { name: 'Nama Varian', required: false, desc: 'Kosongkan = berlaku untuk SEMUA varian. Diisi = TAMBAHAN khusus varian itu, di atas baris yang kosong (bukan pengganti).' },
          { name: 'Nama Sumber Persediaan*', required: true, desc: 'Nama sumber persediaan yang sudah terdaftar di menu Sumber Persediaan (lihat sheet "Data Sumber Persediaan").' },
          { name: 'Jumlah per 1 Produk*', required: true, desc: 'Pemakaian untuk 1 produk, dalam satuan sumber persediaan itu. Contoh: 0.05 (kg).' },
        ],
        [
          'HAPUS atau TIMPA baris 2 sebelum mengunggah. Baris itu hanya contoh, tapi kalau dibiarkan ia ikut jadi resep untuk produk SKU-001.',
          'Satu baris = satu sumber persediaan. Untuk resep dengan 3 sumber persediaan, tulis 3 baris dengan SKU Produk yang sama.',
          'Baris ber-Nama Varian bersifat MENAMBAH: saat varian itu terjual, pemakaiannya = baris tanpa varian + baris varian tersebut. Jangan mengulang bahan yang sudah ditulis tanpa varian, atau bahan itu terpotong dua kali.',
          'Impor resep MENGGANTI seluruh resep produk tersebut.',
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

      const wsProduk = buildReferenceSheet(
        ['SKU Produk', 'Nama Produk', 'Nama Varian', 'Kategori', 'Aktif?', 'Lacak Stok?'],
        [
          { 'SKU Produk': 'SA-01', 'Nama Produk': 'Sanger Espresso', 'Nama Varian': '', 'Kategori': 'Coffee', 'Aktif?': 'ya', 'Lacak Stok?': 'ya' },
          { 'SKU Produk': 'KMZ-02', 'Nama Produk': 'Croissant Butter Paris', 'Nama Varian': '', 'Kategori': 'Bakery', 'Aktif?': 'ya', 'Lacak Stok?': 'ya' },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsProduk, 'Data Produk');

      const wsBahan = buildReferenceSheet(
        ['Nama Sumber Persediaan', 'Satuan', 'Jumlah Stok', 'Stok Minimum', 'Harga per Satuan', 'Lacak Stok?', 'Aktif?'],
        [
          { 'Nama Sumber Persediaan': 'Biji Kopi House Blend Arabica', 'Satuan': 'gram', 'Jumlah Stok': 5000, 'Stok Minimum': 1000, 'Harga per Satuan': 250, 'Lacak Stok?': 'ya', 'Aktif?': 'ya' },
          { 'Nama Sumber Persediaan': 'Fresh Milk Pasteurisasi', 'Satuan': 'ml', 'Jumlah Stok': 15000, 'Stok Minimum': 3000, 'Harga per Satuan': 22, 'Lacak Stok?': 'ya', 'Aktif?': 'ya' },
          { 'Nama Sumber Persediaan': 'Gula Pasir', 'Satuan': 'kg', 'Jumlah Stok': 25, 'Stok Minimum': 5, 'Harga per Satuan': 17500, 'Lacak Stok?': 'ya', 'Aktif?': 'ya' },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsBahan, 'Data Sumber Persediaan');
      return wb;
    },
  },

  // 2. Menu & Produk
  {
    fileName: 'template_import_menu_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'SKU', wch: 16 },
          { name: 'Nama Produk*', wch: 28 },
          { name: 'Kategori*', wch: 18 },
          { name: 'Harga Jual*', wch: 16 },
          { name: 'Deskripsi', wch: 35 },
          { name: 'Varian', wch: 20 },
          { name: 'Harga Varian', wch: 20 },
          { name: 'Stasiun Dapur', wch: 16 },
        ],
        [
          {
            'SKU': 'KMZ-CF-001',
            'Nama Produk*': 'Kopi Susu Aren Signature',
            'Kategori*': 'Coffee',
            'Harga Jual*': 22000,
            'Deskripsi': 'Espresso double shot dengan fresh milk dan gula aren asli',
            'Varian': 'Ice, Hot',
            'Harga Varian': '22000, 20000',
            'Stasiun Dapur': 'BAR',
          },
          {
            'SKU': 'KMZ-BK-001',
            'Nama Produk*': 'Croissant Butter Paris',
            'Kategori*': 'Bakery',
            'Harga Jual*': 28000,
            'Deskripsi': 'Pastry renyah dengan butter Prancis premium',
            'Varian': '',
            'Harga Varian': '',
            'Stasiun Dapur': 'KITCHEN',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Menu Produk',
        [
          { name: 'SKU', required: false, desc: 'Kode SKU unik produk. Kosongkan jika ingin dibuatkan otomatis oleh sistem.' },
          { name: 'Nama Produk*', required: true, desc: 'Nama resmi produk yang akan tampil pada katalog kasir POS dan struk transaksi.' },
          { name: 'Kategori*', required: true, desc: 'Kategori menu (contoh: Coffee, Non-Coffee, Bakery). Lihat sheet "Data Kategori".' },
          { name: 'Harga Jual*', required: true, desc: 'Harga jual dasar dalam Rupiah (hanya angka bulat, tanpa titik/koma/Rp).' },
          { name: 'Deskripsi', required: false, desc: 'Keterangan bahan atau catatan rasa untuk panduan kasir.' },
          { name: 'Varian', required: false, desc: 'Daftar nama varian dipisahkan tanda koma (contoh: Regular, Large atau Hot, Ice).' },
          { name: 'Harga Varian', required: false, desc: 'Harga masing-masing varian berurutan sesuai kolom Varian (contoh: 22000, 25000).' },
          { name: 'Stasiun Dapur', required: false, desc: 'Tujuan tiket pesanan dicetak/ditampilkan: "BAR" (barista) atau "KITCHEN" (dapur).' },
        ],
        [
          'HAPUS atau TIMPA baris 2 sebelum mengunggah. Baris tersebut hanya data contoh.',
          'Kategori yang belum terdaftar di sistem akan dibuat secara otomatis saat proses impor berhasil.',
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

      const wsCat = buildReferenceSheet(
        ['Nama Kategori', 'Deskripsi', 'Jumlah Produk'],
        [
          { 'Nama Kategori': 'Coffee', 'Deskripsi': 'Minuman berbasis espresso & manual brew', 'Jumlah Produk': 12 },
          { 'Nama Kategori': 'Non-Coffee', 'Deskripsi': 'Matcha, cokelat, teh artisan & susu', 'Jumlah Produk': 8 },
          { 'Nama Kategori': 'Bakery', 'Deskripsi': 'Croissant, toast & pastry segar', 'Jumlah Produk': 5 },
          { 'Nama Kategori': 'Main Course', 'Deskripsi': 'Makanan berat dan rice bowl', 'Jumlah Produk': 6 },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsCat, 'Data Kategori');
      return wb;
    },
  },

  // 3. Sumber Persediaan (Bahan Baku)
  {
    fileName: 'template_import_bahan_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Nama Bahan*', wch: 30 },
          { name: 'Satuan* (gram/ml/pcs/kg)', wch: 24 },
          { name: 'Stok Awal*', wch: 16 },
          { name: 'Stok Minimum*', wch: 16 },
          { name: 'Harga Modal per Satuan (Rp)*', wch: 26 },
          { name: 'Nama Supplier', wch: 24 },
          { name: 'No WhatsApp Supplier', wch: 22 },
        ],
        [
          {
            'Nama Bahan*': 'Biji Kopi House Blend Arabica',
            'Satuan* (gram/ml/pcs/kg)': 'gram',
            'Stok Awal*': 5000,
            'Stok Minimum*': 1000,
            'Harga Modal per Satuan (Rp)*': 250,
            'Nama Supplier': 'PT Sukses Mandiri Kopi',
            'No WhatsApp Supplier': '081234567890',
          },
          {
            'Nama Bahan*': 'Fresh Milk Pasteurisasi Greenfield',
            'Satuan* (gram/ml/pcs/kg)': 'ml',
            'Stok Awal*': 15000,
            'Stok Minimum*': 3000,
            'Harga Modal per Satuan (Rp)*': 22,
            'Nama Supplier': 'Distributor Susu Segar',
            'No WhatsApp Supplier': '085712348899',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Bahan Baku',
        [
          { name: 'Nama Bahan*', required: true, desc: 'Nama unik bahan baku atau packaging (contoh: Biji Kopi House Blend, Fresh Milk).' },
          { name: 'Satuan*', required: true, desc: 'Satuan baku: gram, ml, pcs, kg, liter, shot, lembar. Lihat sheet "Daftar Satuan Valid".' },
          { name: 'Stok Awal*', required: true, desc: 'Jumlah kuantitas riil saat ini di gudang/bar (hanya angka).' },
          { name: 'Stok Minimum*', required: true, desc: 'Ambang batas peringatan stok kritis ke bot Telegram & dashboard.' },
          { name: 'Harga Modal per Satuan (Rp)*', required: true, desc: 'HPP modal per satuan terkecil (contoh: Rp 250 per gram).' },
          { name: 'Nama Supplier', required: false, desc: 'Nama mitra pemasok bahan untuk pemesanan restock.' },
          { name: 'No WhatsApp Supplier', required: false, desc: 'Nomor WhatsApp pemasok untuk tombol 1-Click WhatsApp Restock otomatis.' },
        ],
        [
          'HAPUS atau TIMPA baris contoh sebelum mengunggah file.',
          'Pilihlah satuan ukur yang konsisten dengan takaran resep yang diracik di outlet.',
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

      const wsSatuan = buildReferenceSheet(
        ['Satuan Valid', 'Jenis Takaran', 'Contoh Bahan'],
        [
          { 'Satuan Valid': 'gram', 'Jenis Takaran': 'Bobot Kering', 'Contoh Bahan': 'Biji kopi, bubuk cokelat, gula, matcha' },
          { 'Satuan Valid': 'ml', 'Jenis Takaran': 'Cairan / Liquid', 'Contoh Bahan': 'Susu segar, sirup perasa, air mineral' },
          { 'Satuan Valid': 'pcs', 'Jenis Takaran': 'Kemasan / Barang Jadi', 'Contoh Bahan': 'Paper cup, sedotan, lid penutup, kotak kue' },
          { 'Satuan Valid': 'kg', 'Jenis Takaran': 'Bobot Besar', 'Contoh Bahan': 'Beras, tepung terigu, biji kopi karungan' },
          { 'Satuan Valid': 'liter', 'Jenis Takaran': 'Cairan Besar', 'Contoh Bahan': 'Minyak goreng, sirup galon' },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsSatuan, 'Daftar Satuan Valid');
      return wb;
    },
  },

  // 4. Pelanggan CRM
  {
    fileName: 'template_import_pelanggan_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Nama Pelanggan*', wch: 26 },
          { name: 'Nomor WhatsApp / HP*', wch: 22 },
          { name: 'Email', wch: 28 },
          { name: 'Poin Awal', wch: 14 },
          { name: 'Tier Member', wch: 16 },
          { name: 'Catatan / Alergi', wch: 32 },
        ],
        [
          {
            'Nama Pelanggan*': 'Ahmad Rizky Pratama',
            'Nomor WhatsApp / HP*': '081298765432',
            'Email': 'ahmad.rizky@gmail.com',
            'Poin Awal': 50,
            'Tier Member': 'GOLD',
            'Catatan / Alergi': 'Suka kopi double shot manis tipis',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Data Pelanggan',
        [
          { name: 'Nama Pelanggan*', required: true, desc: 'Nama lengkap pelanggan member.' },
          { name: 'Nomor WhatsApp / HP*', required: true, desc: 'Nomor HP unik pelanggan (kunci pencarian utama kasir).' },
          { name: 'Email', required: false, desc: 'Alamat surel pelanggan untuk struk digital.' },
          { name: 'Poin Awal', required: false, desc: 'Saldo poin reward awal pelanggan (angka bulat).' },
          { name: 'Tier Member', required: false, desc: 'Tingkatan member: REGULAR, SILVER, GOLD, VIP.' },
          { name: 'Catatan / Alergi', required: false, desc: 'Preferensi rasa, pantangan makanan, atau catatan khusus pelanggan.' },
        ],
        ['Nomor WhatsApp / HP tidak boleh duplikat dengan pelanggan yang sudah ada.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

      const wsTier = buildReferenceSheet(
        ['Kode Tier', 'Nama Tier', 'Diskon (%)', 'Min Belanja'],
        [
          { 'Kode Tier': 'REGULAR', 'Nama Tier': 'Regular Member', 'Diskon (%)': 0, 'Min Belanja': 0 },
          { 'Kode Tier': 'SILVER', 'Nama Tier': 'Silver Member', 'Diskon (%)': 5, 'Min Belanja': 250000 },
          { 'Kode Tier': 'GOLD', 'Nama Tier': 'Gold Member', 'Diskon (%)': 10, 'Min Belanja': 1000000 },
          { 'Kode Tier': 'VIP', 'Nama Tier': 'VIP Member', 'Diskon (%)': 15, 'Min Belanja': 2500000 },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsTier, 'Data Tier Member');
      return wb;
    },
  },

  // 5. Staf HRIS
  {
    fileName: 'template_import_staf_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Nama Lengkap*', wch: 24 },
          { name: 'Username*', wch: 18 },
          { name: 'Password Sementara*', wch: 20 },
          { name: 'Peran Sistem*', wch: 18 },
          { name: 'Nomor Telepon / WA', wch: 22 },
          { name: 'Departemen', wch: 18 },
          { name: 'Jabatan', wch: 18 },
          { name: 'Status Ikatan Kerja', wch: 20 },
          { name: 'Gaji Pokok Bulanan (Rp)', wch: 24 },
          { name: 'Uang Makan Harian (Rp)', wch: 24 },
          { name: 'Tarif Lembur per Jam (Rp)', wch: 26 },
        ],
        [
          {
            'Nama Lengkap*': 'Fajar Nugraha',
            'Username*': 'fajar.barista',
            'Password Sementara*': 'Kopi123!',
            'Peran Sistem*': 'BARISTA',
            'Nomor Telepon / WA': '085611223344',
            'Departemen': 'Bar & Kopi',
            'Jabatan': 'Senior Barista',
            'Status Ikatan Kerja': 'FULL_TIME',
            'Gaji Pokok Bulanan (Rp)': 3200000,
            'Uang Makan Harian (Rp)': 25000,
            'Tarif Lembur per Jam (Rp)': 20000,
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Staf HRIS',
        [
          { name: 'Nama Lengkap*', required: true, desc: 'Nama lengkap pegawai sesuai KTP.' },
          { name: 'Username*', required: true, desc: 'Username unik huruf kecil tanpa spasi untuk login ke sistem POS.' },
          { name: 'Password Sementara*', required: true, desc: 'Kata sandi awal untuk staf (minimal 6 karakter).' },
          { name: 'Peran Sistem*', required: true, desc: 'Peran: OWNER, MANAGER, CASHIER, BARISTA, KITCHEN.' },
        ],
        ['Username harus unik dan belum pernah dipakai oleh akun lain di outlet.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

      const wsRole = buildReferenceSheet(
        ['Peran Sistem', 'Hak Akses'],
        [
          { 'Peran Sistem': 'OWNER', 'Hak Akses': 'Seluruh fitur outlet, laporan finansial P&L, bot setting, HRIS' },
          { 'Peran Sistem': 'MANAGER', 'Hak Akses': 'Katalog produk, manajemen stok, resep BOM, laporan operasional' },
          { 'Peran Sistem': 'CASHIER', 'Hak Akses': 'Transaksi kasir POS, buka/tutup sesi laci kas, refund' },
          { 'Peran Sistem': 'BARISTA', 'Hak Akses': 'Layar antrean pesanan minuman (BDS), absensi kehadiran' },
          { 'Peran Sistem': 'KITCHEN', 'Hak Akses': 'Layar antrean pesanan makanan (KDS), absensi kehadiran' },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsRole, 'Data Peran & Hak Akses');
      return wb;
    },
  },

  // 6. Jadwal Sif
  {
    fileName: 'template_import_jadwal_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Username Pegawai*', wch: 20 },
          { name: 'Tanggal Kerja* (YYYY-MM-DD)', wch: 26 },
          { name: 'Nama Sif*', wch: 16 },
          { name: 'Jam Masuk* (HH:mm)', wch: 20 },
          { name: 'Jam Selesai* (HH:mm)', wch: 20 },
          { name: 'Catatan Sif', wch: 35 },
        ],
        [
          {
            'Username Pegawai*': 'fajar.barista',
            'Tanggal Kerja* (YYYY-MM-DD)': '2026-10-15',
            'Nama Sif*': 'PAGI',
            'Jam Masuk* (HH:mm)': '08:00',
            'Jam Selesai* (HH:mm)': '16:00',
            'Catatan Sif': 'Buka outlet & kalibrasi mesin grinder',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Jadwal Sif',
        [
          { name: 'Username Pegawai*', required: true, desc: 'Username staf yang sudah terdaftar.' },
          { name: 'Tanggal Kerja*', required: true, desc: 'Format tanggal kerja YYYY-MM-DD.' },
          { name: 'Nama Sif*', required: true, desc: 'Label shift kerja: PAGI, SIANG, MALAM.' },
          { name: 'Jam Masuk*', required: true, desc: 'Jam mulai kerja format HH:mm.' },
          { name: 'Jam Selesai*', required: true, desc: 'Jam selesai kerja format HH:mm.' },
        ],
        ['Pastikan username pegawai sudah terdaftar di sistem HRIS sebelum membuat jadwal.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
      return wb;
    },
  },

  // 7. Presensi
  {
    fileName: 'template_import_absensi_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Username Pegawai*', wch: 20 },
          { name: 'Tanggal* (YYYY-MM-DD)', wch: 24 },
          { name: 'Waktu Masuk* (HH:mm)', wch: 22 },
          { name: 'Waktu Pulang (HH:mm)', wch: 22 },
          { name: 'Status Kehadiran', wch: 18 },
          { name: 'Catatan Kehadiran', wch: 32 },
        ],
        [
          {
            'Username Pegawai*': 'fajar.barista',
            'Tanggal* (YYYY-MM-DD)': '2026-10-14',
            'Waktu Masuk* (HH:mm)': '07:55',
            'Waktu Pulang (HH:mm)': '16:05',
            'Status Kehadiran': 'PRESENT',
            'Catatan Kehadiran': 'Tepat waktu sif pagi',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Presensi',
        [
          { name: 'Username Pegawai*', required: true, desc: 'Username pegawai terdaftar.' },
          { name: 'Tanggal*', required: true, desc: 'Format YYYY-MM-DD (contoh: 2026-10-14).' },
          { name: 'Waktu Masuk*', required: true, desc: 'Format jam masuk HH:mm.' },
          { name: 'Waktu Pulang', required: false, desc: 'Format jam pulang HH:mm.' },
          { name: 'Status Kehadiran', required: false, desc: 'Pilihan: PRESENT, LATE, PERMIT, SICK.' },
        ],
        ['Digunakan untuk pencatatan riwayat presensi retroaktif atau migrasi data absen manual.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
      return wb;
    },
  },

  // 8. Pembelian Inbound
  {
    fileName: 'template_import_pembelian_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Nama Pemasok / Supplier*', wch: 28 },
          { name: 'Nomor Faktur / Surat Jalan', wch: 26 },
          { name: 'Tanggal Pembelian*', wch: 22 },
          { name: 'Nama Bahan Baku*', wch: 30 },
          { name: 'Jumlah Masuk (Qty)*', wch: 20 },
          { name: 'Harga Beli Satuan (Rp)*', wch: 24 },
          { name: 'Catatan Pembelian', wch: 32 },
        ],
        [
          {
            'Nama Pemasok / Supplier*': 'PT Sukses Mandiri Kopi',
            'Nomor Faktur / Surat Jalan': 'INV-2026/X/889',
            'Tanggal Pembelian*': '2026-10-14',
            'Nama Bahan Baku*': 'Biji Kopi House Blend Arabica',
            'Jumlah Masuk (Qty)*': 10000,
            'Harga Beli Satuan (Rp)*': 240,
            'Catatan Pembelian': 'Beli kemasan karton 10kg',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Pembelian & Inbound',
        [
          { name: 'Nama Pemasok / Supplier*', required: true, desc: 'Nama vendor atau pemasok bahan.' },
          { name: 'Nomor Faktur / Surat Jalan', required: false, desc: 'Nomor invoice fisik atau delivery order.' },
          { name: 'Tanggal Pembelian*', required: true, desc: 'Format YYYY-MM-DD saat bahan diterima.' },
          { name: 'Nama Bahan Baku*', required: true, desc: 'Nama bahan baku yang terdaftar di menu Sumber Persediaan.' },
          { name: 'Jumlah Masuk (Qty)*', required: true, desc: 'Kuantitas bahan masuk dalam satuan terkecil.' },
          { name: 'Harga Beli Satuan (Rp)*', required: true, desc: 'Harga modal beli per satuan barang masuk.' },
        ],
        ['Impor ini akan otomatis menambah stok bahan baku di gudang dan mencatat kartu stok.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
      return wb;
    },
  },

  // 9. Stock Opname
  {
    fileName: 'template_import_opname_komazi.xlsx',
    build: () => {
      const wb = XLSX.utils.book_new();
      const wsData = buildDataSheet(
        [
          { name: 'Nama Bahan Baku*', wch: 32 },
          { name: 'Jumlah Fisik Riil*', wch: 20 },
          { name: 'Alasan Selisih / Kategori', wch: 26 },
          { name: 'Catatan Penyesuaian', wch: 35 },
        ],
        [
          {
            'Nama Bahan Baku*': 'Biji Kopi House Blend Arabica',
            'Jumlah Fisik Riil*': 4850,
            'Alasan Selisih / Kategori': 'WASTE',
            'Catatan Penyesuaian': 'Tumpah 150 gram saat kalibrasi grinder',
          },
        ]
      );
      XLSX.utils.book_append_sheet(wb, wsData, 'Data');

      const wsPetunjuk = buildInstructionSheet(
        'Template Impor Stock Opname',
        [
          { name: 'Nama Bahan Baku*', required: true, desc: 'Nama bahan baku yang terdaftar di menu Sumber Persediaan.' },
          { name: 'Jumlah Fisik Riil*', required: true, desc: 'Hasil hitung fisik aktual di gudang/bar saat opname.' },
          { name: 'Alasan Selisih / Kategori', required: false, desc: 'Pilihan: WASTE (rusak/basi/tumpah), EXPIRED, SYSTEM_ADJUSTMENT.' },
        ],
        ['Stok di sistem akan langsung disesuaikan dengan nilai "Jumlah Fisik Riil" yang Anda unggah.']
      );
      XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
      return wb;
    },
  },
];

templateBuilders.forEach(({ fileName, build }) => {
  const wb = build();
  targets.forEach((targetDir) => {
    if (fs.existsSync(targetDir)) {
      const filePath = path.join(targetDir, fileName);
      XLSX.writeFile(wb, filePath);
      console.log(`Generated styled template: ${filePath}`);
    }
  });
});

console.log('All 9 styled Excel templates successfully created!');
