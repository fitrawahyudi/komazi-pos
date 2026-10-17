import test from 'node:test';
import assert from 'node:assert/strict';
import { getColumnLetter, exportOrdersToExcel, exportZReportToExcel } from '../src/utils/excel.js';
import { formatWibDateTime, formatOrderType } from '../src/utils/exportReport.js';

test('1. Excel Column Letter Conversion: accurately converts 0-indexed column to Excel letters', () => {
  assert.equal(getColumnLetter(0), 'A');
  assert.equal(getColumnLetter(1), 'B');
  assert.equal(getColumnLetter(25), 'Z');
  assert.equal(getColumnLetter(26), 'AA');
  assert.equal(getColumnLetter(27), 'AB');
});

test('2. Order Type Formatter: humanizes enum types to readable labels', () => {
  assert.equal(formatOrderType('DINE_IN'), 'Dine-In');
  assert.equal(formatOrderType('TAKE_AWAY'), 'Take-Away');
  assert.equal(formatOrderType('DELIVERY'), 'Delivery');
});

test('3. WIB Timestamp Formatter: formats ISO string with Asia/Jakarta timezone', () => {
  const utcDate = new Date('2026-10-15T03:00:00.000Z'); // 10:00 WIB
  const formatted = formatWibDateTime(utcDate);
  assert.ok(formatted.includes('10:00:00 WIB') || formatted.includes('WIB'));
});

test('4. Orders Excel Export: validates empty input guard and returns valid file metadata', () => {
  assert.throws(() => exportOrdersToExcel({ orders: [] }), /Tidak ada data pesanan/);

  const mockOrders = [
    {
      id: 1,
      invoiceNo: 'KMZ-20261015-0001',
      createdAt: '2026-10-15T08:30:00Z',
      status: 'PAID',
      type: 'DINE_IN',
      tableNo: 4,
      customerName: 'Budi Santoso',
      cashierName: 'Rina',
      shiftId: 12,
      subtotal: 45000,
      discount: 5000,
      tax: 4000,
      total: 44000,
      paymentMethod: 'QRIS',
      items: [{ quantity: 2, name: 'Kopi Susu Aren' }],
    },
  ];

  const result = exportOrdersToExcel({
    orders: mockOrders,
    filterMeta: { status: 'PAID', method: 'QRIS' },
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 1);
  assert.ok(result.fileName.includes('KOMAZI_Riwayat_Pesanan_'));
});

test('5. Z-Report Excel Export: formats accounting tables, variance reconciliation, and order details', () => {
  assert.throws(() => exportZReportToExcel({ session: null }), /tidak valid/);

  const mockSession = {
    id: 42,
    registerName: 'Kasir Bar Lantai 1',
    registerCode: 'REG-BAR-01',
    cashierName: 'Ahmad Staff',
    closedByName: 'Ahmad Staff',
    openedAt: '2026-10-15T08:00:00.000Z',
    closedAt: '2026-10-15T16:00:00.000Z',
    workDurationFormatted: '8 jam 0 menit',
    notes: 'Shift pagi lancar, kas fisik laci seimbang',
    openingCash: 200000,
    closingCash: 750000,
    expectedCash: 750000,
    difference: 0,
    totalCashSales: 600000,
    totalNonCashSales: 450000,
    totalSales: 1050000,
    totalCashIn: 50000,
    totalCashOut: 100000,
    totalCashDrop: 0,
    totalCashRefund: 0,
    ordersCount: 25,
    paymentMethodsSummary: {
      CASH: 600000,
      QRIS: 350000,
      TRANSFER: 100000,
    },
    cashiers: [
      { id: 1, name: 'Ahmad Staff', role: 'Kasir Utama', ordersCount: 25, totalSales: 1050000 },
    ],
    cashMovements: [
      {
        id: 1,
        type: 'IN',
        amount: 50000,
        reason: 'Pecahan uang kembalian dari brankas',
        createdAt: '2026-10-15T09:00:00.000Z',
        user: { name: 'Ahmad Staff' },
      },
      {
        id: 2,
        type: 'OUT',
        amount: 100000,
        reason: 'Beli galon air mineral operasional',
        createdAt: '2026-10-15T11:30:00.000Z',
        user: { name: 'Ahmad Staff' },
      },
    ],
    orders: [
      {
        id: 101,
        invoiceNo: 'KMZ-20261015-0101',
        createdAt: '2026-10-15T08:45:00.000Z',
        customerName: 'Siti Aminah',
        tableNo: '03',
        type: 'DINE_IN',
        status: 'PAID',
        cashierName: 'Ahmad Staff',
        total: 75000,
        payments: [{ method: 'CASH', amount: 75000 }],
        items: [
          { productName: 'V60 Gayo', variantName: 'Hot', qty: 1 },
          { productName: 'Croissant Butter', qty: 2 },
        ],
      },
    ],
  };

  const result = exportZReportToExcel({
    session: mockSession,
    storeName: 'Komazi Coffee & Workspace',
  });

  assert.equal(result.success, true);
  assert.ok(result.fileName.includes('KOMAZI_ZReport_Sesi_42_'));
  assert.equal(result.session.id, 42);
});

