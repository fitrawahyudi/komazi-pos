import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app.js';
import prisma from '../src/config/db.js';

async function runCashierSessionTests() {
  console.log('🧪 Starting End-to-End Test for Cashier Sessions & POS Register Management...\n');
  await prisma.$connect();

  const server = app.listen(4005);
  const BASE_URL = 'http://localhost:4005/api/v1';

  try {
    // 1. Login as Owner to get auth token
    console.log('1️⃣ Logging in as owner...');
    const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'password123' }),
    });
    const ownerData = await ownerLoginRes.json();
    if (!ownerData.success) throw new Error('Owner login failed: ' + ownerData.message);
    const ownerToken = ownerData.data.token;
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    // 2. Login as cashier (or create one if needed) to test multi-cashier session
    console.log('2️⃣ Logging in as cashier...');
    let cashierLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'password123' }),
    });
    let cashierData = await cashierLoginRes.json();
    let cashierToken = cashierData.data?.token;

    if (!cashierData.success) {
      // Create test cashier
      const cashierUser = await prisma.user.upsert({
        where: { username: 'kasir_test' },
        update: {},
        create: {
          name: 'Budi Kasir',
          username: 'kasir_test',
          password: ownerData.data.user.password || '$2a$10$wT3wY222sB3p82n8Z2', // dummy or hash
          role: 'CASHIER',
        },
      });
      console.log('   Created test cashier:', cashierUser.name);
    }

    // 3. Test GET /shifts/registers
    console.log('3️⃣ Testing GET /shifts/registers ...');
    const regRes = await fetch(`${BASE_URL}/shifts/registers`, { headers: ownerHeaders });
    const regData = await regRes.json();
    console.log('   Status:', regRes.status, 'Registers count:', regData.data?.length);
    if (!regData.success || !regData.data?.length) throw new Error('Registers fetch failed');
    const defaultRegister = regData.data[0];
    console.log('   Default register:', defaultRegister.name, `(${defaultRegister.code})`);

    // Clean up any stale active shifts on defaultRegister for clean test run
    await prisma.shift.updateMany({
      where: { registerId: defaultRegister.id, closedAt: null },
      data: { closedAt: new Date() },
    });

    // 4. Test POST /shifts/open
    console.log('4️⃣ Testing POST /shifts/open (Opening cash float: Rp 200.000)...');
    const openRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        openingCash: 200000,
        registerId: defaultRegister.id,
      }),
    });
    const openData = await openRes.json();
    console.log('   Status:', openRes.status, 'Opened shift ID:', openData.data?.id);
    if (!openData.success) throw new Error('Shift opening failed: ' + openData.message);
    const activeShiftId = openData.data.id;

    // 5. Test Rule: Cannot open second shift on same register
    console.log('5️⃣ Testing Rule: Duplicate open on same register must fail...');
    const dupOpenRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        openingCash: 150000,
        registerId: defaultRegister.id,
      }),
    });
    const dupOpenData = await dupOpenRes.json();
    console.log('   Status:', dupOpenRes.status, 'Response message:', dupOpenData.message);
    if (dupOpenRes.status !== 400) throw new Error('Duplicate shift open was NOT blocked!');
    console.log('   ✅ Successfully rejected duplicate open shift!');

    // 6. Test Cash Movement: CASH_IN (Modal Tambahan Rp 50.000)
    console.log('6️⃣ Testing POST /shifts/movements (CASH_IN: Rp 50.000)...');
    const cashInRes = await fetch(`${BASE_URL}/shifts/movements`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        type: 'CASH_IN',
        amount: 50000,
        reason: 'Tambahan Uang Kembalian Pecahan 5rb',
        shiftId: activeShiftId,
      }),
    });
    const cashInData = await cashInRes.json();
    console.log('   Status:', cashInRes.status, 'Movement ID:', cashInData.data?.id);
    if (!cashInData.success) throw new Error('Cash In movement failed: ' + cashInData.message);

    // 7. Test Cash Movement: CASH_OUT (Beli Es Batu Rp 25.000)
    console.log('7️⃣ Testing POST /shifts/movements (CASH_OUT: Rp 25.000)...');
    const cashOutRes = await fetch(`${BASE_URL}/shifts/movements`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        type: 'CASH_OUT',
        amount: 25000,
        reason: 'Beli Es Batu Kristal Darurat 2 Pack',
        shiftId: activeShiftId,
      }),
    });
    const cashOutData = await cashOutRes.json();
    console.log('   Status:', cashOutRes.status, 'Movement ID:', cashOutData.data?.id);
    if (!cashOutData.success) throw new Error('Cash Out movement failed: ' + cashOutData.message);

    // 8. Test Sale creation (Cash sale: Rp 35.000)
    console.log('8️⃣ Testing POST /orders (Cash transaction on active shift)...');
    const product = await prisma.product.findFirst({ where: { isActive: true } });
    if (!product) throw new Error('No active product found for order test');

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        type: 'TAKE_AWAY',
        customerName: 'Pelanggan Uji Sesi',
        shiftId: activeShiftId,
        items: [
          {
            productId: product.id,
            qty: 1,
            unitPrice: parseFloat(product.price),
            lineTotal: parseFloat(product.price),
          },
        ],
        payments: [
          {
            method: 'CASH',
            amount: parseFloat(product.price),
            tendered: parseFloat(product.price),
            change: 0,
          },
        ],
      }),
    });
    const orderData = await orderRes.json();
    console.log('   Status:', orderRes.status, 'Invoice:', orderData.data?.invoiceNo, 'Total:', orderData.data?.total);
    if (!orderData.success) throw new Error('Order creation failed: ' + orderData.message);

    // 9. Test GET /shifts/current -> verify mathematical expected cash formula:
    // Expected = openingCash (200k) + cashSales (product.price) + cashIn (50k) - cashOut (25k)
    console.log('9️⃣ Testing GET /shifts/current and formula verification...');
    const currentRes = await fetch(`${BASE_URL}/shifts/current`, { headers: ownerHeaders });
    const currentData = await currentRes.json();
    const currentShift = currentData.data;
    console.log('   Opening Cash:', currentShift.openingCash);
    console.log('   Cash Sales:', currentShift.totalCashSales);
    console.log('   Total Cash In:', currentShift.totalCashIn);
    console.log('   Total Cash Out:', currentShift.totalCashOut);
    console.log('   Expected Cash:', currentShift.expectedCash);

    const calculatedExpected = 200000 + parseFloat(product.price) + 50000 - 25000;
    if (Math.abs(currentShift.expectedCash - calculatedExpected) > 0.01) {
      throw new Error(`Formula mismatch: expected ${calculatedExpected}, got ${currentShift.expectedCash}`);
    }
    console.log('   ✅ Expected cash formula matches 100%!');

    // 10. Test GET /shifts/:id/movements
    console.log('🔟 Testing GET /shifts/:id/movements ...');
    const movListRes = await fetch(`${BASE_URL}/shifts/${activeShiftId}/movements`, { headers: ownerHeaders });
    const movListData = await movListRes.json();
    console.log('   Status:', movListRes.status, 'Movements returned:', movListData.data?.length);
    if (!movListData.success || movListData.data?.length < 2) throw new Error('Movements listing failed');

    // 11. Test POST /shifts/close with counted cash (Rp 10.000 surplus)
    const countedCash = currentShift.expectedCash + 10000;
    console.log(`1️⃣1️⃣ Testing POST /shifts/close (Counted: Rp ${countedCash}, Surplus: Rp 10.000)...`);
    const closeRes = await fetch(`${BASE_URL}/shifts/close`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        closingCash: countedCash,
        notes: 'Uji penutupan sesi otomatis - selisih kas fisik +Rp 10.000',
        shiftId: activeShiftId,
      }),
    });
    const closeData = await closeRes.json();
    console.log('   Status:', closeRes.status, 'Difference:', closeData.data?.difference);
    if (!closeData.success) throw new Error('Shift close failed: ' + closeData.message);
    if (closeData.data?.difference !== 10000) {
      throw new Error(`Difference mismatch: expected 10000, got ${closeData.data?.difference}`);
    }
    console.log('   ✅ Shift closed and variance recorded properly!');

    // 12. Test Rule: Order rejected when shift is CLOSED
    console.log('1️⃣2️⃣ Testing Rule: Order creation on CLOSED shift must be rejected...');
    const rejectedOrderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        type: 'TAKE_AWAY',
        shiftId: activeShiftId,
        items: [{ productId: product.id, qty: 1, unitPrice: parseFloat(product.price), lineTotal: parseFloat(product.price) }],
        payments: [{ method: 'CASH', amount: parseFloat(product.price) }],
      }),
    });
    const rejectedOrderData = await rejectedOrderRes.json();
    console.log('   Status:', rejectedOrderRes.status, 'Message:', rejectedOrderData.message);
    if (rejectedOrderRes.status !== 400) throw new Error('Order on closed shift was NOT rejected!');
    console.log('   ✅ Successfully rejected order on closed shift!');

    // 13. Test GET /shifts/:id (Z-Report / Detail)
    console.log('1️⃣3️⃣ Testing GET /shifts/:id (Z-Report detail audit)...');
    const detailRes = await fetch(`${BASE_URL}/shifts/${activeShiftId}`, { headers: ownerHeaders });
    const detailData = await detailRes.json();
    console.log('   Status:', detailRes.status, 'Z-Report orders count:', detailData.data?.ordersCount);
    console.log('   Payment methods breakdown:', detailData.data?.paymentMethodsSummary);
    console.log('   Cashiers breakdown:', detailData.data?.cashiers);
    if (!detailData.success) throw new Error('Shift detail fetch failed');

    // 14. Verify Audit Logs recorded
    console.log('1️⃣4️⃣ Verifying AuditLog trail in database...');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: { in: ['SHIFT_OPEN', 'SHIFT_CLOSE', 'CASH_MOVEMENT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('   Found audit logs:', auditLogs.map((l) => `${l.action} (userId: ${l.userId})`).join(', '));
    if (auditLogs.length < 3) throw new Error('Audit log entries missing');
    console.log('   ✅ Audit trail fully verified!');

    console.log('\n======================================================');
    console.log('🎉 ALL CASHIER SESSIONS E2E TESTS PASSED 100% SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runCashierSessionTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
