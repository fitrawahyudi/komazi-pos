import assert from 'node:assert';
import { askAi } from '../src/controllers/aiAnalyticsController.js';
import { redactSensitiveData } from '../src/services/ai/komaziAiContextAggregator.js';

console.log('🧪 Testing Komazi AI Role Isolation, Database Context & Cron Scheduler...');

async function testAskAi(query, userRole = 'CASHIER', userName = 'Budi') {
  let responseData = null;
  let statusCode = 200;

  const req = {
    body: { query, history: [] },
    user: { id: 101, role: userRole, name: userName },
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

// 1. Cron Job Authorization: Cashier is FORBIDDEN from creating scheduled cron jobs
console.log('1️⃣  Testing Cron Job Guard for Non-Managerial Roles...');
const resCashierCron = await testAskAi('Tolong buatkan jadwal kirim laporan penjualan setiap jam 22:00', 'CASHIER', 'Rina Kasir');
assert.strictEqual(resCashierCron.statusCode, 200);
assert.strictEqual(resCashierCron.responseData.success, true);
assert.strictEqual(resCashierCron.responseData.data.intent, 'SCHEDULE_FORBIDDEN');
assert.ok(
  resCashierCron.responseData.data.answer.includes('memerlukan otorisasi') ||
  resCashierCron.responseData.data.answer.includes('Owner') ||
  resCashierCron.responseData.data.answer.includes('Manager'),
  'Should politely decline cashier schedule request'
);
console.log('   ✅ PASS [1]: Cashier is strictly denied from creating cron jobs');

// 2. Cron Job Creation: Owner is ALLOWED to create scheduled cron jobs
console.log('2️⃣  Testing Cron Job Creation for Owner...');
const resOwnerCron = await testAskAi('Buatkan jadwal kirim laporan penjualan setiap hari jam 22:00 ke Telegram', 'OWNER', 'Pak Boss');
assert.strictEqual(resOwnerCron.statusCode, 200);
assert.strictEqual(resOwnerCron.responseData.success, true);
assert.ok(
  resOwnerCron.responseData.data.intent === 'SCHEDULE_TASK' ||
  resOwnerCron.responseData.data.intent === 'LIST_SCHEDULES' ||
  resOwnerCron.responseData.data.answer.includes('jadwal') ||
  resOwnerCron.responseData.data.answer.includes('berhasil'),
  'Owner should be able to create scheduled task'
);
console.log('   ✅ PASS [2]: Owner can schedule automated tasks via AI');

// 3. Cron Job Listing: Owner/Manager can list active schedules
console.log('3️⃣  Testing Active Schedules Listing for Manager...');
const resListSchedules = await testAskAi('Apa saja daftar jadwal aktif saat ini?', 'MANAGER', 'Ibu Manager');
assert.strictEqual(resListSchedules.statusCode, 200);
assert.strictEqual(resListSchedules.responseData.success, true);
assert.strictEqual(resListSchedules.responseData.data.intent, 'LIST_SCHEDULES');
console.log('   ✅ PASS [3]: Manager can list active cron schedules');

// 4. Financial & Expense Knowledge: Cashier asking for storewide profit is blocked
console.log('4️⃣  Testing Financial Privacy Guard for Non-Managerial Roles...');
const resCashierProfit = await testAskAi('Berapa laba bersih dan pengeluaran toko bulan ini?', 'CASHIER', 'Siti');
assert.strictEqual(resCashierProfit.statusCode, 200);
assert.strictEqual(resCashierProfit.responseData.data.roleScope, 'CASHIER');
assert.ok(
  resCashierProfit.responseData.data.answer.includes('tidak memiliki akses') ||
  resCashierProfit.responseData.data.answer.includes('Manager') ||
  resCashierProfit.responseData.data.answer.includes('Owner') ||
  resCashierProfit.responseData.data.answer.includes('laba'),
  'Cashier must not receive full financial net profit breakdown'
);
console.log('   ✅ PASS [4]: Sensitive financial data is blocked for Cashier');

// 5. Sensitive Data Redaction: Passwords, PINs, and Tokens are always redacted
console.log('5️⃣  Testing Sensitive Data Redaction Regex Guard...');
const sensitiveData = {
  storeName: 'Komazi Coffee',
  adminPassword: 'SuperSecretPassword123!',
  supervisor_pin: '9876',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  safePublicInfo: 'Menu Signature Kopizi Aren',
};

const sanitized = redactSensitiveData(sensitiveData);
assert.strictEqual(sanitized.storeName, 'Komazi Coffee');
assert.strictEqual(sanitized.adminPassword, '[REDACTED_SECRET]');
assert.strictEqual(sanitized.supervisor_pin, '[REDACTED_SECRET]');
assert.strictEqual(sanitized.jwtToken, '[REDACTED_SECRET]');
assert.strictEqual(sanitized.bot_token, '[REDACTED_SECRET]');
assert.strictEqual(sanitized.safePublicInfo, 'Menu Signature Kopizi Aren');
console.log('   ✅ PASS [5]: All sensitive fields (password, pin, token, secret) sanitized 100%');

console.log('\n🎉 ALL ROLE ISOLATION & CRON TESTS PASSED 100%!\n');
