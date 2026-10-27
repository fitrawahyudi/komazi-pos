import assert from 'node:assert/strict';
import {
  getPromoPresets,
  getPromoVouchers,
  validateVoucher,
  consumeVoucher,
  _resetPromoCacheForTesting,
} from '../src/services/promoService.js';
import { generateReceiptHtml } from '../src/services/receiptCanvasService.js';

async function runE2ETests() {
  console.log('--- TEST PROMO END-TO-END VERIFICATION ---');
  _resetPromoCacheForTesting();

  // 1. Preset Verification
  console.log('Scenario 1: Testing 1-Click Quick Presets...');
  const presets = await getPromoPresets();
  assert.ok(presets.length >= 4, 'Should contain all 4 standard quick presets');
  const staffPreset = presets.find((p) => p.name.includes('Karyawan'));
  assert.strictEqual(staffPreset.value, 20);
  assert.strictEqual(staffPreset.type, 'PERCENT');

  // Simulate cart subtotal calculation with preset
  const subtotalCart = 150000;
  const staffDiscount = Math.round((subtotalCart * staffPreset.value) / 100);
  assert.strictEqual(staffDiscount, 30000);
  console.log('✓ Scenario 1 Passed: Quick preset calculates accurate 20% discount (Rp 30.000).');

  // 2. Voucher Validation Verification
  console.log('Scenario 2: Testing Promo Voucher Validation & Rules...');
  // Case A: Minimum spend not met
  const belowMinSpend = await validateVoucher('KOMAZI10', 25000);
  assert.strictEqual(belowMinSpend.valid, false);
  assert.strictEqual(belowMinSpend.reason, 'MIN_SPEND_NOT_MET');

  // Case B: Minimum spend met
  const validVoucher = await validateVoucher('KOMAZI10', 80000);
  assert.strictEqual(validVoucher.valid, true);
  assert.strictEqual(validVoucher.voucher.discountAmount, 8000); // 10% of 80.000
  assert.strictEqual(validVoucher.voucher.code, 'KOMAZI10');

  // Case C: Capped percent discount
  const cappedVoucher = await validateVoucher('KOMAZI10', 250000); // 10% is 25.000, capped at 20.000
  assert.strictEqual(cappedVoucher.voucher.discountAmount, 20000);

  // Case D: Nominal discount
  const nominalVoucher = await validateVoucher('HEMAT15K', 70000);
  assert.strictEqual(nominalVoucher.valid, true);
  assert.strictEqual(nominalVoucher.voucher.discountAmount, 15000);
  console.log('✓ Scenario 2 Passed: Voucher rules (min spend, percentage, cap, and nominal) verified.');

  // 3. Voucher Consumption Verification
  console.log('Scenario 3: Testing Voucher Usage Consumption...');
  const vouchersBefore = await getPromoVouchers();
  const targetVoucherBefore = vouchersBefore.find((v) => v.code === 'HEMAT15K');
  const initialUsedCount = targetVoucherBefore.usedCount || 0;

  const consumed = await consumeVoucher('HEMAT15K');
  assert.strictEqual(consumed, true);

  const vouchersAfter = await getPromoVouchers();
  const targetVoucherAfter = vouchersAfter.find((v) => v.code === 'HEMAT15K');
  assert.strictEqual(targetVoucherAfter.usedCount, initialUsedCount + 1);
  console.log('✓ Scenario 3 Passed: Voucher consumption recorded and persisted.');

  // 4. Receipt Canvas Rendering with Promo Name
  console.log('Scenario 4: Testing Canvas Receipt Generation with Promo Details...');
  const sampleOrder = {
    invoiceNo: 'KMZ-TEST-999',
    customerName: 'Budi Santoso',
    cashierName: 'Sarah (Kasir)',
    paymentMethod: 'QRIS Dinamis',
    paidAt: new Date(),
    subtotal: 100000,
    discount: 15000,
    promoName: 'HEMAT15K',
    tax: 0,
    total: 85000,
    items: [
      {
        productName: 'Kopi Susu Komazi',
        variantName: 'Ice (Less Sugar)',
        unitPrice: 25000,
        qty: 4,
        lineTotal: 100000,
      },
    ],
  };

  const html = generateReceiptHtml(sampleOrder);
  assert.ok(html.includes('Budi Santoso'), 'HTML should include customer name');
  assert.ok(html.includes('Sarah (Kasir)'), 'HTML should include cashier name');
  assert.ok(html.includes('Diskon (HEMAT15K)'), 'HTML should render promo name in discount row');
  assert.ok(html.includes('15.000'), 'HTML should show discount amount');
  console.log('✓ Scenario 4 Passed: Canvas receipt template accurately displays promo name and discount amount.');

  console.log('====================================================');
  console.log('ALL PROMO E2E SCENARIOS VERIFIED SUCCESSFULLY! ✓✓✓');
  console.log('====================================================');
  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
