import XLSX from 'xlsx-js-style';
import { saveWorkbook, saveBlobFile } from './fileSaver.js';

export { saveWorkbook, saveBlobFile };

/**
 * Excel Palette & Styling Tokens
 * Meniru template Excel resmi Komazi: Dark Forest Green (#105932),
 * border halus, tipografi rapi, dan auto-filter.
 */
export const EXCEL_STYLES = {
  // Header tabel data utama (Dark Forest Green)
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
  // Judul sheet Petunjuk
  title: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '105932' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  // Subjudul (e.g. Catatan)
  subtitle: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  // Sel data biasa
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
  // Baris genap sel data (Zebra striping halus)
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
  // Badge WAJIB di sheet petunjuk
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
  // Badge Opsional / Tidak di sheet petunjuk
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
  // Teks penjelasan petunjuk
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
  // Baris catatan poin-poin
  bulletText: {
    font: { name: 'Calibri', sz: 10.5, color: { rgb: '374151' } },
    alignment: { vertical: 'center', horizontal: 'left' },
  },
};

/**
 * Konversi indeks kolom angka ke huruf Excel (0 -> 'A', 1 -> 'B', 25 -> 'Z', 26 -> 'AA')
 */
export function getColumnLetter(colIndex) {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Ekspor array of objects ke file Excel (.xlsx) dengan styling premium dark green
 */
export function exportToExcel(data, fileName = 'export.xlsx', sheetName = 'Sheet1', options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data untuk ekspor kosong');
  }

  const wb = XLSX.utils.book_new();
  const headers = Object.keys(data[0]);

  // Bangun grid AOA (Array of Arrays)
  const sheetData = [headers];
  data.forEach((item) => {
    sheetData.push(headers.map((h) => (item[h] !== undefined && item[h] !== null ? item[h] : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Kalkulasi lebar kolom otomatis yang proporsional
  const cols = headers.map((h) => {
    let maxLen = h.length;
    data.slice(0, 100).forEach((item) => {
      const valStr = String(item[h] ?? '');
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
  });
  ws['!cols'] = cols;
  ws['!rows'] = [{ hpt: 26 }]; // Tinggi header

  // Beri style pada baris header (Baris 1)
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}1`;
    if (ws[cellRef]) {
      ws[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Beri style pada baris data & format angka/teks
  data.forEach((item, rowIdx) => {
    const rowNum = rowIdx + 2;
    const isEven = rowIdx % 2 === 0;
    const baseStyle = isEven ? EXCEL_STYLES.cell : EXCEL_STYLES.cellZebra;

    headers.forEach((h, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${rowNum}`;
      if (ws[cellRef]) {
        const val = item[h];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...baseStyle,
          alignment: {
            vertical: 'center',
            horizontal: isNum ? 'right' : 'left',
          },
        };
      }
    });
  });

  // Pasang AutoFilter pada rentang tabel
  const lastColLetter = getColumnLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastColLetter}${data.length + 1}` };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  saveWorkbook(wb, fileName);
}

/**
 * Helper pembangun sheet Petunjuk sesuai design screenshot
 */
function buildInstructionSheet(title, guideColumns, notes = []) {
  // Baris 1: Judul
  // Baris 2: Kosong
  // Baris 3: Header tabel Petunjuk [Nama Kolom, Wajib?, Penjelasan]
  // Baris 4+: Daftar kolom
  // Baris berikutnya: Kosong
  // Baris Catatan: 'Catatan'
  // Baris berikutnya: Poin-poin catatan
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

  // Atur lebar kolom Petunjuk
  ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 80 }];

  // Atur tinggi baris
  ws['!rows'] = [
    { hpt: 26 }, // Row 1 (Judul)
    { hpt: 12 }, // Row 2 (Pemisah)
    { hpt: 24 }, // Row 3 (Header tabel)
  ];

  // Style Cell A1 (Judul)
  if (ws['A1']) {
    ws['A1'].s = EXCEL_STYLES.title;
  }

  // Style Header Tabel Petunjuk (Row 3: A3, B3, C3)
  ['A3', 'B3', 'C3'].forEach((cell) => {
    if (ws[cell]) {
      ws[cell].s = EXCEL_STYLES.header;
    }
  });

  // Style baris-baris penjelasan
  guideColumns.forEach((col, idx) => {
    const rowNum = idx + 4;
    const cellA = `A${rowNum}`;
    const cellB = `B${rowNum}`;
    const cellC = `C${rowNum}`;

    if (ws[cellA]) {
      ws[cellA].s = {
        ...EXCEL_STYLES.cell,
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } },
      };
    }
    if (ws[cellB]) {
      ws[cellB].s = col.required ? EXCEL_STYLES.wajibBadge : EXCEL_STYLES.opsionalBadge;
    }
    if (ws[cellC]) {
      ws[cellC].s = EXCEL_STYLES.guideText;
    }
  });

  // Style Catatan Header
  const catatanRowNum = guideColumns.length + 5;
  const cellCatatan = `A${catatanRowNum}`;
  if (ws[cellCatatan]) {
    ws[cellCatatan].s = EXCEL_STYLES.subtitle;
  }

  // Style Bullet notes
  notes.forEach((_, nIdx) => {
    const rowNum = catatanRowNum + 1 + nIdx;
    const cellNote = `A${rowNum}`;
    if (ws[cellNote]) {
      ws[cellNote].s = EXCEL_STYLES.bulletText;
    }
  });

  return ws;
}

/**
 * Helper pembangun sheet Data Pengisian (Sheet 1) dengan Dark Green Header & Contoh Baris
 */
function buildDataSheet(columns, exampleRows = []) {
  const headers = columns.map((c) => c.name);
  const aoa = [headers];

  exampleRows.forEach((row) => {
    aoa.push(headers.map((h) => (row[h] !== undefined ? row[h] : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Lebar kolom
  ws['!cols'] = columns.map((c) => ({ wch: c.wch || Math.max(c.name.length + 4, 16) }));
  ws['!rows'] = [{ hpt: 26 }];

  // Style Header
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}1`;
    if (ws[cellRef]) {
      ws[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Style Contoh baris
  exampleRows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    headers.forEach((h, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${rowNum}`;
      if (ws[cellRef]) {
        const val = row[h];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...EXCEL_STYLES.cell,
          alignment: {
            vertical: 'center',
            horizontal: isNum ? 'right' : 'left',
          },
        };
      }
    });
  });

  // AutoFilter
  const lastColLetter = getColumnLetter(headers.length - 1);
  const filterEndRow = Math.max(exampleRows.length + 1, 2);
  ws['!autofilter'] = { ref: `A1:${lastColLetter}${filterEndRow}` };

  return ws;
}

/**
 * Helper pembangun sheet Referensi Data Terdaftar (Sheet 3/4)
 */
function buildReferenceSheet(headers, rows = []) {
  const aoa = [headers];
  rows.forEach((r) => {
    aoa.push(headers.map((h) => (r[h] !== undefined && r[h] !== null ? r[h] : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto lebar kolom
  ws['!cols'] = headers.map((h) => {
    let maxLen = h.length;
    rows.slice(0, 50).forEach((r) => {
      const s = String(r[h] ?? '');
      if (s.length > maxLen) maxLen = s.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 40) };
  });
  ws['!rows'] = [{ hpt: 24 }];

  // Style Header
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}1`;
    if (ws[cellRef]) {
      ws[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Style Data rows
  rows.forEach((r, rowIdx) => {
    const rowNum = rowIdx + 2;
    const isEven = rowIdx % 2 === 0;
    const baseStyle = isEven ? EXCEL_STYLES.cell : EXCEL_STYLES.cellZebra;

    headers.forEach((h, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${rowNum}`;
      if (ws[cellRef]) {
        const val = r[h];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...baseStyle,
          alignment: {
            vertical: 'center',
            horizontal: isNum ? 'right' : 'left',
          },
        };
      }
    });
  });

  // AutoFilter
  const lastColLetter = getColumnLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastColLetter}${Math.max(rows.length + 1, 2)}` };

  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEMPLATE RESEP PRODUK (BOM) — Persis seperti screenshot pengguna
// ─────────────────────────────────────────────────────────────────────────────
export function downloadRecipeTemplate(options = {}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data (Persis Image 1)
  const columns = [
    { name: 'SKU Produk*', wch: 18 },
    { name: 'Nama Varian', wch: 18 },
    { name: 'Nama Sumber Persediaan*', wch: 30 },
    { name: 'Jumlah per 1 Produk*', wch: 22 },
  ];
  const exampleRows = [
    {
      'SKU Produk*': 'SKU-001',
      'Nama Varian': '',
      'Nama Sumber Persediaan*': 'Gula Pasir',
      'Jumlah per 1 Produk*': 0.05,
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  // Sheet 2: Petunjuk (Persis Image 2)
  const guideColumns = [
    {
      name: 'SKU Produk*',
      required: true,
      desc: 'SKU produk yang memakai resep ini. Semua baris dengan SKU sama = satu resep.',
    },
    {
      name: 'Nama Varian',
      required: false,
      desc: 'Kosongkan = berlaku untuk SEMUA varian. Diisi = TAMBAHAN khusus varian itu, di atas baris yang kosong (bukan pengganti).',
    },
    {
      name: 'Nama Sumber Persediaan*',
      required: true,
      desc: 'Nama sumber persediaan yang sudah terdaftar di menu Sumber Persediaan (lihat sheet "Data Sumber Persediaan").',
    },
    {
      name: 'Jumlah per 1 Produk*',
      required: true,
      desc: 'Pemakaian untuk 1 produk, dalam satuan sumber persediaan itu. Contoh: 0.05 (kg), 18 (gram), 120 (ml).',
    },
  ];
  const notes = [
    'HAPUS atau TIMPA baris 2 sebelum mengunggah. Baris itu hanya contoh, tapi kalau dibiarkan ia ikut jadi resep untuk produk SKU-001.',
    'Satu baris = satu sumber persediaan. Untuk resep dengan 3 sumber persediaan, tulis 3 baris dengan SKU Produk yang sama.',
    'Baris ber-Nama Varian bersifat MENAMBAH: saat varian itu terjual, pemakaiannya = baris tanpa varian + baris varian tersebut. Jangan mengulang bahan yang sudah ditulis tanpa varian, atau bahan itu terpotong dua kali.',
    'Impor resep MENGGANTI seluruh resep produk tersebut.',
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Resep', guideColumns, notes);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  // Sheet 3: Data Produk (Persis Image 3)
  const liveProducts = options.products || [];
  const productRows = liveProducts.length > 0
    ? liveProducts.map((p) => ({
        'SKU Produk': p.sku || `PRD-${p.id}`,
        'Nama Produk': p.name,
        'Nama Varian': Array.isArray(p.variants) && p.variants.length > 0 ? p.variants.map((v) => v.name).join(', ') : '',
        'Kategori': p.category?.name || p.categoryName || '-',
        'Aktif?': p.isActive !== false ? 'ya' : 'tidak',
        'Lacak Stok?': p.trackStock ? 'ya' : 'tidak',
      }))
    : [
        {
          'SKU Produk': 'SA-01',
          'Nama Produk': 'Sanger Espresso',
          'Nama Varian': 'Ice, Hot',
          'Kategori': 'Coffee',
          'Aktif?': 'ya',
          'Lacak Stok?': 'ya',
        },
        {
          'SKU Produk': 'KMZ-02',
          'Nama Produk': 'Croissant Butter Paris',
          'Nama Varian': '',
          'Kategori': 'Bakery',
          'Aktif?': 'ya',
          'Lacak Stok?': 'ya',
        },
      ];
  const wsProduk = buildReferenceSheet(
    ['SKU Produk', 'Nama Produk', 'Nama Varian', 'Kategori', 'Aktif?', 'Lacak Stok?'],
    productRows
  );
  XLSX.utils.book_append_sheet(wb, wsProduk, 'Data Produk');

  // Sheet 4: Data Sumber Persediaan (Persis Image 4)
  const liveIngredients = options.ingredients || [];
  const ingredientRows = liveIngredients.length > 0
    ? liveIngredients.map((i) => ({
        'Nama Sumber Persediaan': i.name,
        'Satuan': i.unit,
        'Jumlah Stok': Number(i.stock || 0),
        'Stok Minimum': Number(i.minStock || 0),
        'Harga per Satuan': Number(i.costPerUnit || 0),
        'Lacak Stok?': 'ya',
        'Aktif?': i.isActive !== false ? 'ya' : 'tidak',
      }))
    : [
        {
          'Nama Sumber Persediaan': 'Biji Kopi House Blend Arabica',
          'Satuan': 'gram',
          'Jumlah Stok': 5000,
          'Stok Minimum': 1000,
          'Harga per Satuan': 250,
          'Lacak Stok?': 'ya',
          'Aktif?': 'ya',
        },
        {
          'Nama Sumber Persediaan': 'Fresh Milk Pasteurisasi',
          'Satuan': 'ml',
          'Jumlah Stok': 15000,
          'Stok Minimum': 3000,
          'Harga per Satuan': 22,
          'Lacak Stok?': 'ya',
          'Aktif?': 'ya',
        },
        {
          'Nama Sumber Persediaan': 'Gula Pasir',
          'Satuan': 'kg',
          'Jumlah Stok': 25,
          'Stok Minimum': 5,
          'Harga per Satuan': 17500,
          'Lacak Stok?': 'ya',
          'Aktif?': 'ya',
        },
      ];
  const wsBahan = buildReferenceSheet(
    ['Nama Sumber Persediaan', 'Satuan', 'Jumlah Stok', 'Stok Minimum', 'Harga per Satuan', 'Lacak Stok?', 'Aktif?'],
    ingredientRows
  );
  XLSX.utils.book_append_sheet(wb, wsBahan, 'Data Sumber Persediaan');

  saveWorkbook(wb, 'template_import_resep_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEMPLATE MENU & PRODUK
// ─────────────────────────────────────────────────────────────────────────────
export function downloadMenuTemplate(options = {}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data
  const columns = [
    { name: 'SKU', wch: 16 },
    { name: 'Nama Produk*', wch: 28 },
    { name: 'Kategori*', wch: 18 },
    { name: 'Harga Jual*', wch: 16 },
    { name: 'HPP / Modal (Rp)', wch: 18 },
    { name: 'Resep / Bahan Baku (Opsional)', wch: 38 },
    { name: 'Harga Dinamis?', wch: 16 },
    { name: 'Batas Harga Minimum', wch: 22 },
    { name: 'Deskripsi', wch: 35 },
    { name: 'Varian', wch: 20 },
    { name: 'Harga Varian', wch: 20 },
    { name: 'Stasiun Dapur', wch: 16 },
  ];
  const exampleRows = [
    {
      'SKU': 'KMZ-CF-001',
      'Nama Produk*': 'Kopi Susu Aren Signature',
      'Kategori*': 'Coffee',
      'Harga Jual*': 22000,
      'HPP / Modal (Rp)': 7500,
      'Resep / Bahan Baku (Opsional)': 'Kopi Biji: 18 gram, Susu Fresh: 150 ml, Gula Aren: 20 ml',
      'Harga Dinamis?': 'tidak',
      'Batas Harga Minimum': 0,
      'Deskripsi': 'Espresso double shot dengan fresh milk dan gula aren asli',
      'Varian': 'Ice, Hot',
      'Harga Varian': '22000, 20000',
      'Stasiun Dapur': 'BAR',
    },
    {
      'SKU': 'KMZ-CAT-001',
      'Nama Produk*': 'Paket Prasmanan Custom / Katering',
      'Kategori*': 'Main Course',
      'Harga Jual*': 35000,
      'HPP / Modal (Rp)': 16500,
      'Resep / Bahan Baku (Opsional)': '',
      'Harga Dinamis?': 'ya',
      'Batas Harga Minimum': 25000,
      'Deskripsi': 'Menu fleksibel untuk pesanan katering, bazar, atau acara khusus',
      'Varian': '',
      'Harga Varian': '',
      'Stasiun Dapur': 'KITCHEN',
    },
    {
      'SKU': 'KMZ-BK-001',
      'Nama Produk*': 'Croissant Butter Paris',
      'Kategori*': 'Bakery',
      'Harga Jual*': 28000,
      'HPP / Modal (Rp)': 11000,
      'Resep / Bahan Baku (Opsional)': '',
      'Harga Dinamis?': 'tidak',
      'Batas Harga Minimum': 0,
      'Deskripsi': 'Pastry renyah dengan butter Prancis premium',
      'Varian': '',
      'Harga Varian': '',
      'Stasiun Dapur': 'KITCHEN',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  // Sheet 2: Petunjuk
  const guideColumns = [
    { name: 'SKU', required: false, desc: 'Kode SKU unik produk. Kosongkan jika ingin dibuatkan otomatis oleh sistem.' },
    { name: 'Nama Produk*', required: true, desc: 'Nama resmi produk yang akan tampil pada katalog kasir POS dan struk transaksi.' },
    { name: 'Kategori*', required: true, desc: 'Kategori menu (contoh: Coffee, Non-Coffee, Bakery). Lihat sheet "Data Kategori".' },
    { name: 'Harga Jual*', required: true, desc: 'Harga jual dasar dalam Rupiah (angka bulat). Untuk menu harga dinamis, ini berlaku sebagai harga acuan/saran.' },
    { name: 'HPP / Modal (Rp)', required: false, desc: 'Biaya modal per porsi (angka bulat). Jika diisi, sistem otomatis menghitung HPP & margin laba kotor produk.' },
    { name: 'Resep / Bahan Baku (Opsional)', required: false, desc: 'Daftar bahan baku dan takaran (format: "Nama Bahan: Takaran Satuan", pisahkan koma). Contoh: "Kopi Biji: 18 gram, Susu Fresh: 150 ml". Jika bahan terdaftar di sistem, HPP dihitung otomatis dari harga persediaan.' },
    { name: 'Harga Dinamis?', required: false, desc: 'Isi "ya" jika harga ditentukan kasir saat transaksi di kasir POS. Kosongkan atau isi "tidak" untuk harga tetap.' },
    { name: 'Batas Harga Minimum', required: false, desc: 'Batas nominal terendah yang boleh diinput kasir untuk menu harga dinamis (contoh: 25000). Kosongkan jika tanpa batas.' },
    { name: 'Deskripsi', required: false, desc: 'Keterangan bahan atau catatan rasa untuk panduan kasir.' },
    { name: 'Varian', required: false, desc: 'Daftar nama varian dipisahkan tanda koma (contoh: Regular, Large atau Hot, Ice).' },
    { name: 'Harga Varian', required: false, desc: 'Harga masing-masing varian berurutan sesuai kolom Varian (contoh: 22000, 25000).' },
    { name: 'Stasiun Dapur', required: false, desc: 'Tujuan tiket pesanan dicetak/ditampilkan: "BAR" (barista) atau "KITCHEN" (dapur).' },
  ];
  const notes = [
    'HAPUS atau TIMPA baris contoh sebelum mengunggah. Baris tersebut hanya data contoh.',
    'Perhitungan HPP dapat dilakukan melalui 2 cara: (1) Masukkan langsung angka pada kolom "HPP / Modal (Rp)", atau (2) Tuliskan resep pada kolom "Resep / Bahan Baku", sistem akan otomatis menghitung HPP dari harga modal bahan baku.',
    'Untuk menu Harga Dinamis ("ya"), kasir di layar POS akan otomatis diminta memasukkan nominal harga dengan perlindungan batas minimum.',
    'Kategori yang belum terdaftar di sistem akan dibuat secara otomatis saat proses impor berhasil.',
    'Jangan sertakan simbol "Rp" atau pemisah ribuan pada kolom harga agar validasi angka berjalan akurat.',
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Menu Produk', guideColumns, notes);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  // Sheet 3: Data Kategori Terdaftar
  const liveCategories = options.categories || [];
  const catRows = liveCategories.length > 0
    ? liveCategories.map((c) => ({
        'Nama Kategori': c.name,
        'Deskripsi': c.description || '-',
        'Jumlah Produk': Number(c.productsCount || c._count?.products || 0),
      }))
    : [
        { 'Nama Kategori': 'Coffee', 'Deskripsi': 'Minuman berbasis espresso & manual brew', 'Jumlah Produk': 12 },
        { 'Nama Kategori': 'Non-Coffee', 'Deskripsi': 'Matcha, cokelat, teh artisan & susu', 'Jumlah Produk': 8 },
        { 'Nama Kategori': 'Bakery', 'Deskripsi': 'Croissant, toast & pastry segar', 'Jumlah Produk': 5 },
        { 'Nama Kategori': 'Main Course', 'Deskripsi': 'Makanan berat dan rice bowl', 'Jumlah Produk': 6 },
      ];
  const wsCat = buildReferenceSheet(['Nama Kategori', 'Deskripsi', 'Jumlah Produk'], catRows);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Data Kategori');

  // Sheet 4: Data Bahan Baku Terdaftar
  const liveIngredients = options.ingredients || [];
  const ingRows = liveIngredients.length > 0
    ? liveIngredients.map((ing) => ({
        'Nama Bahan': ing.name,
        'Satuan': ing.unit,
        'Harga Modal per Satuan': Number(ing.costPerUnit || 0),
        'Stok Tersedia': Number(ing.stock || 0),
      }))
    : [
        { 'Nama Bahan': 'Kopi Biji Espresso', 'Satuan': 'gram', 'Harga Modal per Satuan': 220, 'Stok Tersedia': 5000 },
        { 'Nama Bahan': 'Susu Fresh Milk', 'Satuan': 'ml', 'Harga Modal per Satuan': 20, 'Stok Tersedia': 10000 },
        { 'Nama Bahan': 'Gula Aren Cair', 'Satuan': 'ml', 'Harga Modal per Satuan': 30, 'Stok Tersedia': 3000 },
        { 'Nama Bahan': 'Beras Premium', 'Satuan': 'gram', 'Harga Modal per Satuan': 15, 'Stok Tersedia': 25000 },
        { 'Nama Bahan': 'Telur Ayam', 'Satuan': 'pcs', 'Harga Modal per Satuan': 2000, 'Stok Tersedia': 120 },
      ];
  const wsIng = buildReferenceSheet(['Nama Bahan', 'Satuan', 'Harga Modal per Satuan', 'Stok Tersedia'], ingRows);
  XLSX.utils.book_append_sheet(wb, wsIng, 'Data Bahan Baku');

  saveWorkbook(wb, 'template_import_menu_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEMPLATE SUMBER PERSEDIAAN (BAHAN BAKU)
// ─────────────────────────────────────────────────────────────────────────────
export function downloadIngredientTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data
  const columns = [
    { name: 'Nama Bahan*', wch: 30 },
    { name: 'Satuan* (gram/ml/pcs/kg)', wch: 24 },
    { name: 'Stok Awal*', wch: 16 },
    { name: 'Stok Minimum*', wch: 16 },
    { name: 'Harga Modal per Satuan (Rp)*', wch: 26 },
    { name: 'Nama Supplier', wch: 24 },
    { name: 'No WhatsApp Supplier', wch: 22 },
  ];
  const exampleRows = [
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
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  // Sheet 2: Petunjuk
  const guideColumns = [
    { name: 'Nama Bahan*', required: true, desc: 'Nama unik bahan baku atau packaging (contoh: Biji Kopi House Blend, Fresh Milk).' },
    { name: 'Satuan*', required: true, desc: 'Satuan baku: gram, ml, pcs, kg, liter, shot, lembar. Lihat sheet "Daftar Satuan Valid".' },
    { name: 'Stok Awal*', required: true, desc: 'Jumlah kuantitas riil saat ini di gudang/bar (hanya angka).' },
    { name: 'Stok Minimum*', required: true, desc: 'Ambang batas peringatan stok kritis ke bot Telegram & dashboard.' },
    { name: 'Harga Modal per Satuan (Rp)*', required: true, desc: 'HPP modal per satuan terkecil (contoh: Rp 250 per gram).' },
    { name: 'Nama Supplier', required: false, desc: 'Nama mitra pemasok bahan untuk pemesanan restock.' },
    { name: 'No WhatsApp Supplier', required: false, desc: 'Nomor WhatsApp pemasok untuk tombol 1-Click WhatsApp Restock otomatis.' },
  ];
  const notes = [
    'HAPUS atau TIMPA baris contoh sebelum mengunggah file.',
    'Pilihlah satuan ukur yang konsisten dengan takaran resep yang diracik di outlet.',
    'Nomor WhatsApp supplier dapat dimasukkan diawali "08" atau "62". Sistem akan otomatis memformatnya menjadi tautan pesan cepat.',
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Bahan Baku', guideColumns, notes);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  // Sheet 3: Daftar Satuan Valid
  const satuanRows = [
    { 'Satuan Valid': 'gram', 'Jenis Takaran': 'Bobot Kering', 'Contoh Bahan': 'Biji kopi, bubuk cokelat, gula, matcha' },
    { 'Satuan Valid': 'ml', 'Jenis Takaran': 'Cairan / Liquid', 'Contoh Bahan': 'Susu segar, sirup perasa, air mineral' },
    { 'Satuan Valid': 'pcs', 'Jenis Takaran': 'Kemasan / Barang Jadi', 'Contoh Bahan': 'Paper cup, sedotan, lid penutup, kotak kue' },
    { 'Satuan Valid': 'kg', 'Jenis Takaran': 'Bobot Besar', 'Contoh Bahan': 'Beras, tepung terigu, biji kopi karungan' },
    { 'Satuan Valid': 'liter', 'Jenis Takaran': 'Cairan Besar', 'Contoh Bahan': 'Minyak goreng, sirup galon' },
    { 'Satuan Valid': 'shot', 'Jenis Takaran': 'Porsi Espresso', 'Contoh Bahan': 'Espresso shot racikan' },
    { 'Satuan Valid': 'lembar', 'Jenis Takaran': 'Lembaran', 'Contoh Bahan': 'Tisu makan, kantong kresek, stiker logo' },
  ];
  const wsSatuan = buildReferenceSheet(['Satuan Valid', 'Jenis Takaran', 'Contoh Bahan'], satuanRows);
  XLSX.utils.book_append_sheet(wb, wsSatuan, 'Daftar Satuan Valid');

  saveWorkbook(wb, 'template_import_bahan_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEMPLATE PELANGGAN (CRM)
// ─────────────────────────────────────────────────────────────────────────────
export function downloadCustomerTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
    { name: 'Nama Pelanggan*', wch: 26 },
    { name: 'Nomor WhatsApp / HP*', wch: 22 },
    { name: 'Email', wch: 28 },
    { name: 'Poin Awal', wch: 14 },
    { name: 'Tier Member', wch: 16 },
    { name: 'Catatan / Alergi', wch: 32 },
  ];
  const exampleRows = [
    {
      'Nama Pelanggan*': 'Ahmad Rizky Pratama',
      'Nomor WhatsApp / HP*': '081298765432',
      'Email': 'ahmad.rizky@gmail.com',
      'Poin Awal': 50,
      'Tier Member': 'GOLD',
      'Catatan / Alergi': 'Suka kopi double shot manis tipis',
    },
    {
      'Nama Pelanggan*': 'Nadia Salsabila',
      'Nomor WhatsApp / HP*': '085712348899',
      'Email': 'nadia.salsa@yahoo.com',
      'Poin Awal': 10,
      'Tier Member': 'SILVER',
      'Catatan / Alergi': 'Alergi kacang hazelnut',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Nama Pelanggan*', required: true, desc: 'Nama lengkap pelanggan member.' },
    { name: 'Nomor WhatsApp / HP*', required: true, desc: 'Nomor HP unik pelanggan (kunci pencarian utama kasir).' },
    { name: 'Email', required: false, desc: 'Alamat surel pelanggan untuk struk digital.' },
    { name: 'Poin Awal', required: false, desc: 'Saldo poin reward awal pelanggan (angka bulat).' },
    { name: 'Tier Member', required: false, desc: 'Tingkatan member: REGULAR, SILVER, GOLD, VIP. Lihat sheet "Data Tier Member".' },
    { name: 'Catatan / Alergi', required: false, desc: 'Preferensi rasa, pantangan makanan, atau catatan khusus pelanggan.' },
  ];
  const notes = [
    'Nomor WhatsApp / HP tidak boleh duplikat dengan pelanggan yang sudah ada.',
    'Tier default jika dikosongkan adalah REGULAR.',
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Data Pelanggan', guideColumns, notes);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  const tierRows = [
    { 'Kode Tier': 'REGULAR', 'Nama Tier': 'Regular Member', 'Diskon (%)': 0, 'Min Belanja': 0 },
    { 'Kode Tier': 'SILVER', 'Nama Tier': 'Silver Member', 'Diskon (%)': 5, 'Min Belanja': 250000 },
    { 'Kode Tier': 'GOLD', 'Nama Tier': 'Gold Member', 'Diskon (%)': 10, 'Min Belanja': 1000000 },
    { 'Kode Tier': 'VIP', 'Nama Tier': 'VIP Member', 'Diskon (%)': 15, 'Min Belanja': 2500000 },
  ];
  const wsTier = buildReferenceSheet(['Kode Tier', 'Nama Tier', 'Diskon (%)', 'Min Belanja'], tierRows);
  XLSX.utils.book_append_sheet(wb, wsTier, 'Data Tier Member');

  saveWorkbook(wb, 'template_import_pelanggan_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TEMPLATE PEGAWAI & STAF HRIS
// ─────────────────────────────────────────────────────────────────────────────
export function downloadStaffTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
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
  ];
  const exampleRows = [
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
    {
      'Nama Lengkap*': 'Siti Aminah',
      'Username*': 'siti.kasir',
      'Password Sementara*': 'Kasir123!',
      'Peran Sistem*': 'CASHIER',
      'Nomor Telepon / WA': '081233445566',
      'Departemen': 'Kasir',
      'Jabatan': 'Kasir Utama',
      'Status Ikatan Kerja': 'FULL_TIME',
      'Gaji Pokok Bulanan (Rp)': 2800000,
      'Uang Makan Harian (Rp)': 25000,
      'Tarif Lembur per Jam (Rp)': 18000,
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Nama Lengkap*', required: true, desc: 'Nama lengkap pegawai sesuai KTP.' },
    { name: 'Username*', required: true, desc: 'Username unik huruf kecil tanpa spasi untuk login ke sistem POS.' },
    { name: 'Password Sementara*', required: true, desc: 'Kata sandi awal untuk staf (minimal 6 karakter).' },
    { name: 'Peran Sistem*', required: true, desc: 'Peran: OWNER, MANAGER, CASHIER, BARISTA, KITCHEN. Lihat sheet referensi.' },
    { name: 'Nomor Telepon / WA', required: false, desc: 'Nomor WhatsApp aktif staf.' },
    { name: 'Departemen', required: false, desc: 'Divisi kerja: Kasir, Bar & Kopi, Dapur, Operasional.' },
    { name: 'Jabatan', required: false, desc: 'Jabatan atau posisi pegawai.' },
    { name: 'Status Ikatan Kerja', required: false, desc: 'FULL_TIME, PART_TIME, atau INTERN.' },
    { name: 'Gaji Pokok Bulanan (Rp)', required: false, desc: 'Nominal gaji pokok bulanan (angka).' },
    { name: 'Uang Makan Harian (Rp)', required: false, desc: 'Tunjangan uang makan per shift hadir (angka).' },
    { name: 'Tarif Lembur per Jam (Rp)', required: false, desc: 'Kompensasi lembur per jam di luar jam shift (angka).' },
  ];
  const notes = [
    'Username harus unik dan belum pernah dipakai oleh akun lain di outlet.',
    'Password yang diunggah akan otomatis dienkripsi secara aman oleh server.',
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Staf HRIS', guideColumns, notes);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  const roleRows = [
    { 'Peran Sistem': 'OWNER', 'Hak Akses': 'Seluruh fitur outlet, laporan finansial P&L, bot setting, HRIS' },
    { 'Peran Sistem': 'MANAGER', 'Hak Akses': 'Katalog produk, manajemen stok, resep BOM, laporan operasional' },
    { 'Peran Sistem': 'CASHIER', 'Hak Akses': 'Transaksi kasir POS, buka/tutup sesi laci kas, refund' },
    { 'Peran Sistem': 'BARISTA', 'Hak Akses': 'Layar antrean pesanan minuman (BDS), absensi kehadiran' },
    { 'Peran Sistem': 'KITCHEN', 'Hak Akses': 'Layar antrean pesanan makanan (KDS), absensi kehadiran' },
  ];
  const wsRole = buildReferenceSheet(['Peran Sistem', 'Hak Akses'], roleRows);
  XLSX.utils.book_append_sheet(wb, wsRole, 'Data Peran & Hak Akses');

  saveWorkbook(wb, 'template_import_staf_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TEMPLATE JADWAL KERJA SIF
// ─────────────────────────────────────────────────────────────────────────────
export function downloadScheduleTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
    { name: 'Username Pegawai*', wch: 20 },
    { name: 'Tanggal Kerja* (YYYY-MM-DD)', wch: 26 },
    { name: 'Nama Sif*', wch: 16 },
    { name: 'Jam Masuk* (HH:mm)', wch: 20 },
    { name: 'Jam Selesai* (HH:mm)', wch: 20 },
    { name: 'Catatan Sif', wch: 35 },
  ];
  const exampleRows = [
    {
      'Username Pegawai*': 'fajar.barista',
      'Tanggal Kerja* (YYYY-MM-DD)': '2026-10-15',
      'Nama Sif*': 'PAGI',
      'Jam Masuk* (HH:mm)': '08:00',
      'Jam Selesai* (HH:mm)': '16:00',
      'Catatan Sif': 'Buka outlet & kalibrasi mesin grinder',
    },
    {
      'Username Pegawai*': 'siti.kasir',
      'Tanggal Kerja* (YYYY-MM-DD)': '2026-10-15',
      'Nama Sif*': 'SIANG',
      'Jam Masuk* (HH:mm)': '14:00',
      'Jam Selesai* (HH:mm)': '22:00',
      'Catatan Sif': 'Tutup kasir & rekonsiliasi laci kas',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Username Pegawai*', required: true, desc: 'Username staf yang sudah terdaftar. Lihat sheet "Data Pegawai".' },
    { name: 'Tanggal Kerja*', required: true, desc: 'Format tanggal kerja YYYY-MM-DD (contoh: 2026-10-15).' },
    { name: 'Nama Sif*', required: true, desc: 'Label shift kerja: PAGI, SIANG, MALAM, FULL_DAY.' },
    { name: 'Jam Masuk*', required: true, desc: 'Jam mulai kerja format HH:mm (contoh: 08:00).' },
    { name: 'Jam Selesai*', required: true, desc: 'Jam selesai kerja format HH:mm (contoh: 16:00).' },
    { name: 'Catatan Sif', required: false, desc: 'Instruksi khusus penugasan shift.' },
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Jadwal Sif', guideColumns, [
    'Pastikan username pegawai sudah terdaftar di sistem HRIS sebelum membuat jadwal.',
  ]);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  const staffRows = [
    { 'Username': 'fajar.barista', 'Nama Lengkap': 'Fajar Nugraha', 'Peran': 'BARISTA', 'Departemen': 'Bar & Kopi' },
    { 'Username': 'siti.kasir', 'Nama Lengkap': 'Siti Aminah', 'Peran': 'CASHIER', 'Departemen': 'Kasir' },
  ];
  const wsStaff = buildReferenceSheet(['Username', 'Nama Lengkap', 'Peran', 'Departemen'], staffRows);
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Data Pegawai');

  saveWorkbook(wb, 'template_import_jadwal_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. TEMPLATE PRESENSI RETROAKTIF
// ─────────────────────────────────────────────────────────────────────────────
export function downloadAttendanceTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
    { name: 'Username Pegawai*', wch: 20 },
    { name: 'Tanggal* (YYYY-MM-DD)', wch: 24 },
    { name: 'Waktu Masuk* (HH:mm)', wch: 22 },
    { name: 'Waktu Pulang (HH:mm)', wch: 22 },
    { name: 'Status Kehadiran', wch: 18 },
    { name: 'Catatan Kehadiran', wch: 32 },
  ];
  const exampleRows = [
    {
      'Username Pegawai*': 'fajar.barista',
      'Tanggal* (YYYY-MM-DD)': '2026-10-14',
      'Waktu Masuk* (HH:mm)': '07:55',
      'Waktu Pulang (HH:mm)': '16:05',
      'Status Kehadiran': 'PRESENT',
      'Catatan Kehadiran': 'Tepat waktu sif pagi',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Username Pegawai*', required: true, desc: 'Username pegawai terdaftar.' },
    { name: 'Tanggal*', required: true, desc: 'Format YYYY-MM-DD (contoh: 2026-10-14).' },
    { name: 'Waktu Masuk*', required: true, desc: 'Format jam masuk HH:mm (contoh: 07:55).' },
    { name: 'Waktu Pulang', required: false, desc: 'Format jam pulang HH:mm (contoh: 16:05).' },
    { name: 'Status Kehadiran', required: false, desc: 'Pilihan: PRESENT (Hadir), LATE (Terlambat), PERMIT (Izin), SICK (Sakit).' },
    { name: 'Catatan Kehadiran', required: false, desc: 'Alasan atau keterangan kehadiran.' },
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Presensi', guideColumns, [
    'Digunakan untuk pencatatan riwayat presensi retroaktif atau migrasi data absen manual.',
  ]);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  saveWorkbook(wb, 'template_import_absensi_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TEMPLATE PEMBELIAN / INBOUND RESTOCK
// ─────────────────────────────────────────────────────────────────────────────
export function downloadInboundTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
    { name: 'Nama Pemasok / Supplier*', wch: 28 },
    { name: 'Nomor Faktur / Surat Jalan', wch: 26 },
    { name: 'Tanggal Pembelian*', wch: 22 },
    { name: 'Nama Bahan Baku*', wch: 30 },
    { name: 'Jumlah Masuk (Qty)*', wch: 20 },
    { name: 'Harga Beli Satuan (Rp)*', wch: 24 },
    { name: 'Catatan Pembelian', wch: 32 },
  ];
  const exampleRows = [
    {
      'Nama Pemasok / Supplier*': 'PT Sukses Mandiri Kopi',
      'Nomor Faktur / Surat Jalan': 'INV-2026/X/889',
      'Tanggal Pembelian*': '2026-10-14',
      'Nama Bahan Baku*': 'Biji Kopi House Blend Arabica',
      'Jumlah Masuk (Qty)*': 10000,
      'Harga Beli Satuan (Rp)*': 240,
      'Catatan Pembelian': 'Beli kemasan karton 10kg',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Nama Pemasok / Supplier*', required: true, desc: 'Nama vendor atau pemasok bahan.' },
    { name: 'Nomor Faktur / Surat Jalan', required: false, desc: 'Nomor invoice fisik atau delivery order.' },
    { name: 'Tanggal Pembelian*', required: true, desc: 'Format YYYY-MM-DD saat bahan diterima.' },
    { name: 'Nama Bahan Baku*', required: true, desc: 'Nama bahan baku yang terdaftar di menu Sumber Persediaan.' },
    { name: 'Jumlah Masuk (Qty)*', required: true, desc: 'Kuantitas bahan masuk dalam satuan terkecil (gram/ml/pcs).' },
    { name: 'Harga Beli Satuan (Rp)*', required: true, desc: 'Harga modal beli per satuan barang masuk.' },
    { name: 'Catatan Pembelian', required: false, desc: 'Keterangan pengiriman atau kondisi barang.' },
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Pembelian & Inbound', guideColumns, [
    'Impor ini akan otomatis menambah stok bahan baku di gudang dan mencatat riwayat kartu stok.',
  ]);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  saveWorkbook(wb, 'template_import_pembelian_komazi.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TEMPLATE STOCK OPNAME FISIK
// ─────────────────────────────────────────────────────────────────────────────
export function downloadStockOpnameTemplate() {
  const wb = XLSX.utils.book_new();

  const columns = [
    { name: 'Nama Bahan Baku*', wch: 32 },
    { name: 'Jumlah Fisik Riil*', wch: 20 },
    { name: 'Alasan Selisih / Kategori', wch: 26 },
    { name: 'Catatan Penyesuaian', wch: 35 },
  ];
  const exampleRows = [
    {
      'Nama Bahan Baku*': 'Biji Kopi House Blend Arabica',
      'Jumlah Fisik Riil*': 4850,
      'Alasan Selisih / Kategori': 'WASTE',
      'Catatan Penyesuaian': 'Tumpah 150 gram saat kalibrasi grinder',
    },
    {
      'Nama Bahan Baku*': 'Fresh Milk Pasteurisasi Greenfield',
      'Jumlah Fisik Riil*': 14500,
      'Alasan Selisih / Kategori': 'WASTE',
      'Catatan Penyesuaian': '1 kotak kemasan bocor dari supplier',
    },
  ];
  const wsData = buildDataSheet(columns, exampleRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  const guideColumns = [
    { name: 'Nama Bahan Baku*', required: true, desc: 'Nama bahan baku yang terdaftar di menu Sumber Persediaan.' },
    { name: 'Jumlah Fisik Riil*', required: true, desc: 'Hasil hitung fisik aktual di gudang/bar saat opname.' },
    { name: 'Alasan Selisih / Kategori', required: false, desc: 'Pilihan: WASTE (rusak/basi/tumpah), EXPIRED, SYSTEM_ADJUSTMENT.' },
    { name: 'Catatan Penyesuaian', required: false, desc: 'Keterangan penyebab selisih fisik dengan sistem.' },
  ];
  const wsPetunjuk = buildInstructionSheet('Template Impor Stock Opname', guideColumns, [
    'Stok di sistem akan langsung disesuaikan dengan nilai "Jumlah Fisik Riil" yang Anda unggah.',
  ]);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

  saveWorkbook(wb, 'template_import_opname_komazi.xlsx');
}

/**
 * Parse File (.xlsx, .xls, .csv) ke Array of JSON
 * Otomatis mendeteksi dan memprioritaskan sheet 'Data' dari template multi-sheet.
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Prioritas: gunakan sheet 'Data' jika ada (format template multi-sheet resmi),
        // jika tidak ada, gunakan sheet pertama (kompatibilitas file legacy / custom).
        let targetSheetName = workbook.SheetNames.find(
          (s) => s.trim().toLowerCase() === 'data'
        );
        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames[0];
        }

        if (!targetSheetName) {
          throw new Error('File Excel tidak memiliki sheet data yang valid.');
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Ekspor Riwayat Pesanan ke file Excel (.xlsx) dengan styling premium
 * Mengikuti filter yang sedang aktif di halaman
 *
 * @param {Object} params
 * @param {Array} params.orders - Array pesanan terfilter
 * @param {Object} params.filterMeta - Metadata filter aktif (status, method, dateRange, cashier, shift, search)
 * @param {string} params.storeName - Nama outlet/usaha
 */
export function exportOrdersToExcel({
  orders = [],
  filterMeta = {},
  storeName = 'Komazi Coffee & Workspace',
}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('Tidak ada data pesanan untuk diekspor.');
  }

  const wb = XLSX.utils.book_new();

  // 1. Hitung Statistik Ringkasan
  let totalRevenue = 0;
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalItemsCount = 0;
  let paidCount = 0;
  let voidCount = 0;
  let refundCount = 0;

  orders.forEach((o) => {
    const total = Number(o.total || 0);
    const sub = Number(o.subtotal || 0);
    const disc = Number(o.discount || 0);
    const tax = Number(o.tax || 0);
    const qty = (o.items || []).reduce((sum, it) => sum + (Number(it.qty ?? it.quantity ?? 1) || 1), 0);

    totalSubtotal += sub;
    totalDiscount += disc;
    totalTax += tax;
    totalItemsCount += qty;

    if (o.status === 'PAID') {
      totalRevenue += total;
      paidCount++;
    } else if (o.status === 'VOIDED') {
      voidCount++;
    } else if (o.status === 'REFUNDED') {
      refundCount++;
    }
  });

  // 2. Baris Judul & Metadata
  const nowStr = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const filterSegments = [
    filterMeta.status && filterMeta.status !== 'ALL' ? `Status: ${filterMeta.status}` : 'Status: Semua',
    filterMeta.method && filterMeta.method !== 'ALL' ? `Metode: ${filterMeta.method}` : 'Metode: Semua',
    filterMeta.dateRange ? `Periode: ${filterMeta.dateRange}` : 'Periode: Semua Tanggal',
    filterMeta.cashier && filterMeta.cashier !== 'ALL' ? `Kasir: ${filterMeta.cashier}` : null,
    filterMeta.shift && filterMeta.shift !== 'ALL' ? `Shift: ${filterMeta.shift}` : null,
    filterMeta.search ? `Cari: "${filterMeta.search}"` : null,
  ].filter(Boolean);

  const titleRow = [`${storeName.toUpperCase()} - RIWAYAT TRANSAKSI PESANAN`];
  const metaRow = [`Filter Aktif: ${filterSegments.join(' | ')}`];
  const kpiRow = [
    `Total: ${orders.length} Transaksi | Berhasil (Lunas): ${paidCount} (Omzet: Rp ${totalRevenue.toLocaleString('id-ID')}) | Batal: ${voidCount} | Refund: ${refundCount} | Diunduh: ${nowStr} WIB`,
  ];
  const emptyRow = [];

  // 3. Header Tabel
  const headers = [
    'No',
    'No. Invoice',
    'Waktu Transaksi (WIB)',
    'Status',
    'Tipe Pesanan',
    'Meja',
    'Pelanggan',
    'Kasir',
    'Shift',
    'Rincian Menu Pesanan',
    'Total Qty',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    'Metode Pembayaran',
    'Catatan / Alasan',
  ];

  // 4. Data Rows
  const dataRows = orders.map((o, idx) => {
    const waktu = o.createdAt
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(new Date(o.createdAt)).replace(/\./g, ':')
      : '-';

    let statusLabel = o.status;
    if (o.status === 'PAID') statusLabel = 'LUNAS';
    else if (o.status === 'VOIDED') statusLabel = 'DIBATALKAN';
    else if (o.status === 'REFUNDED') statusLabel = 'REFUND';
    else if (o.status === 'OPEN') statusLabel = 'BELUM DIBAYAR';

    const orderType =
      o.type === 'TAKE_AWAY' || o.type === 'TAKEAWAY'
        ? 'Take-Away'
        : o.type === 'DELIVERY'
        ? 'Delivery'
        : 'Dine-In';

    const tableNo = o.tableNo ? `Meja ${o.tableNo}` : '-';
    const customer = o.customerName || o.customer?.name || 'Pelanggan Dine In';
    const cashier = o.cashierName || o.cashier?.name || o.shift?.cashier?.name || '-';
    const shift = o.shiftId ? `#${o.shiftId}` : '-';

    const itemsSummary =
      (o.items || [])
        .map((it) => {
          const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
          const name = it.product?.name || it.productName || it.name || 'Item';
          const variantName = it.variantName || it.variant?.name;
          const variant = variantName ? ` (${variantName})` : '';
          return `${qty}x ${name}${variant}`;
        })
        .join(', ') || '-';

    const totalQty = (o.items || []).reduce((sum, it) => sum + (Number(it.qty ?? it.quantity ?? 1) || 1), 0);

    const paymentMethod = o.payments?.[0]?.method || o.paymentMethod || 'CASH';
    let formattedMethod = paymentMethod;
    if (paymentMethod === 'CASH') formattedMethod = 'Tunai (Cash)';
    else if (paymentMethod === 'TRANSFER') formattedMethod = 'Transfer Bank';
    else if (paymentMethod === 'QRIS') formattedMethod = 'QRIS';

    const notes = o.notes || o.voidReason || o.refundReason || '-';

    return [
      idx + 1,
      o.invoiceNo || '-',
      waktu,
      statusLabel,
      orderType,
      tableNo,
      customer,
      cashier,
      shift,
      itemsSummary,
      totalQty,
      Number(o.subtotal || 0),
      Number(o.discount || 0),
      Number(o.tax || 0),
      Number(o.total || 0),
      formattedMethod,
      notes,
    ];
  });

  // 5. Total Summary Row
  const totalRow = [
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `${orders.length} Transaksi`,
    totalItemsCount,
    totalSubtotal,
    totalDiscount,
    totalTax,
    totalRevenue,
    `${paidCount} Lunas, ${voidCount} Void, ${refundCount} Refund`,
    '',
  ];

  // Susun seluruh sheet grid
  const sheetData = [
    titleRow,
    metaRow,
    kpiRow,
    emptyRow,
    headers,
    ...dataRows,
    emptyRow,
    totalRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // 6. Lebar Kolom yang Nyaman Dibaca (Tuned Auto-Width)
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // No. Invoice
    { wch: 22 }, // Waktu Transaksi
    { wch: 14 }, // Status
    { wch: 14 }, // Tipe Pesanan
    { wch: 10 }, // Meja
    { wch: 22 }, // Pelanggan
    { wch: 18 }, // Kasir
    { wch: 10 }, // Shift
    { wch: 38 }, // Rincian Menu Pesanan
    { wch: 10 }, // Total Qty
    { wch: 16 }, // Subtotal (Rp)
    { wch: 14 }, // Diskon (Rp)
    { wch: 14 }, // Pajak (Rp)
    { wch: 18 }, // Total Akhir (Rp)
    { wch: 18 }, // Metode Pembayaran
    { wch: 26 }, // Catatan / Alasan
  ];

  const headerRowIdx = 5;
  const dataStartRowIdx = 6;
  const dataEndRowIdx = dataStartRowIdx + dataRows.length - 1;
  const totalRowIdx = sheetData.length;

  ws['!rows'] = [
    { hpt: 26 }, // Title
    { hpt: 18 }, // Meta
    { hpt: 20 }, // KPI
    { hpt: 10 }, // Empty
    { hpt: 26 }, // Table Header
  ];

  // Styling Title & Meta
  if (ws['A1']) ws['A1'].s = EXCEL_STYLES.title;
  if (ws['A2']) {
    ws['A2'].s = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '4B5563' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }
  if (ws['A3']) {
    ws['A3'].s = {
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '105932' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }

  // Styling Headers
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${headerRowIdx}`;
    if (ws[cellRef]) {
      ws[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Styling Data Rows
  dataRows.forEach((row, rIdx) => {
    const currentRowNum = dataStartRowIdx + rIdx;
    const isEven = rIdx % 2 === 0;
    const baseStyle = isEven ? EXCEL_STYLES.cell : EXCEL_STYLES.cellZebra;
    const statusVal = row[3]; // Status label

    headers.forEach((_, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${currentRowNum}`;
      if (ws[cellRef]) {
        const val = row[colIdx];
        const isNum = typeof val === 'number';

        let align = 'left';
        if (colIdx === 0 || colIdx === 3 || colIdx === 4 || colIdx === 5 || colIdx === 8) {
          align = 'center';
        } else if (isNum) {
          align = 'right';
        }

        let cellStyle = {
          ...baseStyle,
          alignment: {
            vertical: 'center',
            horizontal: align,
            wrapText: colIdx === 9,
          },
        };

        // Status badge color accent
        if (colIdx === 3) {
          if (statusVal === 'LUNAS') {
            cellStyle = {
              ...cellStyle,
              fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } },
              font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '065F46' } },
            };
          } else if (statusVal === 'DIBATALKAN') {
            cellStyle = {
              ...cellStyle,
              fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } },
              font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '991B1B' } },
            };
          } else if (statusVal === 'REFUND') {
            cellStyle = {
              ...cellStyle,
              fill: { patternType: 'solid', fgColor: { rgb: 'FFFBEB' } },
              font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '92400E' } },
            };
          }
        }

        // Numeric format IDR
        if (isNum && colIdx >= 11 && colIdx <= 14) {
          ws[cellRef].z = '#,##0';
        }

        ws[cellRef].s = cellStyle;
      }
    });
  });

  // Styling Total Row
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${totalRowIdx}`;
    if (ws[cellRef]) {
      const val = totalRow[colIdx];
      const isNum = typeof val === 'number';

      ws[cellRef].s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '105932' } },
        alignment: {
          vertical: 'center',
          horizontal: isNum ? 'right' : colIdx === 0 ? 'left' : 'center',
        },
        border: {
          top: { style: 'medium', color: { rgb: '105932' } },
          bottom: { style: 'double', color: { rgb: '105932' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };

      if (isNum && colIdx >= 11 && colIdx <= 14) {
        ws[cellRef].z = '#,##0';
      }
    }
  });

  // Pasang AutoFilter pada Header & Data tabel
  const lastColLetter = getColumnLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A${headerRowIdx}:${lastColLetter}${dataEndRowIdx}` };

  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Transaksi');

  // ─── SHEET 2: Rincian Item Menu Terjual ───────────────────────────────────
  const itemHeaders = [
    'No',
    'No. Invoice',
    'Waktu Transaksi (WIB)',
    'Status Pesanan',
    'Nama Menu / Produk',
    'Varian',
    'Kategori',
    'Qty',
    'Harga Satuan (Rp)',
    'Total Baris (Rp)',
    'Stasiun Dapur',
    'Catatan Khusus',
  ];

  let itemRowIdx = 1;
  const itemDataRows = [];
  let totalItemsQuantity = 0;
  let totalItemsAmount = 0;

  orders.forEach((o) => {
    const waktu = o.createdAt
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(new Date(o.createdAt)).replace(/\./g, ':')
      : '-';

    let statusLabel = o.status;
    if (o.status === 'PAID') statusLabel = 'LUNAS';
    else if (o.status === 'VOIDED') statusLabel = 'DIBATALKAN';
    else if (o.status === 'REFUNDED') statusLabel = 'REFUND';
    else if (o.status === 'OPEN') statusLabel = 'BELUM DIBAYAR';

    (o.items || []).forEach((it) => {
      const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
      const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
      const lineTotal = Number(it.lineTotal ?? it.total ?? (qty * unitPrice));
      totalItemsQuantity += qty;
      totalItemsAmount += lineTotal;

      itemDataRows.push([
        itemRowIdx++,
        o.invoiceNo || '-',
        waktu,
        statusLabel,
        it.product?.name || it.productName || it.name || 'Item Menu',
        it.variantName || it.variant?.name || '-',
        it.categoryName || it.product?.category?.name || it.category?.name || '-',
        qty,
        unitPrice,
        lineTotal,
        it.station?.name || it.stationName || (it.station?.type === 'BAR' ? 'Barista (BAR)' : 'Dapur (KITCHEN)'),
        it.notes || it.note || '-',
      ]);
    });
  });

  const itemTotalRow = [
    'TOTAL RINCIAN ITEM',
    '',
    '',
    '',
    '',
    '',
    `${itemDataRows.length} Baris Item`,
    totalItemsQuantity,
    '',
    totalItemsAmount,
    '',
    '',
  ];

  const itemSheetData = [
    [`${storeName.toUpperCase()} - RINCIAN ITEM MENU TERJUAL`],
    [`Filter: ${filterSegments.join(' | ')}`],
    [
      `Total: ${itemDataRows.length} Baris Item | Total Kuantitas: ${totalItemsQuantity} pcs | Nilai Kotor: Rp ${totalItemsAmount.toLocaleString('id-ID')} | Diunduh: ${nowStr} WIB`,
    ],
    emptyRow,
    itemHeaders,
    ...itemDataRows,
    emptyRow,
    itemTotalRow,
  ];

  const wsItems = XLSX.utils.aoa_to_sheet(itemSheetData);

  // Lebar kolom sheet item
  wsItems['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // No. Invoice
    { wch: 22 }, // Waktu Transaksi
    { wch: 14 }, // Status
    { wch: 30 }, // Nama Menu
    { wch: 16 }, // Varian
    { wch: 16 }, // Kategori
    { wch: 8 },  // Qty
    { wch: 16 }, // Harga Satuan
    { wch: 18 }, // Total Baris
    { wch: 18 }, // Stasiun Dapur
    { wch: 26 }, // Catatan Khusus
  ];

  const itemHeaderRowIdx = 5;
  const itemDataStartRowIdx = 6;
  const itemDataEndRowIdx = itemDataStartRowIdx + Math.max(itemDataRows.length, 1) - 1;
  const itemTotalRowIdx = itemSheetData.length;

  if (wsItems['A1']) wsItems['A1'].s = EXCEL_STYLES.title;
  if (wsItems['A2']) {
    wsItems['A2'].s = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '4B5563' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }
  if (wsItems['A3']) {
    wsItems['A3'].s = {
      font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '105932' } },
      alignment: { vertical: 'center', horizontal: 'left' },
    };
  }

  // Header styles
  itemHeaders.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${itemHeaderRowIdx}`;
    if (wsItems[cellRef]) {
      wsItems[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Data rows styles
  itemDataRows.forEach((row, rIdx) => {
    const currentRowNum = itemDataStartRowIdx + rIdx;
    const isEven = rIdx % 2 === 0;
    const baseStyle = isEven ? EXCEL_STYLES.cell : EXCEL_STYLES.cellZebra;

    itemHeaders.forEach((_, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${currentRowNum}`;
      if (wsItems[cellRef]) {
        const val = row[colIdx];
        const isNum = typeof val === 'number';

        let align = 'left';
        if (colIdx === 0 || colIdx === 3 || colIdx === 7 || colIdx === 10) {
          align = 'center';
        } else if (isNum) {
          align = 'right';
        }

        const cellStyle = {
          ...baseStyle,
          alignment: {
            vertical: 'center',
            horizontal: align,
          },
        };

        if (isNum && (colIdx === 8 || colIdx === 9)) {
          wsItems[cellRef].z = '#,##0';
        }

        wsItems[cellRef].s = cellStyle;
      }
    });
  });

  // Total row styles
  itemHeaders.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${itemTotalRowIdx}`;
    if (wsItems[cellRef]) {
      const val = itemTotalRow[colIdx];
      const isNum = typeof val === 'number';

      wsItems[cellRef].s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '105932' } },
        alignment: {
          vertical: 'center',
          horizontal: isNum ? 'right' : colIdx === 0 ? 'left' : 'center',
        },
        border: {
          top: { style: 'medium', color: { rgb: '105932' } },
          bottom: { style: 'double', color: { rgb: '105932' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };

      if (isNum && colIdx === 9) {
        wsItems[cellRef].z = '#,##0';
      }
    }
  });

  const lastItemColLetter = getColumnLetter(itemHeaders.length - 1);
  wsItems['!autofilter'] = { ref: `A${itemHeaderRowIdx}:${lastItemColLetter}${itemDataEndRowIdx}` };

  XLSX.utils.book_append_sheet(wb, wsItems, 'Rincian Item Menu');

  const dateFileStr = new Date().toISOString().slice(0, 10);
  const fileName = `KOMAZI_Riwayat_Pesanan_${dateFileStr}.xlsx`;

  saveWorkbook(wb, fileName);
  return { success: true, count: orders.length, itemCount: itemDataRows.length, fileName, workbook: wb };
}

/**
 * Ekspor Riwayat Transaksi Pesanan ke format CSV (.csv)
 * Standar RFC 4180 dengan UTF-8 BOM (\uFEFF) untuk kompatibilitas sempurna Microsoft Excel & Google Sheets.
 */
export function exportOrdersToCsv({
  orders = [],
  filterMeta = {},
  storeName = 'Komazi Coffee & Workspace',
}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('Tidak ada data pesanan untuk diekspor.');
  }

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.includes(',') || str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'No',
    'No. Invoice',
    'Waktu Transaksi (WIB)',
    'Status',
    'Tipe Pesanan',
    'Meja',
    'Pelanggan',
    'Kasir',
    'Shift ID',
    'Rincian Menu Pesanan',
    'Total Qty',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    'Metode Pembayaran',
    'Catatan / Alasan',
  ];

  const rows = orders.map((o, idx) => {
    const waktu = o.createdAt
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(new Date(o.createdAt)).replace(/\./g, ':')
      : '-';

    let statusLabel = o.status;
    if (o.status === 'PAID') statusLabel = 'LUNAS';
    else if (o.status === 'VOIDED') statusLabel = 'DIBATALKAN';
    else if (o.status === 'REFUNDED') statusLabel = 'REFUND';
    else if (o.status === 'OPEN') statusLabel = 'BELUM DIBAYAR';

    const orderType =
      o.type === 'TAKE_AWAY' || o.type === 'TAKEAWAY'
        ? 'Take-Away'
        : o.type === 'DELIVERY'
        ? 'Delivery'
        : 'Dine-In';

    const tableNo = o.tableNo ? `Meja ${o.tableNo}` : '-';
    const customer = o.customerName || o.customer?.name || 'Pelanggan Dine In';
    const cashier = o.cashierName || o.cashier?.name || o.shift?.cashier?.name || '-';
    const shift = o.shiftId ? `#${o.shiftId}` : '-';

    const itemsSummary =
      (o.items || [])
        .map((it) => {
          const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
          const name = it.product?.name || it.productName || it.name || 'Item';
          const variantName = it.variantName || it.variant?.name;
          const variant = variantName ? ` (${variantName})` : '';
          return `${qty}x ${name}${variant}`;
        })
        .join('; ') || '-';

    const totalQty = (o.items || []).reduce((sum, it) => sum + (Number(it.qty ?? it.quantity ?? 1) || 1), 0);

    const paymentMethod = o.payments?.[0]?.method || o.paymentMethod || 'CASH';
    let formattedMethod = paymentMethod;
    if (paymentMethod === 'CASH') formattedMethod = 'Tunai (Cash)';
    else if (paymentMethod === 'TRANSFER') formattedMethod = 'Transfer Bank';
    else if (paymentMethod === 'QRIS') formattedMethod = 'QRIS';

    const notes = o.notes || o.voidReason || o.refundReason || '-';

    return [
      idx + 1,
      o.invoiceNo || '-',
      waktu,
      statusLabel,
      orderType,
      tableNo,
      customer,
      cashier,
      shift,
      itemsSummary,
      totalQty,
      Number(o.subtotal || 0),
      Number(o.discount || 0),
      Number(o.tax || 0),
      Number(o.total || 0),
      formattedMethod,
      notes,
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(',')]
      .concat(rows.map((row) => row.map(escapeCsv).join(',')))
      .join('\r\n');

  const dateFileStr = new Date().toISOString().slice(0, 10);
  const fileName = `KOMAZI_Riwayat_Pesanan_${dateFileStr}.csv`;

  if (typeof window !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveBlobFile(blob, fileName);
  }

  return { success: true, count: orders.length, fileName, csvContent };
}

/**
 * Ekspor Laporan Penutupan Sesi Kasir (Z-Report) ke file Excel (.xlsx)
 * Menghasilkan tabel akuntansi lengkap dengan rekonsiliasi kas laci fisik,
 * rincian metode pembayaran, performa kasir, dan log pergerakan kas.
 *
 * @param {Object} params
 * @param {Object} params.session - Objek sesi shift kasir lengkap
 * @param {string} [params.storeName] - Nama outlet
 * @returns {Object} { success: true, fileName, session }
 */
export function exportZReportToExcel({
  session,
  storeName = 'Komazi Coffee & Workspace',
}) {
  if (!session || typeof session !== 'object') {
    throw new Error('Data sesi kasir untuk Z-Report tidak valid.');
  }

  const wb = XLSX.utils.book_new();

  // 1. Ekstraksi Angka & Metrik Keuangan
  const openingCash = Number(session.openingCash || 0);
  const closingCash = Number(session.closingCash || 0);
  const expectedCash = Number(session.expectedCash || 0);
  const difference = Number(
    session.difference !== undefined && session.difference !== null
      ? session.difference
      : closingCash - expectedCash
  );

  const totalCashSales = Number(session.totalCashSales || 0);
  const totalNonCashSales = Number(session.totalNonCashSales || 0);
  const totalSales = Number(session.totalSales || totalCashSales + totalNonCashSales);

  const totalCashIn = Number(session.totalCashIn || 0);
  const totalCashOut = Number(session.totalCashOut || 0);
  const totalCashDrop = Number(session.totalCashDrop || 0);
  const totalCashRefund = Number(session.totalCashRefund || 0);

  const paymentMethods = session.paymentMethodsSummary || {
    CASH: totalCashSales,
    QRIS: totalNonCashSales,
    TRANSFER: 0,
  };
  const cashAmount = Number(paymentMethods.CASH || 0);
  const qrisAmount = Number(paymentMethods.QRIS || 0);
  const tfAmount = Number(paymentMethods.TRANSFER || 0);

  const calcShare = (amt) =>
    totalSales > 0 ? `${((amt / totalSales) * 100).toFixed(1)}%` : '0.0%';

  const ordersCount = Number(session.ordersCount || 0);

  const cashiers =
    Array.isArray(session.cashiers) && session.cashiers.length > 0
      ? session.cashiers
      : [
          {
            id: session.cashierId,
            name: session.cashierName || 'Kasir',
            role: 'Kasir',
            ordersCount,
            totalSales,
          },
        ];

  const cashMovements = Array.isArray(session.cashMovements)
    ? session.cashMovements
    : [];
  const orders = Array.isArray(session.orders) ? session.orders : [];

  // 2. Format Durasi & Status Audit
  let durationFormatted = session.workDurationFormatted || '';
  if (!durationFormatted && session.openedAt) {
    const end = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
    const start = new Date(session.openedAt).getTime();
    const diffMin = Math.max(0, Math.floor((end - start) / 60000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    durationFormatted = `${h} jam ${m} menit`;
  }

  let auditStatusText = 'SEIMBANG (Rp 0)';
  let varianceBadge = 'BALANCED';
  let varianceExplanation = 'Kas fisik di laci cocok 100% dengan perhitungan sistem (Pas / Rp 0).';

  if (difference > 0) {
    auditStatusText = `SURPLUS (+Rp ${difference.toLocaleString('id-ID')})`;
    varianceBadge = 'SURPLUS';
    varianceExplanation = `Terdapat kelebihan uang fisik di laci kasir sebesar Rp ${difference.toLocaleString('id-ID')}.`;
  } else if (difference < 0) {
    auditStatusText = `DEFISIT (-Rp ${Math.abs(difference).toLocaleString('id-ID')})`;
    varianceBadge = 'DEFICIT';
    varianceExplanation = `Terdapat kekurangan uang fisik di laci kasir sebesar Rp ${Math.abs(difference).toLocaleString('id-ID')}.`;
  }

  const formatExcelDateTime = (dateVal) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return (
        new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(d) + ' WIB'
      );
    } catch {
      return String(dateVal);
    }
  };

  // 3. Bangun Grid Baris untuk Sheet 1: Ringkasan Z-Report
  const rows = [];
  const rowMeta = []; // Menyimpan tipe baris untuk styling: 'TITLE', 'SECTION', 'TBL_HEADER', 'DATA', 'HIGHLIGHT', 'VARIANCE', etc.
  const merges = [];

  // Baris 1-4: Header Laporan
  rows.push([storeName.toUpperCase()]);
  rowMeta.push({ type: 'TITLE' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push(['LAPORAN PENUTUPAN SESI KASIR (Z-REPORT)']);
  rowMeta.push({ type: 'SUBTITLE' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push([
    `ID Sesi: #${session.id} | Register: ${session.registerName || 'Kasir Utama'} (${session.registerCode || 'REG-01'}) | Status Rekonsiliasi: ${auditStatusText}`,
  ]);
  rowMeta.push({ type: 'META' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push([`Dicetak Pada: ${formatExcelDateTime(new Date())}`]);
  rowMeta.push({ type: 'META_SMALL' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  // Baris Kosong
  rows.push(['', '', '', '', '']);
  rowMeta.push({ type: 'EMPTY' });

  // Tabel 1: Informasi Sesi & Kasir
  rows.push(['INFORMASI SESI SHIFT & REGISTER', '', '', '', '']);
  rowMeta.push({ type: 'SECTION_BANNER' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push(['Atribut Sesi', 'Informasi', 'Atribut Kasir', 'Keterangan Petugas', '']);
  rowMeta.push({ type: 'TBL_HEADER_INFO' });

  rows.push(['ID Sesi Kasir', `#${session.id}`, 'Kasir Pembuka', session.cashierName || 'Kasir', '']);
  rowMeta.push({ type: 'INFO_ROW', isEven: true });

  rows.push([
    'Terminal / Register',
    `${session.registerName || 'Kasir Utama'} (${session.registerCode || 'REG-01'})`,
    'Kasir Penutup',
    session.closedByName || session.cashierName || 'Kasir',
    '',
  ]);
  rowMeta.push({ type: 'INFO_ROW', isEven: false });

  rows.push(['Waktu Buka Shift', formatExcelDateTime(session.openedAt), 'Durasi Shift', durationFormatted, '']);
  rowMeta.push({ type: 'INFO_ROW', isEven: true });

  rows.push(['Waktu Tutup Shift', formatExcelDateTime(session.closedAt), 'Total Transaksi', `${ordersCount} Transaksi`, '']);
  rowMeta.push({ type: 'INFO_ROW', isEven: false });

  rows.push(['Status Audit Kas', auditStatusText, 'Catatan Penutupan', session.notes || '-', '']);
  rowMeta.push({ type: 'INFO_ROW', isEven: true });

  rows.push(['', '', '', '', '']);
  rowMeta.push({ type: 'EMPTY' });

  // Tabel 2: Rekonsiliasi Kas Laci Fisik
  rows.push(['1. REKONSILIASI KAS LACI & ARUS KAS FISIK', '', '', '', '']);
  rowMeta.push({ type: 'SECTION_BANNER' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push(['No', 'Komponen Arus Kas Laci', 'Tipe Arus', 'Nominal (Rp)', 'Keterangan Operasional']);
  rowMeta.push({ type: 'TBL_HEADER' });

  rows.push([1, 'Modal Awal Kasir (Cash Float)', 'Saldo Awal', openingCash, 'Uang kas modal awal saat sesi kasir dibuka']);
  rowMeta.push({ type: 'DATA_ROW', isEven: true, isCash: true });

  rows.push([2, 'Total Penjualan Tunai Bersih', '(+) Kas Masuk', totalCashSales, 'Penerimaan kas dari pembayaran tunai transaksi POS']);
  rowMeta.push({ type: 'DATA_ROW', isEven: false, isCash: true });

  rows.push([3, 'Kas Masuk Tambahan (Cash-In)', '(+) Kas Masuk', totalCashIn, 'Uang tambahan yang disetorkan ke laci selama shift']);
  rowMeta.push({ type: 'DATA_ROW', isEven: true, isCash: true });

  rows.push([4, 'Kas Keluar Operasional (Cash-Out)', '(-) Kas Keluar', totalCashOut, 'Pengeluaran uang kas kecil / belanja operasional mendesak']);
  rowMeta.push({ type: 'DATA_ROW', isEven: false, isCash: true });

  rows.push([5, 'Setoran ke Brankas (Cash Drop)', '(-) Kas Keluar', totalCashDrop, 'Uang tunai diamankan dan disetor ke brankas tengah shift']);
  rowMeta.push({ type: 'DATA_ROW', isEven: true, isCash: true });

  rows.push([6, 'Pengembalian Tunai (Cash Refund)', '(-) Kas Keluar', totalCashRefund, 'Pengembalian dana tunai transaksi batal/refund']);
  rowMeta.push({ type: 'DATA_ROW', isEven: false, isCash: true });

  rows.push(['', 'TOTAL KAS SEHARUSNYA (EXPECTED)', 'Saldo Sistem', expectedCash, 'Modal Awal + Tunai + Cash In - Cash Out - Cash Drop - Refund']);
  rowMeta.push({ type: 'TOTAL_EXPECTED', isCash: true });

  rows.push(['', 'TOTAL KAS FISIK AKTUAL DIHITUNG (COUNTED)', 'Fisik Laci', closingCash, 'Hasil penghitungan fisik uang tunai di laci saat shift ditutup']);
  rowMeta.push({ type: 'TOTAL_COUNTED', isCash: true });

  rows.push(['', 'SELISIH KAS FISIK (VARIANCE)', auditStatusText, difference, varianceExplanation]);
  rowMeta.push({ type: 'VARIANCE', badge: varianceBadge, isCash: true });

  rows.push(['', '', '', '', '']);
  rowMeta.push({ type: 'EMPTY' });

  // Tabel 3: Penjualan Menurut Metode Pembayaran
  rows.push(['2. RINCIAN PENJUALAN MENURUT METODE PEMBAYARAN', '', '', '', '']);
  rowMeta.push({ type: 'SECTION_BANNER' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push(['No', 'Metode Pembayaran', 'Porsi Penjualan (%)', 'Total Nominal (Rp)', 'Keterangan Akuntansi']);
  rowMeta.push({ type: 'TBL_HEADER' });

  rows.push([1, 'Uang Tunai (Cash)', calcShare(cashAmount), cashAmount, 'Masuk langsung ke laci kasir fisik']);
  rowMeta.push({ type: 'DATA_ROW', isEven: true, isCash: true });

  rows.push([2, 'QRIS Digital', calcShare(qrisAmount), qrisAmount, 'Masuk otomatis ke rekening settlement QRIS']);
  rowMeta.push({ type: 'DATA_ROW', isEven: false, isCash: true });

  rows.push([3, 'Transfer Bank', calcShare(tfAmount), tfAmount, 'Masuk ke rekening bank outlet']);
  rowMeta.push({ type: 'DATA_ROW', isEven: true, isCash: true });

  rows.push(['', 'TOTAL PENJUALAN KOTOR (GROSS REVENUE)', '100.0%', totalSales, `Total omzet kotor dari ${ordersCount} transaksi selesai`]);
  rowMeta.push({ type: 'TOTAL_SALES', isCash: true });

  rows.push(['', '', '', '', '']);
  rowMeta.push({ type: 'EMPTY' });

  // Tabel 4: Kontribusi Kasir Bertugas
  rows.push(['3. KONTRIBUSI KASIR BERTUGAS PADA SESI INI', '', '', '', '']);
  rowMeta.push({ type: 'SECTION_BANNER' });
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

  rows.push(['No', 'Nama Kasir', 'Peran / Role', 'Jumlah Transaksi', 'Total Penjualan (Rp)']);
  rowMeta.push({ type: 'TBL_HEADER' });

  cashiers.forEach((c, idx) => {
    rows.push([
      idx + 1,
      c.name || 'Kasir',
      c.role || (idx === 0 ? 'Kasir Pembuka' : 'Kasir Shift'),
      `${c.ordersCount || 0} Pesanan`,
      Number(c.totalSales || 0),
    ]);
    rowMeta.push({ type: 'DATA_ROW', isEven: idx % 2 === 0, isCash: true });
  });

  rows.push(['', 'TOTAL KONTRIBUSI KASIR', '', `${ordersCount} Pesanan`, totalSales]);
  rowMeta.push({ type: 'TOTAL_SALES', isCash: true });

  rows.push(['', '', '', '', '']);
  rowMeta.push({ type: 'EMPTY' });

  // Tabel 5: Log Pergerakan Kas Operasional (Jika ada data)
  if (cashMovements.length > 0) {
    rows.push(['4. LOG PERGERAKAN KAS OPERASIONAL (CASH MOVEMENTS)', '', '', '', '']);
    rowMeta.push({ type: 'SECTION_BANNER' });
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } });

    rows.push(['No', 'Waktu (WIB)', 'Tipe Pergerakan', 'Nominal (Rp)', 'Kasir & Alasan / Keterangan']);
    rowMeta.push({ type: 'TBL_HEADER' });

    cashMovements.forEach((m, idx) => {
      const typeLabel =
        m.type === 'IN'
          ? 'KAS MASUK (IN)'
          : m.type === 'OUT'
          ? 'KAS KELUAR (OUT)'
          : m.type === 'DROP'
          ? 'SETOR BRANKAS (DROP)'
          : m.type;

      rows.push([
        idx + 1,
        formatExcelDateTime(m.createdAt),
        typeLabel,
        Number(m.amount || 0),
        `${m.user?.name || 'Kasir'}: ${m.reason || '-'}`,
      ]);
      rowMeta.push({ type: 'DATA_ROW', isEven: idx % 2 === 0, isCash: true });
    });

    rows.push(['', '', '', '', '']);
    rowMeta.push({ type: 'EMPTY' });
  }

  // Bangun worksheet dari grid data
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!merges'] = merges;
  ws1['!cols'] = [
    { wch: 6 },  // Kolom A: No / Atribut
    { wch: 40 }, // Kolom B: Nama Komponen / Keterangan
    { wch: 22 }, // Kolom C: Tipe Arus / Porsi
    { wch: 26 }, // Kolom D: Nominal Rp
    { wch: 45 }, // Kolom E: Rumus / Penjelasan
  ];

  // 4. Styling Lengkap Sel Sheet 1
  rows.forEach((row, rowIdx) => {
    const meta = rowMeta[rowIdx] || { type: 'EMPTY' };
    const rowNum = rowIdx + 1;

    for (let colIdx = 0; colIdx < 5; colIdx++) {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${rowNum}`;
      if (!ws1[cellRef]) continue;

      const val = row[colIdx];
      const isNum = typeof val === 'number';

      if (meta.type === 'TITLE') {
        ws1[cellRef].s = {
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '105932' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      } else if (meta.type === 'SUBTITLE') {
        ws1[cellRef].s = {
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '111827' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      } else if (meta.type === 'META') {
        ws1[cellRef].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '047857' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      } else if (meta.type === 'META_SMALL') {
        ws1[cellRef].s = {
          font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: '6B7280' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      } else if (meta.type === 'SECTION_BANNER') {
        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: '105932' } },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { vertical: 'center', horizontal: 'left' },
          border: {
            top: { style: 'medium', color: { rgb: '0B3D22' } },
            bottom: { style: 'medium', color: { rgb: '0B3D22' } },
            left: { style: 'medium', color: { rgb: '0B3D22' } },
            right: { style: 'medium', color: { rgb: '0B3D22' } },
          },
        };
      } else if (meta.type === 'TBL_HEADER' || meta.type === 'TBL_HEADER_INFO') {
        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: '1E3A2F' } },
          font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: {
            vertical: 'center',
            horizontal: colIdx === 0 ? 'center' : colIdx === 3 ? 'right' : 'left',
          },
          border: {
            top: { style: 'thin', color: { rgb: '0B3D22' } },
            bottom: { style: 'thin', color: { rgb: '0B3D22' } },
            left: { style: 'thin', color: { rgb: '0B3D22' } },
            right: { style: 'thin', color: { rgb: '0B3D22' } },
          },
        };
      } else if (meta.type === 'INFO_ROW') {
        const bg = meta.isEven ? 'FFFFFF' : 'F9FAFB';
        const isBoldCol = colIdx === 0 || colIdx === 2;
        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: bg } },
          font: {
            name: 'Calibri',
            sz: 10,
            bold: isBoldCol,
            color: { rgb: isBoldCol ? '111827' : '374151' },
          },
          alignment: { vertical: 'center', horizontal: 'left' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
      } else if (meta.type === 'DATA_ROW') {
        const bg = meta.isEven ? 'FFFFFF' : 'F9FAFB';
        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: bg } },
          font: {
            name: 'Calibri',
            sz: 10,
            bold: colIdx === 3,
            color: { rgb: '111827' },
          },
          alignment: {
            vertical: 'center',
            horizontal: colIdx === 0 ? 'center' : isNum ? 'right' : 'left',
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
        if (isNum && colIdx === 3) {
          ws1[cellRef].z = '#,##0';
        }
      } else if (meta.type === 'TOTAL_EXPECTED' || meta.type === 'TOTAL_COUNTED' || meta.type === 'TOTAL_SALES') {
        const isGreen = meta.type === 'TOTAL_EXPECTED';
        const fg = isGreen ? 'F0FDF4' : 'F8FAFC';
        const borderCol = isGreen ? '105932' : '334155';
        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: fg } },
          font: {
            name: 'Calibri',
            sz: 10.5,
            bold: true,
            color: { rgb: isGreen ? '105932' : '0F172A' },
          },
          alignment: {
            vertical: 'center',
            horizontal: isNum ? 'right' : 'left',
          },
          border: {
            top: { style: 'medium', color: { rgb: borderCol } },
            bottom: { style: 'medium', color: { rgb: borderCol } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
        if (isNum) {
          ws1[cellRef].z = '#,##0';
        }
      } else if (meta.type === 'VARIANCE') {
        let bg = 'ECFDF5';
        let txtCol = '065F46';
        let borderCol = '10B981';

        if (meta.badge === 'SURPLUS') {
          bg = 'EFF6FF';
          txtCol = '1D4ED8';
          borderCol = '3B82F6';
        } else if (meta.badge === 'DEFICIT') {
          bg = 'FEF2F2';
          txtCol = 'B91C1C';
          borderCol = 'EF4444';
        }

        ws1[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: bg } },
          font: {
            name: 'Calibri',
            sz: 11,
            bold: true,
            color: { rgb: txtCol },
          },
          alignment: {
            vertical: 'center',
            horizontal: isNum ? 'right' : 'left',
          },
          border: {
            top: { style: 'medium', color: { rgb: borderCol } },
            bottom: { style: 'double', color: { rgb: borderCol } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } },
          },
        };
        if (isNum) {
          ws1[cellRef].z = '#,##0';
        }
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan Z-Report');

  // 5. Sheet 2: Rincian Transaksi Pesanan (Jika tersedia daftar orders)
  if (orders.length > 0) {
    const orderHeaders = [
      'No',
      'No. Invoice',
      'Waktu Transaksi (WIB)',
      'Kasir',
      'Pelanggan',
      'Meja',
      'Tipe Pesanan',
      'Metode Bayar',
      'Status',
      'Rincian Menu Pesanan',
      'Total Akhir (Rp)',
    ];

    const orderRows = [
      [`${storeName.toUpperCase()} - RINCIAN TRANSAKSI PESANAN SESI #${session.id}`],
      [`Shift: #${session.id} | Register: ${session.registerName || 'Kasir Utama'} | Total: ${orders.length} Transaksi`],
      [],
      orderHeaders,
    ];

    orders.forEach((o, idx) => {
      const menuDesc = (o.items || [])
        .map((it) => {
          const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
          const name = it.product?.name || it.productName || it.name || 'Menu';
          const variantName = it.variantName || it.variant?.name;
          const variant = variantName ? ` (${variantName})` : '';
          return `${qty}x ${name}${variant}`;
        })
        .join('; ');

      const payMethod = (o.payments?.[0]?.method || o.paymentMethod || 'CASH').toUpperCase();

      orderRows.push([
        idx + 1,
        o.invoiceNo || `#${o.id}`,
        formatExcelDateTime(o.createdAt),
        o.cashierName || o.cashier?.name || session.cashierName || 'Kasir',
        o.customerName || 'Tamu',
        o.tableNo || o.tableNumber ? `Meja ${o.tableNo || o.tableNumber}` : 'Takeaway',
        o.type === 'DINE_IN' ? 'Dine-In' : o.type === 'TAKE_AWAY' ? 'Take-Away' : o.type || 'Dine-In',
        payMethod,
        o.status || 'PAID',
        menuDesc || '-',
        Number(o.total || 0),
      ]);
    });

    // Grand total row
    orderRows.push([
      '',
      'TOTAL PENJUALAN SESI',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `${orders.length} Transaksi Selesai`,
      totalSales,
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(orderRows);
    ws2['!cols'] = [
      { wch: 6 },  // No
      { wch: 22 }, // No. Invoice
      { wch: 22 }, // Waktu
      { wch: 18 }, // Kasir
      { wch: 18 }, // Pelanggan
      { wch: 14 }, // Meja
      { wch: 14 }, // Tipe
      { wch: 14 }, // Metode
      { wch: 12 }, // Status
      { wch: 45 }, // Rincian Menu
      { wch: 22 }, // Total Akhir
    ];

    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];

    // Styling Header Sheet 2
    orderHeaders.forEach((_, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}4`;
      if (ws2[cellRef]) {
        ws2[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: '105932' } },
          font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: {
            vertical: 'center',
            horizontal: colIdx === 0 ? 'center' : colIdx === 10 ? 'right' : 'left',
          },
          border: {
            top: { style: 'thin', color: { rgb: '0B3D22' } },
            bottom: { style: 'thin', color: { rgb: '0B3D22' } },
            left: { style: 'thin', color: { rgb: '0B3D22' } },
            right: { style: 'thin', color: { rgb: '0B3D22' } },
          },
        };
      }
    });

    // Styling Data Rows Sheet 2
    orders.forEach((_, idx) => {
      const rowNum = idx + 5;
      const isEven = idx % 2 === 0;
      const bg = isEven ? 'FFFFFF' : 'F9FAFB';

      orderHeaders.forEach((_, colIdx) => {
        const colLetter = getColumnLetter(colIdx);
        const cellRef = `${colLetter}${rowNum}`;
        if (ws2[cellRef]) {
          ws2[cellRef].s = {
            fill: { patternType: 'solid', fgColor: { rgb: bg } },
            font: { name: 'Calibri', sz: 10, color: { rgb: '111827' } },
            alignment: {
              vertical: 'center',
              horizontal: colIdx === 0 ? 'center' : colIdx === 10 ? 'right' : 'left',
            },
            border: {
              top: { style: 'thin', color: { rgb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
              left: { style: 'thin', color: { rgb: 'E5E7EB' } },
              right: { style: 'thin', color: { rgb: 'E5E7EB' } },
            },
          };
          if (colIdx === 10) {
            ws2[cellRef].z = '#,##0';
          }
        }
      });
    });

    // Styling Total Row Sheet 2
    const totalRowIndex = orderRows.length;
    orderHeaders.forEach((_, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${totalRowIndex}`;
      if (ws2[cellRef]) {
        ws2[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'F0FDF4' } },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '105932' } },
          alignment: {
            vertical: 'center',
            horizontal: colIdx === 10 ? 'right' : 'left',
          },
          border: {
            top: { style: 'medium', color: { rgb: '105932' } },
            bottom: { style: 'double', color: { rgb: '105932' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } },
          },
        };
        if (colIdx === 10) {
          ws2[cellRef].z = '#,##0';
        }
      }
    });

    // AutoFilter Sheet 2
    const lastColSheet2 = getColumnLetter(orderHeaders.length - 1);
    ws2['!autofilter'] = { ref: `A4:${lastColSheet2}${orderRows.length - 1}` };

    XLSX.utils.book_append_sheet(wb, ws2, 'Daftar Pesanan');
  }

  // 6. Simpan File Excel
  const dateFileStr = new Date().toISOString().slice(0, 10);
  const fileName = `KOMAZI_ZReport_Sesi_${session.id || 'Current'}_${dateFileStr}.xlsx`;

  saveWorkbook(wb, fileName);

  return { success: true, fileName, session };
}


