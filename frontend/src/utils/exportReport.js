import XLSX from 'xlsx-js-style';
import { getColumnLetter, EXCEL_STYLES } from './excel.js';

/**
 * Format timestamp to clean Indonesian Western Standard Time (WIB)
 * e.g. 2026-10-08T21:08:57.121Z -> "09/10/2026 04:08 WIB"
 */
export function formatWibDateTime(dateInput) {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d).replace(/\./g, ':') + ' WIB';
  } catch {
    return String(dateInput);
  }
}

/**
 * Format order type: DINE_IN -> Dine-In, TAKE_AWAY -> Take-Away
 */
export function formatOrderType(type) {
  if (!type) return 'Dine-In';
  const clean = String(type).trim().toUpperCase();
  if (clean === 'DINE_IN') return 'Dine-In';
  if (clean === 'TAKE_AWAY' || clean === 'TAKEAWAY') return 'Take-Away';
  if (clean === 'DELIVERY') return 'Delivery';
  if (clean === 'PICKUP') return 'Pickup';
  return clean.replace(/_/g, ' ');
}

/**
 * Format payment method: CASH -> Tunai (Cash), QRIS -> QRIS, TRANSFER -> Transfer Bank
 */
export function formatPaymentMethod(method) {
  if (!method) return 'Tunai (Cash)';
  const m = String(method).trim().toUpperCase();
  if (m.includes('QRIS')) return 'QRIS';
  if (m.includes('TRANSFER')) return 'Transfer Bank';
  if (m.includes('DEBIT') || m.includes('CARD')) return 'Kartu Debit';
  return 'Tunai (Cash)';
}

/**
 * Format status: PAID -> Lunas, VOIDED -> Dibatalkan (Void), SERVED -> Disajikan, etc.
 */
export function formatOrderStatus(status) {
  if (!status) return 'Lunas';
  const s = String(status).trim().toUpperCase();
  if (s === 'PAID') return 'Lunas';
  if (s === 'VOIDED' || s === 'VOID') return 'Dibatalkan (Void)';
  if (s === 'SERVED') return 'Disajikan';
  if (s === 'REFUNDED') return 'Dikembalikan (Refund)';
  if (s === 'PENDING') return 'Menunggu Bayar';
  return s;
}

/**
 * RFC 4180 CSV escaping for semicolon-separated values
 */
export function escapeCsvSemicolon(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Prepare and sanitize orders dataset for reports
 */
export function prepareOrdersReportData(orders = [], canViewCogs = true) {
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalGrossProfit = 0;

  const rows = orders.map((o, idx) => {
    const subtotal = Math.round(Number(o.subtotal || 0));
    const discount = Math.round(Number(o.discount || 0));
    const tax = Math.round(Number(o.tax || 0));
    const total = Math.round(Number(o.total || 0));

    let orderCogs = 0;
    (o.items || []).forEach((item) => {
      const lineCost = Number(item.lineCost || 0);
      if (lineCost > 0) {
        orderCogs += lineCost;
      } else if (item.unitCost) {
        orderCogs += Number(item.unitCost || 0) * Number(item.qty || 1);
      }
    });
    orderCogs = Math.round(orderCogs);
    const grossProfit = Math.round(total - orderCogs);
    const marginPct = total > 0 ? Number(((grossProfit / total) * 100).toFixed(1)) : 0;

    // Accumulate valid (non-voided) orders
    if (o.status !== 'VOIDED') {
      totalSubtotal += subtotal;
      totalDiscount += discount;
      totalTax += tax;
      totalRevenue += total;
      totalCogs += orderCogs;
      totalGrossProfit += grossProfit;
    }

    const cashier = o.cashierName || o.cashier?.name || 'Kasir';
    const customer = o.customerName || (o.tableNo ? `Meja ${o.tableNo}` : 'Tamu');
    const payment = o.paymentMethod || o.payments?.[0]?.method || 'CASH';

    return {
      no: idx + 1,
      invoiceNo: o.invoiceNo || '-',
      waktu: formatWibDateTime(o.createdAt),
      cashier,
      customer,
      type: formatOrderType(o.type),
      subtotal,
      discount,
      tax,
      total,
      cogs: orderCogs,
      grossProfit,
      marginPct,
      paymentMethod: formatPaymentMethod(payment),
      status: formatOrderStatus(o.status),
    };
  });

  const avgMargin = totalRevenue > 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  return {
    rows,
    summary: {
      totalOrders: orders.length,
      paidOrders: orders.filter((o) => o.status !== 'VOIDED').length,
      totalSubtotal,
      totalDiscount,
      totalTax,
      totalRevenue,
      totalCogs,
      totalGrossProfit,
      avgMargin,
    },
  };
}

/**
 * Download a Blob in browser
 */
export function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export to CSV format with semicolon delimiter, UTF-8 BOM, and sep=; directive
 * Opens cleanly in Microsoft Excel without clumped columns.
 */
export function exportReportToCsv({
  orders = [],
  dateRangeLabel = 'Semua Transaksi',
  canViewCogs = true,
  storeName = 'Komazi Coffee & Workspace',
}) {
  const { rows, summary } = prepareOrdersReportData(orders, canViewCogs);

  const headerColumns = [
    'No',
    'No Invoice',
    'Waktu Transaksi (WIB)',
    'Kasir',
    'Pelanggan',
    'Tipe Pesanan',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    ...(canViewCogs ? ['Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'] : []),
    'Metode Pembayaran',
    'Status',
  ];

  const csvLines = [
    'sep=;',
    `${storeName.toUpperCase()} - LAPORAN PENJUALAN & TRANSAKSI;;;;;;;;;;;;;`,
    `Periode: ${dateRangeLabel} | Dicetak Pada: ${formatWibDateTime(new Date())};;;;;;;;;;;;;`,
    `Ringkasan: ${summary.totalOrders} Transaksi | Total Omzet: Rp ${summary.totalRevenue.toLocaleString('id-ID')}${
      canViewCogs
        ? ` | Total HPP: Rp ${summary.totalCogs.toLocaleString('id-ID')} | Total Laba Kotor: Rp ${summary.totalGrossProfit.toLocaleString('id-ID')} (${summary.avgMargin}%)`
        : ''
    };;;;;;;;;;;;;`,
    '',
    headerColumns.join(';'),
  ];

  rows.forEach((r) => {
    const rowValues = [
      r.no,
      r.invoiceNo,
      r.waktu,
      escapeCsvSemicolon(r.cashier),
      escapeCsvSemicolon(r.customer),
      escapeCsvSemicolon(r.type),
      r.subtotal,
      r.discount,
      r.tax,
      r.total,
      ...(canViewCogs ? [r.cogs, r.grossProfit, `${r.marginPct}%`] : []),
      escapeCsvSemicolon(r.paymentMethod),
      escapeCsvSemicolon(r.status),
    ];
    csvLines.push(rowValues.join(';'));
  });

  // Footer summary row
  const summaryRow = [
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    summary.totalSubtotal,
    summary.totalDiscount,
    summary.totalTax,
    summary.totalRevenue,
    ...(canViewCogs ? [summary.totalCogs, summary.totalGrossProfit, `${summary.avgMargin}%`] : []),
    '',
    `${summary.paidOrders} Transaksi Berhasil`,
  ];

  csvLines.push('');
  csvLines.push(summaryRow.join(';'));

  // UTF-8 BOM prefix
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanRange = (dateRangeLabel || 'Laporan').replace(/\s+/g, '_');
  const filename = `KOMAZI_Laporan_Penjualan_${cleanRange}_${dateStr}.csv`;

  triggerFileDownload(blob, filename);
  return { success: true, filename, count: rows.length };
}

/**
 * Export to genuine Microsoft Excel (.xlsx) workbook
 * Premium layout with auto-sized columns, formatted numeric cells, and neat banners.
 */
export function exportReportToExcel({
  orders = [],
  dateRangeLabel = 'Semua Transaksi',
  canViewCogs = true,
  storeName = 'Komazi Coffee & Workspace',
}) {
  const { rows, summary } = prepareOrdersReportData(orders, canViewCogs);

  const wb = XLSX.utils.book_new();

  const titleRow = [`${storeName.toUpperCase()} - LAPORAN PENJUALAN & TRANSAKSI`];
  const metaRow = [`Periode: ${dateRangeLabel} | Diunduh: ${formatWibDateTime(new Date())}`];
  const kpiRow = [
    `Total Transaksi: ${summary.totalOrders}`,
    `Total Omzet: Rp ${summary.totalRevenue.toLocaleString('id-ID')}`,
    ...(canViewCogs
      ? [
          `Total HPP: Rp ${summary.totalCogs.toLocaleString('id-ID')}`,
          `Laba Kotor: Rp ${summary.totalGrossProfit.toLocaleString('id-ID')}`,
          `Margin: ${summary.avgMargin}%`,
        ]
      : []),
  ];
  const emptyRow = [];

  const headers = [
    'No',
    'No Invoice',
    'Waktu Transaksi (WIB)',
    'Kasir',
    'Pelanggan',
    'Tipe Pesanan',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    ...(canViewCogs ? ['Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'] : []),
    'Metode Pembayaran',
    'Status',
  ];

  const dataRows = rows.map((r) => [
    r.no,
    r.invoiceNo,
    r.waktu,
    r.cashier,
    r.customer,
    r.type,
    r.subtotal,
    r.discount,
    r.tax,
    r.total,
    ...(canViewCogs ? [r.cogs, r.grossProfit, `${r.marginPct}%`] : []),
    r.paymentMethod,
    r.status,
  ]);

  const totalRow = [
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    summary.totalSubtotal,
    summary.totalDiscount,
    summary.totalTax,
    summary.totalRevenue,
    ...(canViewCogs ? [summary.totalCogs, summary.totalGrossProfit, `${summary.avgMargin}%`] : []),
    '',
    `${summary.paidOrders} Transaksi Berhasil`,
  ];

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

  // Define generous, readable column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // No Invoice
    { wch: 24 }, // Waktu Transaksi (WIB)
    { wch: 16 }, // Kasir
    { wch: 22 }, // Pelanggan
    { wch: 14 }, // Tipe Pesanan
    { wch: 16 }, // Subtotal (Rp)
    { wch: 14 }, // Diskon (Rp)
    { wch: 14 }, // Pajak (Rp)
    { wch: 18 }, // Total Akhir (Rp)
    ...(canViewCogs
      ? [
          { wch: 16 }, // Total HPP (Rp)
          { wch: 16 }, // Laba Kotor (Rp)
          { wch: 12 }, // Margin (%)
        ]
      : []),
    { wch: 18 }, // Metode Pembayaran
    { wch: 16 }, // Status
  ];

  const headerRowIdx = 5; // Row 5 (1-indexed)
  const dataStartRowIdx = 6;
  const dataEndRowIdx = dataStartRowIdx + dataRows.length - 1;
  const totalRowIdx = sheetData.length; // Last row

  // Row heights
  ws['!rows'] = [
    { hpt: 26 }, // Title
    { hpt: 20 }, // Meta
    { hpt: 20 }, // KPI
    { hpt: 12 }, // Empty
    { hpt: 26 }, // Table Header
  ];

  // Style Title Row (A1)
  if (ws['A1']) {
    ws['A1'].s = EXCEL_STYLES.title;
  }

  // Style Table Headers (Row 5: A5..N5)
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${headerRowIdx}`;
    if (ws[cellRef]) {
      ws[cellRef].s = EXCEL_STYLES.header;
    }
  });

  // Style Data Rows
  dataRows.forEach((row, rIdx) => {
    const currentRowNum = dataStartRowIdx + rIdx;
    const isEven = rIdx % 2 === 0;
    const baseStyle = isEven ? EXCEL_STYLES.cell : EXCEL_STYLES.cellZebra;

    headers.forEach((_, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const cellRef = `${colLetter}${currentRowNum}`;
      if (ws[cellRef]) {
        const val = row[colIdx];
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

  // Style Total Row
  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${totalRowIdx}`;
    if (ws[cellRef]) {
      const val = totalRow[colIdx];
      const isNum = typeof val === 'number';
      ws[cellRef].s = {
        fill: { fgColor: { rgb: 'F3F4F6' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '105932' } },
        alignment: {
          vertical: 'center',
          horizontal: isNum ? 'right' : 'left',
        },
        border: {
          top: { style: 'medium', color: { rgb: '105932' } },
          bottom: { style: 'double', color: { rgb: '105932' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };
    }
  });

  // Set AutoFilter on Table Header & Data range
  const lastColLetter = getColumnLetter(headers.length - 1);
  ws['!autofilter'] = { ref: `A${headerRowIdx}:${lastColLetter}${dataEndRowIdx}` };

  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanRange = (dateRangeLabel || 'Laporan').replace(/\s+/g, '_');
  const filename = `KOMAZI_Laporan_Penjualan_${cleanRange}_${dateStr}.xlsx`;

  triggerFileDownload(blob, filename);
  return { success: true, filename, count: rows.length };
}

/**
 * Generic export for custom table reports (Products, Categories, Customers, Taxes, Staff, etc.)
 */
export function exportCustomTableToCsv({
  title = 'Laporan',
  dateRangeLabel = '',
  headers = [],
  rows = [], // 2D array: array of row arrays
  summaryRow = null,
  filenamePrefix = 'Laporan',
  storeName = 'Komazi Coffee & Workspace',
}) {
  const csvLines = [
    'sep=;',
    `${storeName.toUpperCase()} - ${title.toUpperCase()};;;;;;;;;;;;;`,
    `Periode: ${dateRangeLabel || 'Semua'} | Dicetak Pada: ${formatWibDateTime(new Date())};;;;;;;;;;;;;`,
    '',
    headers.map(escapeCsvSemicolon).join(';'),
  ];

  rows.forEach((r) => {
    const rowVals = r.map((val) => {
      if (typeof val === 'number') return val;
      return escapeCsvSemicolon(val);
    });
    csvLines.push(rowVals.join(';'));
  });

  if (summaryRow && Array.isArray(summaryRow)) {
    csvLines.push('');
    csvLines.push(summaryRow.map((v) => (typeof v === 'number' ? v : escapeCsvSemicolon(v))).join(';'));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanRange = (dateRangeLabel || 'Semua').replace(/\s+/g, '_');
  const cleanPrefix = filenamePrefix.replace(/\s+/g, '_');
  const filename = `KOMAZI_${cleanPrefix}_${cleanRange}_${dateStr}.csv`;

  triggerFileDownload(blob, filename);
  return { success: true, filename, count: rows.length };
}

export function exportCustomTableToExcel({
  title = 'Laporan',
  dateRangeLabel = '',
  headers = [],
  rows = [], // 2D array: array of row arrays
  summaryRow = null,
  filenamePrefix = 'Laporan',
  storeName = 'Komazi Coffee & Workspace',
}) {
  const wb = XLSX.utils.book_new();
  const titleRow = [`${storeName.toUpperCase()} - ${title.toUpperCase()}`];
  const metaRow = [`Periode: ${dateRangeLabel || 'Semua'} | Diunduh: ${formatWibDateTime(new Date())}`];
  const emptyRow = [];

  const aoa = [
    titleRow,
    metaRow,
    emptyRow,
    headers,
    ...rows,
  ];

  if (summaryRow && Array.isArray(summaryRow)) {
    aoa.push(emptyRow);
    aoa.push(summaryRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h).length;
    rows.slice(0, 200).forEach((r) => {
      const cellVal = String(r[colIdx] ?? '');
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
  });
  ws['!cols'] = colWidths;

  const headerRowIdx = 4;
  ws['!rows'] = [
    { hpt: 22 }, // Title
    { hpt: 16 }, // Meta
    { hpt: 8 },  // Empty
    { hpt: 26 }, // Headers
  ];

  if (ws['A1']) ws['A1'].s = EXCEL_STYLES.title;
  if (ws['A2']) ws['A2'].s = EXCEL_STYLES.guideText;

  headers.forEach((_, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    const cellRef = `${colLetter}${headerRowIdx}`;
    if (ws[cellRef]) ws[cellRef].s = EXCEL_STYLES.header;
  });

  const dataStartRowIdx = 5;
  const dataEndRowIdx = dataStartRowIdx + rows.length - 1;
  rows.forEach((r, rIdx) => {
    const rowNum = dataStartRowIdx + rIdx;
    const isEven = rIdx % 2 === 1;
    const baseStyle = isEven ? EXCEL_STYLES.cellZebra : EXCEL_STYLES.cell;

    r.forEach((val, cIdx) => {
      const colLetter = getColumnLetter(cIdx);
      const cellRef = `${colLetter}${rowNum}`;
      if (ws[cellRef]) {
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          ...baseStyle,
          alignment: {
            ...baseStyle.alignment,
            horizontal: isNum ? 'right' : cIdx === 0 ? 'center' : 'left',
          },
        };
      }
    });
  });

  if (summaryRow && Array.isArray(summaryRow)) {
    const sumRowIdx = dataEndRowIdx + 2;
    headers.forEach((_, cIdx) => {
      const colLetter = getColumnLetter(cIdx);
      const cellRef = `${colLetter}${sumRowIdx}`;
      if (ws[cellRef]) {
        const val = summaryRow[cIdx];
        const isNum = typeof val === 'number';
        ws[cellRef].s = {
          fill: { fgColor: { rgb: 'F3F4F6' } },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '105932' } },
          alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
          border: {
            top: { style: 'medium', color: { rgb: '105932' } },
            bottom: { style: 'double', color: { rgb: '105932' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
      }
    });
  }

  if (rows.length > 0) {
    const lastColLetter = getColumnLetter(headers.length - 1);
    ws['!autofilter'] = { ref: `A${headerRowIdx}:${lastColLetter}${dataEndRowIdx}` };
  }

  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanRange = (dateRangeLabel || 'Semua').replace(/\s+/g, '_');
  const cleanPrefix = filenamePrefix.replace(/\s+/g, '_');
  const filename = `KOMAZI_${cleanPrefix}_${cleanRange}_${dateStr}.xlsx`;

  triggerFileDownload(blob, filename);
  return { success: true, filename, count: rows.length };
}
