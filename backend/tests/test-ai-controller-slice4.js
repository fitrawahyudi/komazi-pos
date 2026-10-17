import assert from 'node:assert';
import { askAi } from '../src/controllers/aiAnalyticsController.js';

console.log('🧪 Testing AI Analytics Controller & Action Hints (Slice 4)...');

async function testAskAi(query, userRole = 'CASHIER', userName = 'Siti') {
  let responseData = null;
  let statusCode = 200;

  const req = {
    body: { query, history: [] },
    user: { id: 99, role: userRole, name: userName },
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
  };

  await askAi(req, res);
  return { statusCode, responseData };
}

// 1. Test POS SOP query (Split Bill)
const res1 = await testAskAi('Bagaimana cara split bill pesanan meja 3?', 'CASHIER');
assert.strictEqual(res1.statusCode, 200);
assert.strictEqual(res1.responseData.success, true);
assert.strictEqual(res1.responseData.data.intent, 'POS_MANUAL');
assert.ok(res1.responseData.data.actionHint, 'Should include actionHint');
assert.strictEqual(res1.responseData.data.actionHint.type, 'NAVIGATE');
assert.strictEqual(res1.responseData.data.actionHint.targetModal, 'OPEN_BILLS');
assert.ok(res1.responseData.data.answer.includes('Split Bill') || res1.responseData.data.answer.includes('Pemisahan'), 'Answer should contain Split Bill steps');
console.log('   ✅ PASS [1]: askAi successfully handles POS_MANUAL with actionHint');

// 2. Test Printer inquiry
const resPrinter = await testAskAi('Kenapa printer thermal bluetooth tidak konek?', 'CASHIER');
assert.strictEqual(resPrinter.responseData.data.intent, 'POS_MANUAL');
assert.strictEqual(resPrinter.responseData.data.actionHint.type, 'OPEN_MODAL');
assert.strictEqual(resPrinter.responseData.data.actionHint.targetModal, 'PRINTER_MODAL');
console.log('   ✅ PASS [2]: askAi returns PRINTER_MODAL actionHint for printer questions');

// 3. Test Recipe inquiry
const resRecipe = await testAskAi('Apa resep dan takaran Kopi Susu?', 'BARISTA');
assert.strictEqual(resRecipe.responseData.data.intent, 'INVENTORY_RECIPE');
assert.ok(resRecipe.responseData.data.actionHint, 'Recipe question should have actionHint');
console.log('   ✅ PASS [3]: askAi handles INVENTORY_RECIPE for Barista');

// 4. Test Zero Data Leakage (Cashier asking for storewide profit/revenue)
const resLeak = await testAskAi('Berapa omset bulanan dan laba bersih toko?', 'CASHIER');
assert.strictEqual(resLeak.responseData.data.roleScope, 'CASHIER');
assert.ok(
  resLeak.responseData.data.answer.includes('tidak memiliki akses') ||
  resLeak.responseData.data.answer.includes('Manager') ||
  resLeak.responseData.data.answer.includes('Owner'),
  'Cashier must be restricted from viewing storewide omset'
);
console.log('   ✅ PASS [4]: Strict Zero Data Leakage enforced for Cashier');

console.log('🎉 ALL SLICE 4 TESTS PASSED 100%!');
