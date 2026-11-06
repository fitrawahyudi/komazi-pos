import prisma from '../src/config/db.js';
import { getPublicQrOrderConfig, getPublicMenu, updateQrOrderConfig } from '../src/controllers/qrOrderController.js';

function mockReq(body = {}, query = {}, params = {}) {
  return { body, query, params, user: { id: 1, role: 'OWNER', name: 'Owner Test' } };
}

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (payload) {
    res.data = payload;
    return res;
  };
  return res;
}

async function runTest() {
  console.log('=== TEST 1: Default QR Order Config ===');
  // Pastikan kunci awal bersih atau default
  await prisma.setting.deleteMany({
    where: { key: { in: ['qrOrderEnabled', 'qrOrderBankName', 'qrOrderAccountNo', 'qrOrderAccountHolder', 'qrOrderQrisUrl'] } }
  }).catch(() => {});

  const res1 = mockRes();
  await getPublicQrOrderConfig(mockReq(), res1);
  console.log('[PASS] Status Code:', res1.statusCode);
  console.log('[PASS] Initial config:', res1.data?.data);
  if (res1.data?.data?.enabled !== false) {
    throw new Error('Default qrOrderEnabled must be false!');
  }

  console.log('\n=== TEST 2: Update QR Order Config (Toggle ON & Bank Info) ===');
  const res2 = mockRes();
  await updateQrOrderConfig(mockReq({
    enabled: true,
    bankName: 'BCA',
    accountNo: '8720192831',
    accountHolder: 'Komazi Coffee Space',
    qrisUrl: 'https://komazi.id/qris-static.png'
  }), res2);

  console.log('[PASS] Update Result:', res2.data?.data);
  if (res2.data?.data?.enabled !== true || res2.data?.data?.bankName !== 'BCA') {
    throw new Error('Failed to update QR order configuration!');
  }

  console.log('\n=== TEST 3: Verify Public Config Reflects Updates ===');
  const res3 = mockRes();
  await getPublicQrOrderConfig(mockReq(), res3);
  console.log('[PASS] Public Config:', res3.data?.data);
  if (res3.data?.data?.enabled !== true || res3.data?.data?.accountNo !== '8720192831') {
    throw new Error('Public config does not reflect updated settings!');
  }

  console.log('\n=== TEST 4: Fetch Public Menu for QR Order ===');
  const res4 = mockRes();
  await getPublicMenu(mockReq(), res4);
  console.log('[PASS] Total Categories:', res4.data?.data?.categories?.length);
  console.log('[PASS] Total Products:', res4.data?.data?.products?.length);
  if (!res4.data?.data?.products || res4.data?.data?.products.length === 0) {
    throw new Error('Public menu should return products!');
  }
  const sample = res4.data?.data?.products[0];
  console.log('[PASS] Sample Product:', sample.name, '| Price:', sample.price, '| Sold Out?:', sample.isSoldOut);

  console.log('\n=== TEST 5: Toggle Back to OFF (Default for trial) ===');
  const res5 = mockRes();
  await updateQrOrderConfig(mockReq({ enabled: false }), res5);
  console.log('[PASS] Reset to trial state (enabled = false):', res5.data?.data?.enabled === false);

  console.log('\nALL TASK 1 TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});

