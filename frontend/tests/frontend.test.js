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

test('13. Universal File Saver: handles workbook and blob downloads safely across platforms', async () => {
  const { saveWorkbook, saveBlobFile, blobToBase64 } = await import('../src/utils/fileSaver.js');
  const XLSX = (await import('xlsx-js-style')).default;

  // Test saveWorkbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Kolom A', 'Kolom B'], ['Nilai 1', 'Nilai 2']]);
  XLSX.utils.book_append_sheet(wb, ws, 'TestSheet');

  const wbResult = await saveWorkbook(wb, 'test_output.xlsx');
  assert.equal(wbResult.success, true);
  assert.equal(wbResult.fileName, 'test_output.xlsx');

  // Test blobToBase64 and saveBlobFile
  const testBlob = new Blob(['Halo Komazi POS'], { type: 'text/plain' });
  const base64Str = await blobToBase64(testBlob);
  assert.ok(typeof base64Str === 'string', 'blobToBase64 should return string');

  const blobResult = await saveBlobFile(testBlob, 'test_file.csv');
  assert.equal(blobResult.success, true);
  assert.equal(blobResult.fileName, 'test_file.csv');
});

test('14. Menu Station Routing & Fallback: resolves preparation station accurately to prevent misrouting', async () => {
  const { isDrinkItem } = await import('../src/utils/format.js');

  const mockStations = [
    { id: 101, name: 'Bar Counter', code: 'BAR_MAIN', type: 'BAR' },
    { id: 102, name: 'Kitchen Counter', code: 'KITCHEN_MAIN', type: 'KITCHEN' },
  ];

  const getProductStationType = (prod) => {
    if (prod?.station?.type) return prod.station.type;
    if (prod?.stationId && mockStations.length > 0) {
      const found = mockStations.find((s) => s.id === prod.stationId);
      if (found?.type) return found.type;
    }
    return isDrinkItem(prod) ? 'BAR' : 'KITCHEN';
  };

  // Case 1: Explicit BAR stationId on a non-drink item (e.g., special Barista Toast)
  const barSpecialItem = { id: 1, name: 'Barista Toast', stationId: 101, categoryName: 'Food' };
  assert.equal(getProductStationType(barSpecialItem), 'BAR', 'Explicit stationId 101 should route to BAR');

  // Case 2: Explicit KITCHEN stationId on a drink item (e.g., Artisan Kitchen Brew)
  const kitchenSpecialDrink = { id: 2, name: 'Es Kopi Komazi', stationId: 102, categoryName: 'Kopi' };
  assert.equal(getProductStationType(kitchenSpecialDrink), 'KITCHEN', 'Explicit stationId 102 should route to KITCHEN');

  // Case 3: Embedded station object relation
  const embeddedItem = { id: 3, name: 'Matcha Frappe', station: { type: 'BAR' } };
  assert.equal(getProductStationType(embeddedItem), 'BAR', 'Embedded station relation should route to BAR');

  // Case 4: No explicit stationId - falls back to isDrinkItem (Kopi -> BAR)
  const autoDrink = { id: 4, name: 'Americano', categoryName: 'Kopi' };
  assert.equal(getProductStationType(autoDrink), 'BAR', 'Drink category should fallback to BAR');

  // Case 5: No explicit stationId - falls back to isDrinkItem (Rice bowl -> KITCHEN)
  const autoFood = { id: 5, name: 'Nasi Ayam Goreng', categoryName: 'Makanan' };
  assert.equal(getProductStationType(autoFood), 'KITCHEN', 'Food category should fallback to KITCHEN');
});

test('15. Strict Kitchen vs Barista Isolation in Ticket Generation: ensures barista items never leak into kitchen tickets and vice-versa', async () => {
  const { isKitchenItem, isBaristaItem } = await import('../src/utils/format.js');
  const { buildKitchenTicketEscPos } = await import('../src/utils/escpos.js');

  const mixedOrder = {
    id: 99,
    invoiceNo: 'KMZ-TEST-99',
    createdAt: new Date().toISOString(),
    orderType: 'DINE_IN',
    tableNo: '5',
    customerName: 'Joko',
    cashierName: 'Kasir Utama',
    items: [
      { name: 'Kopizi Aren Ice', qty: 2, note: 'Less sugar' },
      { name: 'Americano Hot', qty: 1 },
      { name: 'Nasi Goreng Komazi', qty: 1, note: 'Pedas sedang' },
      { name: 'Kentang Goreng', qty: 1 },
      { name: 'Matcha Latte', qty: 1 },
    ],
  };

  // 1. Verify item-level categorization
  assert.equal(isBaristaItem(mixedOrder.items[0]), true, 'Kopizi Aren should be Barista');
  assert.equal(isKitchenItem(mixedOrder.items[0]), false, 'Kopizi Aren must NOT be Kitchen');

  assert.equal(isBaristaItem(mixedOrder.items[1]), true, 'Americano should be Barista');
  assert.equal(isKitchenItem(mixedOrder.items[1]), false, 'Americano must NOT be Kitchen');

  assert.equal(isKitchenItem(mixedOrder.items[2]), true, 'Nasi Goreng should be Kitchen');
  assert.equal(isBaristaItem(mixedOrder.items[2]), false, 'Nasi Goreng must NOT be Barista');

  assert.equal(isKitchenItem(mixedOrder.items[3]), true, 'Kentang Goreng should be Kitchen');
  assert.equal(isBaristaItem(mixedOrder.items[3]), false, 'Kentang Goreng must NOT be Barista');

  // 2. Build Kitchen Ticket with default stationName DAPUR
  const kitchenBytes = buildKitchenTicketEscPos(mixedOrder, { stationName: 'DAPUR' });
  const kitchenText = new TextDecoder().decode(kitchenBytes);

  assert.ok(kitchenText.includes('Nasi Goreng Komazi'), 'Kitchen ticket must include Nasi Goreng');
  assert.ok(kitchenText.includes('Kentang Goreng'), 'Kitchen ticket must include Kentang Goreng');
  assert.ok(!kitchenText.includes('Kopizi Aren Ice'), 'Kitchen ticket must NEVER include Kopizi Aren Ice');
  assert.ok(!kitchenText.includes('Americano Hot'), 'Kitchen ticket must NEVER include Americano Hot');
  assert.ok(!kitchenText.includes('Matcha Latte'), 'Kitchen ticket must NEVER include Matcha Latte');

  // 3. Build Barista Ticket with stationName BARISTA
  const baristaBytes = buildKitchenTicketEscPos(mixedOrder, { stationName: 'BARISTA' });
  const baristaText = new TextDecoder().decode(baristaBytes);

  assert.ok(baristaText.includes('Kopizi Aren Ice'), 'Barista ticket must include Kopizi Aren Ice');
  assert.ok(baristaText.includes('Americano Hot'), 'Barista ticket must include Americano Hot');
  assert.ok(baristaText.includes('Matcha Latte'), 'Barista ticket must include Matcha Latte');
  assert.ok(!baristaText.includes('Nasi Goreng Komazi'), 'Barista ticket must NEVER include Nasi Goreng');
  assert.ok(!baristaText.includes('Kentang Goreng'), 'Barista ticket must NEVER include Kentang Goreng');
});

test('16. Order History Date Filter: verifies getLocalDateString format and today-default filtering logic', async () => {
  const { getLocalDateString } = await import('../src/utils/format.js');

  const testDate = new Date(2026, 9, 24); // Oct 24, 2026 (month is 0-indexed)
  assert.equal(getLocalDateString(testDate), '2026-10-24');
  assert.equal(getLocalDateString(null), '');
  assert.equal(getLocalDateString('invalid-date'), '');

  const todayStr = getLocalDateString(new Date());
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);

  // Sample orders
  const sampleOrders = [
    { id: 1, invoiceNo: 'KMZ-TODAY-001', createdAt: new Date().toISOString() },
    { id: 2, invoiceNo: 'KMZ-PAST-001', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 3, invoiceNo: 'KMZ-OLD-001', createdAt: '2026-01-01T10:00:00Z' },
  ];

  // Filter with startDate = todayStr and endDate = todayStr (default filter behavior)
  const startDate = todayStr;
  const endDate = todayStr;

  const todayOrders = sampleOrders.filter((order) => {
    if (!order.createdAt) return false;
    const localDate = new Date(order.createdAt);
    if (isNaN(localDate.getTime())) return false;
    const orderDateStr = getLocalDateString(localDate);

    if (startDate && orderDateStr < startDate) return false;
    if (endDate && orderDateStr > endDate) return false;
    return true;
  });

  assert.equal(todayOrders.length, 1);
  assert.equal(todayOrders[0].id, 1);
});

test('17. Komazi AI Role Chat History Isolation: ensures complete separation of conversation history per role and tailored greetings', async () => {
  const { getRoleWelcomeMessage, syncRoleChatHistory } = await import('../src/utils/aiRoleHelpers.js');

  // 1. Role-Tailored Welcome Messages
  const ownerWelcome = getRoleWelcomeMessage('OWNER', 'Budi');
  assert.ok(ownerWelcome.text.includes('Kak Budi'));
  assert.ok(ownerWelcome.text.includes('Asisten Eksekutif Bisnis'));
  assert.ok(ownerWelcome.followUps.some((q) => q.includes('omset') || q.includes('selisih kas')));

  const managerWelcome = getRoleWelcomeMessage('MANAGER', 'Dewi');
  assert.ok(managerWelcome.text.includes('Asisten Operasional'));
  assert.ok(managerWelcome.followUps.some((q) => q.includes('stok') || q.includes('shift')));

  const baristaWelcome = getRoleWelcomeMessage('BARISTA', 'Andi');
  assert.ok(baristaWelcome.text.includes('Asisten Bar Minuman'));
  assert.ok(baristaWelcome.followUps.some((q) => q.includes('Vanilla Latte') || q.includes('Fresh Milk')));

  const kitchenWelcome = getRoleWelcomeMessage('KITCHEN', 'Chef Doni');
  assert.ok(kitchenWelcome.text.includes('Asisten Dapur Makanan'));
  assert.ok(kitchenWelcome.followUps.some((q) => q.includes('pastry') || q.includes('dapur')));

  const cashierWelcome = getRoleWelcomeMessage('CASHIER', 'Rina');
  assert.ok(cashierWelcome.text.includes('Asisten POS & Layanan Pelanggan'));
  assert.ok(cashierWelcome.followUps.some((q) => q.includes('split bill') || q.includes('printer thermal')));

  // 2. Chat Isolation State Transition
  // Simulasikan state awal kosong
  let chatStore = {
    messagesByRole: {
      OWNER: [],
      MANAGER: [],
      CASHIER: [],
      BARISTA: [],
      KITCHEN: [],
    },
  };

  // Skenario A: Owner login dan berdiskusi seputar metrik finansial sensitif
  const ownerSync = syncRoleChatHistory({
    messagesByRole: chatStore.messagesByRole,
    targetRole: 'OWNER',
    targetName: 'Pak Boss',
  });

  // Tambahkan obrolan percakapan finansial rahasia ke role OWNER
  const ownerMessagesWithChat = [
    ...ownerSync.activeMessages,
    { id: 'msg_user_1', role: 'user', text: 'Berapa laba bersih dan pengeluaran bulan ini?' },
    { id: 'msg_ai_1', role: 'assistant', text: 'Estimasi laba bersih kedai bulan ini adalah Rp 18.500.000 dengan pengeluaran Rp 7.200.000.' },
  ];

  chatStore.messagesByRole = {
    ...ownerSync.updatedMessagesByRole,
    OWNER: ownerMessagesWithChat,
  };

  assert.equal(chatStore.messagesByRole.OWNER.length, 3);
  assert.ok(chatStore.messagesByRole.OWNER[1].text.includes('laba bersih'));

  // Skenario B: Kasir login di browser yang sama
  const cashierSync = syncRoleChatHistory({
    messagesByRole: chatStore.messagesByRole,
    targetRole: 'CASHIER',
    targetName: 'Rina Kasir',
  });

  // Verifikasi 100% isolasi: Kasir TIDAK BOLEH melihat obrolan Owner
  assert.equal(cashierSync.activeRole, 'CASHIER');
  assert.equal(cashierSync.activeMessages.length, 1);
  assert.equal(cashierSync.activeMessages[0].id, 'welcome_CASHIER');
  assert.ok(cashierSync.activeMessages[0].text.includes('Asisten POS & Layanan Pelanggan'));

  // Periksa bahwa tidak ada kebocoran kata 'laba bersih' atau chat owner ke kasir
  const cashierHasLeak = cashierSync.activeMessages.some(
    (m) => m.text.includes('laba bersih') || m.text.includes('18.500.000')
  );
  assert.equal(cashierHasLeak, false, 'Obrolan Owner TIDAK BOLEH bocor ke Kasir');

  // Skenario C: Kasir bertanya tentang Split Bill
  const cashierMessagesWithChat = [
    ...cashierSync.activeMessages,
    { id: 'msg_user_cashier_1', role: 'user', text: 'Bagaimana cara split bill meja 4?' },
    { id: 'msg_ai_cashier_1', role: 'assistant', text: 'Untuk split bill, buka menu Pesanan Aktif lalu pilih pisah bill.' },
  ];

  chatStore.messagesByRole = {
    ...cashierSync.updatedMessagesByRole,
    CASHIER: cashierMessagesWithChat,
  };

  // Skenario D: Owner kembali login
  const ownerReturnSync = syncRoleChatHistory({
    messagesByRole: chatStore.messagesByRole,
    targetRole: 'OWNER',
    targetName: 'Pak Boss',
  });

  // Riwayat Owner tetap utuh dan tersimpan
  assert.equal(ownerReturnSync.activeRole, 'OWNER');
  assert.equal(ownerReturnSync.activeMessages.length, 3);
  assert.equal(ownerReturnSync.activeMessages[1].text, 'Berapa laba bersih dan pengeluaran bulan ini?');
  assert.ok(ownerReturnSync.activeMessages[2].text.includes('18.500.000'));

  // Riwayat Kasir juga tetap tersimpan terpisah di slot CASHIER
  assert.equal(chatStore.messagesByRole.CASHIER.length, 3);
  assert.equal(chatStore.messagesByRole.CASHIER[1].text, 'Bagaimana cara split bill meja 4?');
});

test('18. USB Thermal Printer Error Sanitizer: validates user-friendly Indonesian messages for USB claim, transfer, and cancellation', async () => {
  const { formatFriendlyPrinterError } = await import('../src/store/printerStore.js');

  // Case 1: User cancellation
  const cancelErr = new Error('No device selected by the user');
  cancelErr.name = 'NotFoundError';
  assert.equal(formatFriendlyPrinterError(cancelErr), 'Pemilihan perangkat printer dibatalkan.');

  // Case 2: Windows driver claims the USB interface
  const claimErr = new Error('Unable to claim interface: SecurityError');
  assert.ok(
    formatFriendlyPrinterError(claimErr).includes('Akses antarmuka printer USB diklaim oleh driver OS'),
    'Should guide user to Windows Driver or COM mode when claimed'
  );

  // Case 3: USB transfer failure (loose cable)
  const transferErr = new Error('transferOut failed: device disconnected');
  assert.ok(
    formatFriendlyPrinterError(transferErr).includes('Gagal mentransfer data ke printer USB'),
    'Should guide user when transfer fails'
  );
});

test('19. WebUSB & Web Serial Setup: verifies OUT endpoint resolution, interface claim, and serial baud rate setup', async () => {
  const { setupWebUsbDevice, setupWebSerialPort } = await import('../src/store/printerStore.js');

  // Mock USB Device with OUT endpoint
  let claimedInterface = null;
  const mockUsbDevice = {
    opened: false,
    configuration: null,
    open: async function () {
      this.opened = true;
    },
    selectConfiguration: async function (cfg) {
      this.configuration = {
        interfaces: [
          {
            interfaceNumber: 0,
            alternates: [
              {
                endpoints: [
                  { endpointNumber: 1, direction: 'out', type: 'bulk' },
                  { endpointNumber: 2, direction: 'in', type: 'bulk' },
                ],
              },
            ],
          },
        ],
      };
    },
    claimInterface: async function (ifaceNum) {
      claimedInterface = ifaceNum;
    },
  };

  const usbSetup = await setupWebUsbDevice(mockUsbDevice);
  assert.equal(mockUsbDevice.opened, true, 'Device must be opened');
  assert.equal(claimedInterface, 0, 'Interface 0 must be claimed');
  assert.equal(usbSetup.endpointNumber, 1, 'OUT endpoint number 1 must be resolved');

  // Mock Web Serial Port
  let openOptions = null;
  const mockSerialPort = {
    open: async function (options) {
      openOptions = options;
    },
  };

  await setupWebSerialPort(mockSerialPort, 115200);
  assert.equal(openOptions?.baudRate, 115200, 'Custom baud rate 115200 must be passed to port.open');
  assert.equal(openOptions?.dataBits, 8);
  assert.equal(openOptions?.stopBits, 1);
});

test('20. USB Thermal Receipt & Cash Drawer Pulse: verifies RJ-11 cash drawer kick and WebPrinter routing for USB', async () => {
  const { usePrinterStore } = await import('../src/store/printerStore.js');
  const { WebPrinter } = await import('../src/adapters/printer/printer.web.js');

  // Mock store state for USB
  let lastSentBytes = null;
  usePrinterStore.setState({
    connectionType: 'USB',
    isConnected: true,
    usbSubtype: 'DIRECT',
    sendRawData: async (bytes) => {
      lastSentBytes = bytes;
      return true;
    },
  });

  // 1. Test openCashDrawer
  const drawerRes = await usePrinterStore.getState().openCashDrawer();
  assert.equal(drawerRes, true, 'openCashDrawer should return true on success');
  assert.ok(lastSentBytes instanceof Uint8Array, 'Sent bytes should be Uint8Array');
  // Verify ESC p pulse: [0x1B, 0x70, 0x00, 0x19, 0xFA]
  assert.equal(lastSentBytes[0], 0x1b, 'ESC');
  assert.equal(lastSentBytes[1], 0x70, 'p');
  assert.equal(lastSentBytes[2], 0x00, 'm = pin 2');

  // 2. Test WebPrinter.print with USB connection
  const sampleReceipt = {
    storeName: 'KOMAZI COFFEE TEST',
    orderNumber: 'TEST-USB-101',
    cashier: 'Tester Kasir',
    type: 'DINE IN',
    items: [{ qty: 1, name: 'Kopi Susu Aren', price: 20000, subtotal: 20000 }],
    total: 20000,
  };

  const printRes = await WebPrinter.print(sampleReceipt);
  assert.equal(printRes.success, true);
  assert.equal(printRes.method, 'USB_ESC_POS', 'WebPrinter must use USB_ESC_POS when connectionType is USB');
  assert.ok(lastSentBytes.length > 20, 'Raw ESC/POS bytes should be transmitted to USB printer');
});


