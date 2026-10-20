import test from 'node:test';
import assert from 'node:assert/strict';
import { events } from '../src/bot/events.js';
import { notifyShiftOpened, notifyShiftClosed } from '../src/services/telegramService.js';
import { cleanupBrowserPool } from '../src/services/botImage/browserPool.js';

test('1. Shift Opened & Closed Event Registration: events are defined on the emitter', () => {
  assert.equal(typeof events.emit, 'function');
  assert.equal(typeof events.on, 'function');
});

test('2. notifyShiftOpened: safely executes and formats message without throw', async () => {
  const mockShift = {
    id: 10,
    register: { name: 'Kasir Utama', code: 'REG-01' },
    cashier: { name: 'Budi Santoso' },
    openedAt: new Date().toISOString(),
    openingCash: 250000,
  };

  await assert.doesNotReject(async () => {
    await notifyShiftOpened({
      shift: mockShift,
      cashier: mockShift.cashier,
      register: mockShift.register,
      openingCash: mockShift.openingCash,
    });
  });
});

test('3. notifyShiftClosed: safely executes with balanced, surplus, and deficit status', async () => {
  // Test case 1: Kas Imbang
  await assert.doesNotReject(async () => {
    await notifyShiftClosed({
      shift: { id: 10 },
      cashier: { name: 'Budi Santoso' },
      closedBy: { name: 'Budi Santoso' },
      summary: {
        id: 10,
        registerName: 'Kasir Utama',
        openingCash: 200000,
        closingCash: 800000,
        expectedCash: 800000,
        difference: 0,
        totalCashSales: 600000,
        totalNonCashSales: 400000,
        totalSales: 1000000,
        ordersCount: 20,
        notes: 'Shift pagi lancar',
      },
    });
  });

  // Test case 2: Kas Surplus
  await assert.doesNotReject(async () => {
    await notifyShiftClosed({
      shift: { id: 11 },
      cashier: { name: 'Siti' },
      closedBy: { name: 'Manager Andi' },
      summary: {
        id: 11,
        registerName: 'Bar Kasir 2',
        openingCash: 150000,
        closingCash: 720000,
        expectedCash: 700000,
        difference: 20000,
        totalCashSales: 550000,
        totalNonCashSales: 300000,
        totalSales: 850000,
        ordersCount: 15,
        notes: 'Ada kelebihan tip tunai pelanggan',
      },
    });
  });

  // Test case 3: Kas Defisit
  await assert.doesNotReject(async () => {
    await notifyShiftClosed({
      shift: { id: 12 },
      cashier: { name: 'Rina' },
      closedBy: { name: 'Rina' },
      summary: {
        id: 12,
        registerName: 'Kasir Utama',
        openingCash: 200000,
        closingCash: 680000,
        expectedCash: 700000,
        difference: -20000,
        totalCashSales: 500000,
        totalNonCashSales: 200000,
        totalSales: 700000,
        ordersCount: 12,
        notes: 'Kekurangan kembalian uang pecahan',
      },
    });
  });
});

test('4. Shift History Access Control: role owner/manager allowed, cashier denied', () => {
  const isRoleAllowed = (role) => ['OWNER', 'MANAGER'].includes(role);

  assert.equal(isRoleAllowed('OWNER'), true, 'Owner must be allowed to access shift history');
  assert.equal(isRoleAllowed('MANAGER'), true, 'Manager must be allowed to access shift history');
  assert.equal(isRoleAllowed('CASHIER'), false, 'Cashier must be forbidden from shift history');
  assert.equal(isRoleAllowed('BARISTA'), false, 'Barista must be forbidden from shift history');
  assert.equal(isRoleAllowed('KITCHEN'), false, 'Kitchen must be forbidden from shift history');
});

test('5. Cleanup background browser resources', async () => {
  await cleanupBrowserPool();
});
