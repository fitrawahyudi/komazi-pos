import assert from 'node:assert/strict';
import {
  getPresetsHandler,
  validateVoucherHandler,
  getVouchersHandler,
  createVoucherHandler,
  deleteVoucherHandler,
} from '../src/controllers/promoController.js';
import { _resetPromoCacheForTesting } from '../src/services/promoService.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('--- TEST PROMO API CONTROLLERS ---');
  _resetPromoCacheForTesting();

  // Test 1: GET /api/promos/presets
  const req1 = {};
  const res1 = createMockRes();
  await getPresetsHandler(req1, res1);
  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res1.body.success, true);
  assert.ok(Array.isArray(res1.body.data), 'Presets data should be an array');
  console.log('✓ Test 1 Passed: GET /api/promos/presets returns 200 OK with presets.');

  // Test 2: POST /api/promos/validate-voucher (valid code)
  const req2 = { body: { code: 'KOMAZI10', subtotal: 100000 } };
  const res2 = createMockRes();
  await validateVoucherHandler(req2, res2);
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.body.success, true);
  assert.strictEqual(res2.body.data.discountAmount, 10000);
  console.log('✓ Test 2 Passed: POST /api/promos/validate-voucher returns 200 with discount.');

  // Test 3: POST /api/promos/validate-voucher (min spend not met)
  const req3 = { body: { code: 'KOMAZI10', subtotal: 20000 } };
  const res3 = createMockRes();
  await validateVoucherHandler(req3, res3);
  assert.strictEqual(res3.statusCode, 400);
  assert.strictEqual(res3.body.success, false);
  assert.strictEqual(res3.body.errors.reason, 'MIN_SPEND_NOT_MET');
  console.log('✓ Test 3 Passed: POST /api/promos/validate-voucher returns 400 when min spend not met.');

  // Test 4: GET /api/promos/vouchers
  const req4 = { user: { role: 'OWNER' } };
  const res4 = createMockRes();
  await getVouchersHandler(req4, res4);
  assert.strictEqual(res4.statusCode, 200);
  assert.ok(Array.isArray(res4.body.data), 'Vouchers data should be array');
  console.log('✓ Test 4 Passed: GET /api/promos/vouchers returns 200 OK.');

  // Test 5: POST /api/promos/vouchers (create new voucher)
  const req5 = {
    user: { role: 'OWNER' },
    body: {
      code: 'TESTNEW50',
      name: 'Voucher Uji 50rb',
      type: 'NOMINAL',
      value: 50000,
      minSpend: 150000,
      quota: 10,
    },
  };
  const res5 = createMockRes();
  await createVoucherHandler(req5, res5);
  assert.strictEqual(res5.statusCode, 201);
  assert.strictEqual(res5.body.data.code, 'TESTNEW50');
  console.log('✓ Test 5 Passed: POST /api/promos/vouchers creates new voucher with 201 Created.');

  // Test 6: DELETE /api/promos/vouchers/:code
  const req6 = { user: { role: 'OWNER' }, params: { code: 'TESTNEW50' } };
  const res6 = createMockRes();
  await deleteVoucherHandler(req6, res6);
  assert.strictEqual(res6.statusCode, 200);
  console.log('✓ Test 6 Passed: DELETE /api/promos/vouchers/:code deletes voucher successfully.');

  console.log('ALL PROMO CONTROLLER API TESTS PASSED SUCCESSFULLY! ✓✓✓');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
