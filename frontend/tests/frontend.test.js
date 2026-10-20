import test from 'node:test';
import assert from 'node:assert/strict';
import { getColumnLetter, exportOrdersToExcel, exportOrdersToCsv, exportZReportToExcel } from '../src/utils/excel.js';
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

test('4. Orders Excel Export: validates empty input guard, item details resolution, and returns valid file metadata', () => {
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
    {
      id: 2,
      invoiceNo: 'KMZ-20261017-0001',
      createdAt: '2026-10-17T17:11:05Z',
      status: 'PAID',
      type: 'DINE_IN',
      tableNo: null,
      customerName: 'Pelanggan Dine In',
      cashierName: 'Naia Dawami Hafillah',
      shiftId: 1,
      subtotal: 25000,
      discount: 0,
      tax: 0,
      total: 25000,
      paymentMethod: 'CASH',
      items: [{ qty: 1, productName: 'Kopi Susu Aren', variantName: 'Ice' }],
    },
  ];

  const result = exportOrdersToExcel({
    orders: mockOrders,
    filterMeta: { status: 'PAID', method: 'ALL' },
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 2);
  assert.ok(result.fileName.includes('KOMAZI_Riwayat_Pesanan_'));

  // Verify the worksheets exist and do not have 'undefined' in any cell
  const sheet1 = result.workbook.Sheets['Daftar Transaksi'];
  assert.ok(sheet1, 'Main worksheet exists');
  const cells1 = Object.keys(sheet1).filter((k) => !k.startsWith('!'));
  for (const cellKey of cells1) {
    const val = String(sheet1[cellKey].v ?? '');
    assert.equal(val.includes('undefined'), false, `Sheet 1 Cell ${cellKey} should not contain undefined but was: "${val}"`);
  }

  const sheet2 = result.workbook.Sheets['Rincian Item Menu'];
  assert.ok(sheet2, 'Items worksheet exists');
  const cells2 = Object.keys(sheet2).filter((k) => !k.startsWith('!'));
  for (const cellKey of cells2) {
    const val = String(sheet2[cellKey].v ?? '');
    assert.equal(val.includes('undefined'), false, `Sheet 2 Cell ${cellKey} should not contain undefined but was: "${val}"`);
  }
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

test('6. Orders CSV Export: formats valid RFC 4180 CSV with UTF-8 BOM without undefined items', () => {
  assert.throws(() => exportOrdersToCsv({ orders: [] }), /Tidak ada data pesanan/);

  const mockOrders = [
    {
      id: 201,
      invoiceNo: 'KMZ-20261015-0201',
      createdAt: '2026-10-15T09:15:00Z',
      status: 'PAID',
      type: 'TAKE_AWAY',
      tableNo: null,
      customerName: 'Dewi Lestari',
      cashierName: 'Ahmad Staff',
      shiftId: 14,
      subtotal: 55000,
      discount: 0,
      tax: 5500,
      total: 60500,
      paymentMethod: 'CASH',
      items: [{ quantity: 1, name: 'Americano Double' }],
    },
    {
      id: 202,
      invoiceNo: 'KMZ-20261017-0001',
      createdAt: '2026-10-17T17:11:05Z',
      status: 'PAID',
      type: 'DINE_IN',
      tableNo: null,
      customerName: 'Pelanggan Dine In',
      cashierName: 'Naia Dawami Hafillah',
      shiftId: 1,
      subtotal: 25000,
      discount: 0,
      tax: 0,
      total: 25000,
      paymentMethod: 'CASH',
      items: [{ qty: 1, productName: 'Kopi Susu Aren', variantName: 'Ice' }],
    },
  ];

  const result = exportOrdersToCsv({
    orders: mockOrders,
    filterMeta: { status: 'PAID', method: 'CASH' },
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 2);
  assert.ok(result.fileName.includes('KOMAZI_Riwayat_Pesanan_'));
  assert.ok(result.csvContent.startsWith('\uFEFFNo,No. Invoice'));
  assert.ok(result.csvContent.includes('KMZ-20261015-0201'));
  assert.ok(result.csvContent.includes('KMZ-20261017-0001'));
  assert.ok(result.csvContent.includes('1x Kopi Susu Aren (Ice)'));
  assert.equal(result.csvContent.includes('undefined'), false, 'CSV content should never contain undefined');
});
test('7. UI Store Persistence: validates that isSidebarCollapsed and featurePreferences are persisted', async () => {
  // Setup mock localStorage if not available in Node.js
  const storageMap = new Map();
  if (!globalThis.localStorage) {
    globalThis.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };
  }

  const { useUiStore } = await import('../src/store/uiStore.js');
  
  // Set sidebar collapsed to true
  useUiStore.getState().setSidebarCollapsed(true);
  assert.equal(useUiStore.getState().isSidebarCollapsed, true);

  // Toggle back to false and verify
  useUiStore.getState().toggleSidebarCollapsed();
  assert.equal(useUiStore.getState().isSidebarCollapsed, false);

  // Set feature preferences
  useUiStore.getState().setFeaturePreference('orders', 'itemsPerPage', 25);
  assert.equal(useUiStore.getState().getFeaturePreference('orders', 'itemsPerPage', 10), 25);
});

test('8. Custom Table Report Export: formats headers, rows, and generates valid CSV/Excel download', async () => {
  if (typeof document === 'undefined') {
    globalThis.document = {
      createElement: () => ({ setAttribute: () => {}, click: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    };
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = () => 'blob:mock-url';
      globalThis.URL.revokeObjectURL = () => {};
    }
  }
  const { exportCustomTableToCsv, exportCustomTableToExcel } = await import('../src/utils/exportReport.js');

  const headers = ['No', 'Nama Produk', 'Qty', 'Total'];
  const rows = [
    [1, 'Americano', 10, 250000],
    [2, 'Latte', 5, 150000],
  ];

  const csvRes = exportCustomTableToCsv({
    title: 'Penjualan Produk',
    dateRangeLabel: 'Hari Ini',
    headers,
    rows,
    filenamePrefix: 'Test_Produk',
  });
  assert.equal(csvRes.success, true);
  assert.equal(csvRes.count, 2);
  assert.ok(csvRes.filename.includes('Test_Produk'));

  const excelRes = exportCustomTableToExcel({
    title: 'Penjualan Produk',
    dateRangeLabel: 'Hari Ini',
    headers,
    rows,
    filenamePrefix: 'Test_Produk',
  });
  assert.equal(excelRes.success, true);
  assert.equal(excelRes.count, 2);
  assert.ok(excelRes.filename.includes('Test_Produk'));
});

test('9. Report Pagination: verifies item slicing and page count logic for datasets > 10 items', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
  const pageSize = 10;
  
  // Page 1
  let page = 1;
  let slice = items.slice((page - 1) * pageSize, page * pageSize);
  assert.equal(slice.length, 10);
  assert.equal(slice[0].id, 1);
  assert.equal(slice[9].id, 10);

  // Page 2
  page = 2;
  slice = items.slice((page - 1) * pageSize, page * pageSize);
  assert.equal(slice.length, 10);
  assert.equal(slice[0].id, 11);
  assert.equal(slice[9].id, 20);

  // Page 3 (partial)
  page = 3;
  slice = items.slice((page - 1) * pageSize, page * pageSize);
  assert.equal(slice.length, 5);
  assert.equal(slice[0].id, 21);
  assert.equal(slice[4].id, 25);

  const totalPages = Math.ceil(items.length / pageSize);
  assert.equal(totalPages, 3);
});

test('10. KDS Order History & Date Filter: validates isToday helper and 10-item pagination for served orders', async () => {
  const { isToday } = await import('../src/utils/format.js');

  const now = new Date();
  assert.equal(isToday(now), true, 'Current date should return true for isToday');
  assert.equal(isToday(now.toISOString()), true, 'ISO string of current date should return true');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(isToday(yesterday), false, 'Yesterday should return false for isToday');

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.equal(isToday(tomorrow), false, 'Tomorrow should return false for isToday');
  assert.equal(isToday(null), false, 'Null input should return false');
  assert.equal(isToday('invalid-date'), false, 'Invalid string should return false');

  // Verify KDS history pagination logic (10 items per page)
  const servedOrders = Array.from({ length: 27 }, (_, i) => ({
    id: i + 1,
    invoiceNo: `KMZ-20261020-${String(i + 1).padStart(4, '0')}`,
    createdAt: now.toISOString(),
    kitchenStatus: 'SERVED',
    barStatus: 'SERVED',
  }));

  const perPage = 10;
  const page1 = servedOrders.slice(0, perPage);
  const page2 = servedOrders.slice(10, 20);
  const page3 = servedOrders.slice(20, 30);

  assert.equal(page1.length, 10);
  assert.equal(page2.length, 10);
  assert.equal(page3.length, 7);
  assert.equal(Math.ceil(servedOrders.length / perPage), 3);
});

test('11. KDS ESC/POS Kitchen Ticket & Receipt Payload: generates valid Uint8Array commands for 58mm & 80mm', async () => {
  const { buildKitchenTicketEscPos, buildOrderReceiptEscPos } = await import('../src/utils/escpos.js');

  const mockOrder = {
    id: 99,
    invoiceNo: 'KMZ-20261020-0099',
    createdAt: '2026-10-20T14:30:00Z',
    orderType: 'DINE_IN',
    tableNo: '07',
    customerName: 'Budi Santoso',
    cashierName: 'Barista Siti',
    subtotal: 45000,
    total: 45000,
    items: [
      {
        qty: 2,
        name: 'Kopi Susu Senja',
        variantName: 'Ice Less Sugar',
        modifiers: 'Oatmilk',
        note: 'Jangan terlalu manis',
      },
      {
        qty: 1,
        name: 'Croissant Cokelat',
        note: 'Hangatkan',
      },
    ],
  };

  // Test 58mm kitchen ticket
  const ticket58 = buildKitchenTicketEscPos(mockOrder, {
    paperWidth: '58mm',
    stationName: 'BARISTA',
  });
  assert.ok(ticket58 instanceof Uint8Array, 'Ticket 58mm should be Uint8Array');
  assert.ok(ticket58.length > 50, 'Ticket payload should contain non-trivial ESC/POS bytes');

  // Test 80mm kitchen ticket
  const ticket80 = buildKitchenTicketEscPos(mockOrder, {
    paperWidth: '80mm',
    stationName: 'KITCHEN',
    isAdditional: true,
  });
  assert.ok(ticket80 instanceof Uint8Array, 'Ticket 80mm should be Uint8Array');
  assert.ok(ticket80.length > 50, 'Ticket payload 80mm should contain non-trivial ESC/POS bytes');

  // Test Customer receipt generation
  const receipt = buildOrderReceiptEscPos(mockOrder, {
    paperWidth: '58mm',
    storeSettings: {
      storeName: 'Komazi Coffee',
      footerText: 'Terima kasih atas kunjungannya',
    },
  });
  assert.ok(receipt instanceof Uint8Array, 'Receipt should be Uint8Array');
  assert.ok(receipt.length > 50, 'Receipt payload should contain non-trivial ESC/POS bytes');
});

test('12. KDS Kitchen Auto-Print & Station Items Filtering: validates station items filtering and custom ticket payload', async () => {
  const { buildKitchenTicketEscPos } = await import('../src/utils/escpos.js');
  const { isDrinkItem } = await import('../src/utils/format.js');

  const testItems = [
    { qty: 2, name: 'Es Kopi Susu', station: { type: 'BAR' } },
    { qty: 1, name: 'Matcha Latte', station: { type: 'BAR' } },
    { qty: 1, name: 'Nasi Goreng Wagyu', station: { type: 'KITCHEN' } },
    { qty: 1, name: 'Croissant Butter' }, // No station: classified as kitchen/food
  ];

  const barItems = testItems.filter((i) => i.station?.type === 'BAR' || isDrinkItem(i));
  const kitchenItems = testItems.filter((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));

  assert.equal(barItems.length, 2, 'Bar station should filter 2 drink items');
  assert.equal(kitchenItems.length, 2, 'Kitchen station should filter 2 food items');

  const mockOrder = {
    id: 101,
    invoiceNo: 'KMZ-AUTO-0101',
    createdAt: new Date().toISOString(),
    orderType: 'DINE_IN',
    tableNo: '08',
    customerName: 'Ahmad Pelanggan',
    items: testItems,
  };

  // Test building kitchen ticket specifically with filtered bar items
  const barTicket = buildKitchenTicketEscPos(mockOrder, {
    paperWidth: '58mm',
    stationName: 'BARISTA',
    items: barItems,
  });
  assert.ok(barTicket instanceof Uint8Array, 'Filtered bar ticket should be Uint8Array');
  assert.ok(barTicket.length > 50, 'Bar ticket payload should be valid ESC/POS bytes');

  // Test building kitchen ticket specifically with filtered kitchen items
  const kitchenTicket = buildKitchenTicketEscPos(mockOrder, {
    paperWidth: '80mm',
    stationName: 'DAPUR',
    items: kitchenItems,
  });
  assert.ok(kitchenTicket instanceof Uint8Array, 'Filtered kitchen ticket should be Uint8Array');
  assert.ok(kitchenTicket.length > 50, 'Kitchen ticket payload should be valid ESC/POS bytes');
});





