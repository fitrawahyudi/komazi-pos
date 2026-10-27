import assert from 'node:assert/strict';
import {
  getPromoPresets,
  getPromoVouchers,
  validateVoucher,
  consumeVoucher,
  createPromoVoucher,
  updatePromoVoucher,
  deletePromoVoucher,
  savePromoVouchers,
  _resetPromoCacheForTesting,
} from '../src/services/promoService.js';

async function runTests() {
  console.log('--- TEST PROMO SERVICE & VALIDATOR ENGINE ---');
  _resetPromoCacheForTesting();

  // Test 1: Get Presets
  const presets = await getPromoPresets();
  assert.ok(Array.isArray(presets), 'Presets should be an array');
  assert.ok(presets.length >= 3, 'Should have at least 3 default presets');
  const staffPreset = presets.find((p) => p.name.includes('Karyawan'));
  assert.ok(staffPreset, 'Should contain Karyawan preset');
  assert.strictEqual(staffPreset.value, 20);
  console.log('✓ Test 1 Passed: Promo presets loaded successfully.');

  // Test 2: Get Vouchers
  const vouchers = await getPromoVouchers();
  assert.ok(Array.isArray(vouchers), 'Vouchers should be an array');
  const komazi10 = vouchers.find((v) => v.code === 'KOMAZI10');
  assert.ok(komazi10, 'Should contain KOMAZI10 voucher');
  console.log('✓ Test 2 Passed: Promo vouchers loaded successfully.');

  // Test 3: Validate Empty Code
  const emptyRes = await validateVoucher('', 50000);
  assert.strictEqual(emptyRes.valid, false);
  assert.strictEqual(emptyRes.reason, 'EMPTY_CODE');
  console.log('✓ Test 3 Passed: Empty voucher code rejected.');

  // Test 4: Validate Non-existent Code
  const notFoundRes = await validateVoucher('RANDOM_KODE_123', 50000);
  assert.strictEqual(notFoundRes.valid, false);
  assert.strictEqual(notFoundRes.reason, 'NOT_FOUND');
  console.log('✓ Test 4 Passed: Unknown voucher code rejected.');

  // Test 5: Validate Minimum Spend Failure
  // KOMAZI10 has minSpend = 40000
  const minSpendFail = await validateVoucher('KOMAZI10', 30000);
  assert.strictEqual(minSpendFail.valid, false);
  assert.strictEqual(minSpendFail.reason, 'MIN_SPEND_NOT_MET');
  console.log('✓ Test 5 Passed: Minimum spend check rejected below limit.');

  // Test 6: Validate Percent Discount Calculation
  // KOMAZI10 has 10%, minSpend 40000, maxDiscount 20000
  // On subtotal 100.000 -> 10% = 10.000
  const validPercent = await validateVoucher('komazi10', 100000); // case insensitive
  assert.strictEqual(validPercent.valid, true);
  assert.strictEqual(validPercent.voucher.discountAmount, 10000);
  assert.strictEqual(validPercent.voucher.code, 'KOMAZI10');
  console.log('✓ Test 6 Passed: Percent discount calculated accurately (Rp 10.000).');

  // Test 7: Validate Max Discount Cap
  // On subtotal 300.000 -> 10% is 30.000, but capped at maxDiscount 20.000
  const cappedPercent = await validateVoucher('KOMAZI10', 300000);
  assert.strictEqual(cappedPercent.valid, true);
  assert.strictEqual(cappedPercent.voucher.discountAmount, 20000);
  console.log('✓ Test 7 Passed: Max discount cap enforced (Rp 20.000).');

  // Test 8: Validate Nominal Voucher
  // HEMAT15K has value 15000, minSpend 60000
  const validNominal = await validateVoucher('HEMAT15K', 80000);
  assert.strictEqual(validNominal.valid, true);
  assert.strictEqual(validNominal.voucher.discountAmount, 15000);
  console.log('✓ Test 8 Passed: Nominal voucher applied accurately (Rp 15.000).');

  // Test 9: Validate Inactive / Expired / Quota Exceeded
  await savePromoVouchers([
    ...vouchers,
    {
      code: 'EXPIRED_CODE',
      name: 'Voucher Hangus',
      type: 'NOMINAL',
      value: 10000,
      minSpend: 0,
      quota: 100,
      usedCount: 0,
      startDate: '2020-01-01',
      endDate: '2020-12-31',
      isActive: true,
    },
    {
      code: 'HABIS_QUOTA',
      name: 'Voucher Sold Out',
      type: 'NOMINAL',
      value: 10000,
      minSpend: 0,
      quota: 10,
      usedCount: 10,
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      isActive: true,
    },
    {
      code: 'NON_AKTIF',
      name: 'Voucher Off',
      type: 'NOMINAL',
      value: 10000,
      minSpend: 0,
      quota: 100,
      usedCount: 0,
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      isActive: false,
    },
  ]);

  const expiredCheck = await validateVoucher('EXPIRED_CODE', 50000);
  assert.strictEqual(expiredCheck.valid, false);
  assert.strictEqual(expiredCheck.reason, 'EXPIRED');

  const quotaCheck = await validateVoucher('HABIS_QUOTA', 50000);
  assert.strictEqual(quotaCheck.valid, false);
  assert.strictEqual(quotaCheck.reason, 'QUOTA_EXCEEDED');

  const inactiveCheck = await validateVoucher('NON_AKTIF', 50000);
  assert.strictEqual(inactiveCheck.valid, false);
  assert.strictEqual(inactiveCheck.reason, 'INACTIVE');
  console.log('✓ Test 9 Passed: Expired, Quota Exceeded, and Inactive states handled cleanly.');

  // Test 10: Consume Voucher
  const beforeConsume = (await getPromoVouchers()).find((v) => v.code === 'KOMAZI10');
  const countBefore = beforeConsume.usedCount || 0;
  const consumed = await consumeVoucher('KOMAZI10');
  assert.strictEqual(consumed, true);
  const afterConsume = (await getPromoVouchers()).find((v) => v.code === 'KOMAZI10');
  assert.strictEqual(afterConsume.usedCount, countBefore + 1);
  console.log('✓ Test 10 Passed: Voucher consumption incremented usedCount.');

  // Restore original vouchers to keep database pristine
  await savePromoVouchers(vouchers);

  console.log('ALL PROMO SERVICE UNIT TESTS PASSED SUCCESSFULLY! ✓✓✓');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
