import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { invalidateSettingsCache } from '../src/services/settingsCache.service.js';

async function runScheduleGuardTests() {
  console.log('🧪 Starting Schedule Guard E2E Test (Presensi, Shift & Transaksi)...\n');
  await prisma.$connect();

  const PORT = 4009;
  const server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  let passed = 0;
  let total = 0;

  function assert(condition, message, detail = null) {
    total++;
    if (condition) {
      console.log(`   ✅ PASS [${total}]: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL [${total}]: ${message}`);
      if (detail) console.error('      Detail:', detail);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Ensure enforceScheduleGuard is activated for strict testing
    await prisma.setting.upsert({
      where: { key: 'enforceScheduleGuard' },
      update: { value: 'true' },
      create: { key: 'enforceScheduleGuard', value: 'true' },
    });
    invalidateSettingsCache();

    // 1. Login as OWNER
    console.log('1️⃣ Authenticating as OWNER...');
    const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'password123' }),
    });
    const ownerData = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200 && ownerData.data?.token, 'Owner login successful');
    const ownerToken = ownerData.data.token;
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    // 2. Login as CASHIER (kasir)
    console.log('2️⃣ Authenticating as CASHIER (kasir)...');
    const cashierLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'password123' }),
    });
    const cashierData = await cashierLoginRes.json();
    assert(cashierLoginRes.status === 200 && cashierData.data?.token, 'Cashier login successful');
    const cashierToken = cashierData.data.token;
    const cashierId = cashierData.data.user.id;
    const cashierHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    };

    // Clean up today's data for this cashier
    console.log('🧹 Cleaning up today\'s schedule, attendance & shifts for test...');
    await prisma.staffSchedule.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.staffAttendance.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.shift.updateMany({
      where: { cashierId, closedAt: null },
      data: { closedAt: new Date() },
    });

    // 3. Test GET /hris/my-schedule-today when NOT scheduled
    console.log('3️⃣ Checking schedule status for unscheduled cashier...');
    const mySchedRes = await fetch(`${BASE_URL}/hris/my-schedule-today`, { headers: cashierHeaders });
    const mySchedData = await mySchedRes.json();
    assert(mySchedRes.status === 200 && mySchedData.data?.isScheduled === false, 'Cashier schedule status is false when unscheduled');

    // 4. Test Clock-In blocked when unscheduled
    console.log('4️⃣ Testing Clock-In rejection when cashier has no schedule...');
    const clockInBlockedRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    });
    const clockInBlockedData = await clockInBlockedRes.json();
    assert(clockInBlockedRes.status === 403, 'Clock-In rejected with HTTP 403 when unscheduled', clockInBlockedData);
    assert(clockInBlockedData.message.includes('Jadwal kerja Anda belum diatur'), 'Clock-In returned friendly Indonesian schedule error message');

    // 5. Test Open Shift blocked when unscheduled
    console.log('5️⃣ Testing Open Shift rejection when cashier has no schedule...');
    const openShiftBlockedRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ openingCash: 200000 }),
    });
    const openShiftBlockedData = await openShiftBlockedRes.json();
    assert(openShiftBlockedRes.status === 403, 'Open Shift rejected with HTTP 403 when unscheduled', openShiftBlockedData);
    assert(openShiftBlockedData.message.includes('Jadwal kerja Anda belum diatur'), 'Open Shift returned friendly Indonesian schedule error message');

    // 6. Test Create Order blocked when unscheduled
    console.log('6️⃣ Testing Create Order (Transaksi) rejection when cashier has no schedule...');
    // Ensure there is some product to order
    const product = await prisma.product.findFirst();
    const orderBlockedRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        type: 'DINE_IN',
        items: [{ productId: product?.id || 1, qty: 1, unitPrice: 15000 }],
      }),
    });
    const orderBlockedData = await orderBlockedRes.json();
    assert(orderBlockedRes.status === 403, 'Create Order rejected with HTTP 403 when unscheduled', orderBlockedData);
    assert(orderBlockedData.message.includes('Jadwal kerja Anda belum diatur'), 'Create Order returned friendly Indonesian schedule error message');

    // 7. Verify OWNER is EXEMPT
    console.log('7️⃣ Verifying OWNER is exempt from schedule restriction...');
    const ownerSchedRes = await fetch(`${BASE_URL}/hris/my-schedule-today`, { headers: ownerHeaders });
    const ownerSchedData = await ownerSchedRes.json();
    assert(ownerSchedData.data?.isScheduled === true && ownerSchedData.data?.isOwner === true, 'Owner is marked as scheduled/exempt');

    // 8. Now CREATE a schedule for Cashier today
    console.log('8️⃣ Creating schedule for cashier for today...');
    const createSchedRes = await fetch(`${BASE_URL}/hris/schedules`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        userId: cashierId,
        date: today,
        shiftName: 'PAGI',
        startTime: '07:00',
        endTime: '15:00',
        status: 'PUBLISHED',
      }),
    });
    const createSchedData = await createSchedRes.json();
    assert(createSchedRes.status === 201 && createSchedData.data?.id, 'Schedule created successfully', createSchedData);

    // 9. Check GET /hris/my-schedule-today after schedule creation
    console.log('9️⃣ Verifying cashier schedule status is now true...');
    const mySchedUpdatedRes = await fetch(`${BASE_URL}/hris/my-schedule-today`, { headers: cashierHeaders });
    const mySchedUpdatedData = await mySchedUpdatedRes.json();
    assert(mySchedUpdatedData.data?.isScheduled === true && mySchedUpdatedData.data?.schedule?.id, 'Cashier schedule is now true and active');

    // 10. Test Clock-In SUCCEEDS now that schedule is set
    console.log('🔟 Testing Clock-In after schedule is set...');
    const clockInSuccessRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    });
    const clockInSuccessData = await clockInSuccessRes.json();
    assert(clockInSuccessRes.status === 201 && clockInSuccessData.data?.clockIn, 'Clock-In succeeded with HTTP 201', clockInSuccessData);

    // 11. Test Open Shift SUCCEEDS now that schedule is set
    console.log('1️⃣1️⃣ Testing Open Shift after schedule is set...');
    // Ensure any open shift on register 1 is closed first
    const activeShiftOnReg = await prisma.shift.findFirst({ where: { registerId: 1, closedAt: null } });
    if (activeShiftOnReg) {
      await prisma.shift.update({ where: { id: activeShiftOnReg.id }, data: { closedAt: new Date() } });
    }

    const openShiftSuccessRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ openingCash: 250000, registerId: 1 }),
    });
    const openShiftSuccessData = await openShiftSuccessRes.json();
    assert(openShiftSuccessRes.status === 201 && openShiftSuccessData.data?.id, 'Open Shift succeeded with HTTP 201', openShiftSuccessData);
    const activeShiftId = openShiftSuccessData.data.id;

    // 12. Test Create Order SUCCEEDS now that schedule is set & shift is open
    console.log('1️⃣2️⃣ Testing Create Order (Transaksi) after schedule is set...');
    const orderSuccessRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        type: 'DINE_IN',
        shiftId: activeShiftId,
        items: [{ productId: product?.id || 1, qty: 1, unitPrice: 20000 }],
        payments: [{ method: 'CASH', amount: 20000 }],
      }),
    });
    const orderSuccessData = await orderSuccessRes.json();
    assert(orderSuccessRes.status === 201 && orderSuccessData.data?.id, 'Create Order succeeded with HTTP 201', orderSuccessData);

    // Clean up strict test shift
    await prisma.shift.update({
      where: { id: activeShiftId },
      data: { closedAt: new Date() },
    });
    await prisma.staffAttendance.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.staffSchedule.deleteMany({
      where: { userId: cashierId, date: today },
    });

    // 13. Test Flexible Mode: Staf WAJIB presensi terlebih dahulu baru bisa bertransaksi
    console.log('1️⃣3️⃣ Testing Flexible Mode: Staf WAJIB presensi terlebih dahulu baru bisa transaksi...');
    await prisma.setting.upsert({
      where: { key: 'enforceScheduleGuard' },
      update: { value: 'false' },
      create: { key: 'enforceScheduleGuard', value: 'false' },
    });
    invalidateSettingsCache();

    // 13a. Attempt open shift without attendance -> MUST BE REJECTED 403
    console.log('1️⃣4️⃣ Verifying Open Shift is REJECTED without attendance even if owner hasn\'t set schedule...');
    const openShiftWithoutAttendRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ openingCash: 100000, registerId: 1 }),
    });
    const openShiftWithoutAttendData = await openShiftWithoutAttendRes.json();
    assert(openShiftWithoutAttendRes.status === 403, 'Open shift blocked without attendance when schedule guard is false', openShiftWithoutAttendData);
    assert(openShiftWithoutAttendData.message.includes('Presensi Wajib'), 'Error message instructs cashier to clock-in first');

    // 13b. Cashier performs Clock-In (Presensi)
    console.log('1️⃣5️⃣ Cashier clocks in (Presensi) without schedule...');
    const clockInFlexRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    });
    const clockInFlexData = await clockInFlexRes.json();
    assert(clockInFlexRes.status === 201, 'Cashier clocks in successfully without schedule in flexible mode', clockInFlexData);

    // 13c. Now open shift SUCCEEDS
    console.log('1️⃣6️⃣ Open Shift now SUCCEEDS after Clock-In...');
    const openShiftFlexRes = await fetch(`${BASE_URL}/shifts/open`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ openingCash: 100000, registerId: 1 }),
    });
    const openShiftFlexData = await openShiftFlexRes.json();
    assert(openShiftFlexRes.status === 201, 'Open shift succeeds after cashier has clocked in', openShiftFlexData);
    const flexShiftId = openShiftFlexData.data.id;

    // Clean up
    console.log('🧹 Cleaning up test artifacts...');
    await prisma.shift.update({
      where: { id: flexShiftId },
      data: { closedAt: new Date() },
    });
    await prisma.staffAttendance.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.staffSchedule.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.setting.upsert({
      where: { key: 'enforceScheduleGuard' },
      update: { value: 'false' },
      create: { key: 'enforceScheduleGuard', value: 'false' },
    });
    invalidateSettingsCache();

    console.log(`\n🎉 ALL ${passed}/${total} SCHEDULE GUARD E2E TESTS PASSED SUCCESSFULLY!`);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runScheduleGuardTests().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
