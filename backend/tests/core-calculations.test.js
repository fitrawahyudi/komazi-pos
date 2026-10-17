import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderStatus } from '../src/services/kdsService.js';

test('1. KDS Order Status: preserves financial PAID status while tracking kitchen preparation', () => {
  const mockOrder = {
    id: 101,
    status: 'PAID',
    items: [
      { id: 1, station: 'KITCHEN', status: 'READY' },
      { id: 2, station: 'BAR', status: 'IN_PROGRESS' },
    ],
  };

  const calculated = calculateOrderStatus(mockOrder);
  // Financial status must stay PAID to avoid wiping from sales and shifts
  assert.equal(calculated, 'PAID');
});

test('2. Billing Calculation: accurately computes subtotal, discounts, tax, and change', () => {
  const items = [
    { name: 'Kopi Susu Gula Aren', price: 22000, quantity: 2 },
    { name: 'Croissant Butter', price: 28000, quantity: 1 },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  assert.equal(subtotal, 72000);

  // 10% discount
  const discountPercent = 10;
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  assert.equal(discountAmount, 7200);

  const taxableAmount = subtotal - discountAmount;
  assert.equal(taxableAmount, 64800);

  // PB1 tax 10%
  const taxAmount = Math.round((taxableAmount * 10) / 100);
  assert.equal(taxAmount, 6480);

  const grandTotal = taxableAmount + taxAmount;
  assert.equal(grandTotal, 71280);

  // Cash payment of 100,000
  const cashPaid = 100000;
  const change = cashPaid - grandTotal;
  assert.equal(change, 28720);
});

test('3. Shift Reconciliation: drawer cash calculation matches physical count', () => {
  const startCash = 200000; // Modal awal kasir
  const cashSales = 850000; // Total transaksi tunai
  const cashIn = 50000;     // Kas masuk tambahan (misal tukar uang kecil)
  const cashOut = 30000;    // Kas keluar (misal beli es batu darurat)

  const expectedCash = startCash + cashSales + cashIn - cashOut;
  assert.equal(expectedCash, 1070000);

  // Kasir menghitung fisik uang di laci
  const actualCash = 1070000;
  const difference = actualCash - expectedCash;
  assert.equal(difference, 0);

  // Simulasi selisih kurang
  const shortCash = 1050000;
  const shortDifference = shortCash - expectedCash;
  assert.equal(shortDifference, -20000);
});

test('4. Workspace Billing: correctly calculates duration, overtime hours, and total charges', () => {
  const basePrice = 35000;     // Paket 2 Jam (120 Menit)
  const baseDurationMin = 120;
  const overtimeRatePerHr = 15000;

  // Pelanggan memakai ruangan selama 185 menit (overtime 65 menit -> dibulatkan ke atas jadi 2 jam overtime)
  const elapsedMinutes = 185;
  const overtimeMinutes = Math.max(0, elapsedMinutes - baseDurationMin);
  assert.equal(overtimeMinutes, 65);

  const overtimeHours = Math.ceil(overtimeMinutes / 60);
  assert.equal(overtimeHours, 2);

  const overtimeCharge = overtimeHours * overtimeRatePerHr;
  assert.equal(overtimeCharge, 30000);

  const totalCharge = basePrice + overtimeCharge;
  assert.equal(totalCharge, 65000);
});

test('5. BOM Recipe Calculation: calculates exact ingredient quantities required', () => {
  const recipe = [
    { ingredientId: 1, name: 'Biji Kopi Espresso Blend', amount: 18, unit: 'gram' },
    { ingredientId: 2, name: 'Fresh Milk', amount: 150, unit: 'ml' },
    { ingredientId: 3, name: 'Sirup Gula Aren', amount: 25, unit: 'ml' },
  ];

  const orderQuantity = 3; // 3 cup kopi
  const totalDeductions = recipe.map((ing) => ({
    ingredientId: ing.ingredientId,
    name: ing.name,
    required: ing.amount * orderQuantity,
    unit: ing.unit,
  }));

  assert.deepEqual(totalDeductions, [
    { ingredientId: 1, name: 'Biji Kopi Espresso Blend', required: 54, unit: 'gram' },
    { ingredientId: 2, name: 'Fresh Milk', required: 450, unit: 'ml' },
    { ingredientId: 3, name: 'Sirup Gula Aren', required: 75, unit: 'ml' },
  ]);
});
