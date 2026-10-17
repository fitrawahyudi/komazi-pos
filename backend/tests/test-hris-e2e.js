import prisma from '../src/config/db.js';
import { invalidateSettingsCache } from '../src/services/settingsCache.service.js';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testHrisE2E() {
  console.log('======================================================');
  console.log('👥 RUNNING COMPREHENSIVE HRIS END-TO-END AUDIT TEST');
  console.log('======================================================');

  let passed = 0;
  let total = 0;

  function assert(condition, message, errorDetail = null) {
    total++;
    if (condition) {
      console.log(`   ✅ PASS [${total}]: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL [${total}]: ${message}`);
      if (errorDetail) console.error('      Detail:', errorDetail);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  let ownerToken = null;
  let cashierToken = null;
  let cashierId = null;

  try {
    // 1. Authenticate as OWNER
    console.log('1️⃣  Authenticating as OWNER...');
    const ownerRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'password123' }),
    });
    const ownerData = await ownerRes.json();
    assert(ownerRes.status === 200 && ownerData.data?.token, 'Owner login successful', ownerData);
    ownerToken = ownerData.data.token;

    // 2. Authenticate as CASHIER (kasir)
    console.log('2️⃣  Authenticating as CASHIER (kasir)...');
    const cashierRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'password123' }),
    });
    const cashierData = await cashierRes.json();
    assert(cashierRes.status === 200 && cashierData.data?.token, 'Cashier login successful', cashierData);
    cashierToken = cashierData.data.token;
    cashierId = cashierData.data.user.id;

    // 3. Test HRIS Overview
    console.log('3️⃣  Testing GET /hris/overview...');
    const overviewRes = await fetch(`${BASE_URL}/hris/overview`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const overviewData = await overviewRes.json();
    assert(overviewRes.status === 200 && overviewData.data?.totalStaff !== undefined, 'HRIS Overview retrieved', overviewData);

    // 4. Test Staff List
    console.log('4️⃣  Testing GET /hris/staff...');
    const staffRes = await fetch(`${BASE_URL}/hris/staff`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const staffData = await staffRes.json();
    assert(staffRes.status === 200 && Array.isArray(staffData.data), 'Staff list retrieved', staffData);

    // 5. Test Roles List
    console.log('5️⃣  Testing GET /hris/roles...');
    const rolesRes = await fetch(`${BASE_URL}/hris/roles`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const rolesData = await rolesRes.json();
    assert(rolesRes.status === 200 && Array.isArray(rolesData.data), 'Roles list retrieved', rolesData);

    // 6. Test Clock-in (Cashier)
    console.log('6️⃣  Testing POST /hris/attendance/clock-in (Cashier)...');
    const today = new Date().toISOString().split('T')[0];
    // Clean up today's attendance & schedule for kasir
    await prisma.staffAttendance.deleteMany({
      where: { userId: cashierId, date: today },
    });
    await prisma.staffSchedule.deleteMany({
      where: { userId: cashierId, date: today },
    });

    // Ensure enforceScheduleGuard is activated for testing rejection
    await prisma.setting.upsert({
      where: { key: 'enforceScheduleGuard' },
      update: { value: 'true' },
      create: { key: 'enforceScheduleGuard', value: 'true' },
    });
    invalidateSettingsCache();

    // 6a. Verify unscheduled clock-in rejection
    const unschClockInRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ notes: 'Unscheduled clock in' }),
    });
    assert(unschClockInRes.status === 403, 'Unscheduled cashier clock-in rejected with HTTP 403');

    // 6b. Set schedule for cashier
    await prisma.staffSchedule.create({
      data: {
        userId: cashierId,
        date: today,
        shiftName: 'PAGI',
        startTime: '08:00',
        endTime: '16:00',
        status: 'PUBLISHED',
      },
    });

    // 6c. Now clock-in should succeed
    const clockInRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ notes: 'Clock in test' }),
    });
    const clockInData = await clockInRes.json();
    assert(clockInRes.status === 201 && clockInData.data?.clockIn, 'Cashier clock-in successful', clockInData);

    // 7. Test Duplicate Clock-in prevention
    console.log('7️⃣  Testing duplicate clock-in rejection...');
    const dupClockInRes = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ notes: 'Duplicate clock in' }),
    });
    assert(dupClockInRes.status === 400, 'Duplicate clock-in rejected with HTTP 400');

    // 8. Test Clock-out (Cashier)
    console.log('8️⃣  Testing POST /hris/attendance/clock-out (Cashier)...');
    const clockOutRes = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ notes: 'Clock out test' }),
    });
    const clockOutData = await clockOutRes.json();
    assert(clockOutRes.status === 200 && clockOutData.data?.clockOut, 'Cashier clock-out successful', clockOutData);

    // 9. Test GET /hris/attendance
    console.log('9️⃣  Testing GET /hris/attendance...');
    const attRes = await fetch(`${BASE_URL}/hris/attendance?date=${today}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const attData = await attRes.json();
    assert(attRes.status === 200 && Array.isArray(attData.data), 'Attendance list retrieved', attData);

    // 10. Test Attendance Correction Request & Review
    console.log('🔟 Testing Attendance Correction Request (Cashier)...');
    const corrReqRes = await fetch(`${BASE_URL}/hris/attendance/corrections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        date: today,
        requestedClockIn: '2026-10-12T08:00:00.000Z',
        requestedClockOut: '2026-10-12T17:00:00.000Z',
        reason: 'Lupa clock-in pagi karena langsung melayani antrean',
      }),
    });
    const corrReqData = await corrReqRes.json();
    assert(corrReqRes.status === 201 && corrReqData.data?.id, 'Correction request created', corrReqData);
    const corrId = corrReqData.data.id;

    console.log('1️⃣1️⃣ Testing Review Attendance Correction (Owner)...');
    const corrReviewRes = await fetch(`${BASE_URL}/hris/attendance/corrections/${corrId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED', reviewNotes: 'Disetujui Owner' }),
    });
    const corrReviewData = await corrReviewRes.json();
    assert(corrReviewRes.status === 200 && corrReviewData.data?.status === 'APPROVED', 'Correction approved by Owner', corrReviewData);

    // 12. Test Schedule Creation & Listing
    console.log('1️⃣2️⃣ Testing POST & GET /hris/schedules...');
    const testScheduleDate = '2026-11-20';
    await prisma.staffSchedule.deleteMany({ where: { userId: cashierId, date: testScheduleDate } });
    const schCreateRes = await fetch(`${BASE_URL}/hris/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        userId: cashierId,
        date: testScheduleDate,
        shiftName: 'PAGI',
        startTime: '08:00',
        endTime: '16:00',
      }),
    });
    const schCreateData = await schCreateRes.json();
    assert(schCreateRes.status === 201 && schCreateData.data?.id, 'Schedule created', schCreateData);
    const schId = schCreateData.data.id;

    const schListRes = await fetch(`${BASE_URL}/hris/schedules?startDate=${testScheduleDate}&endDate=${testScheduleDate}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const schListData = await schListRes.json();
    assert(schListRes.status === 200 && Array.isArray(schListData.data), 'Schedule list retrieved', schListData);

    // 13. Test Leave Request & Status Update
    console.log('1️⃣3️⃣ Testing Leave Request & Status Update...');
    const leaveCreateRes = await fetch(`${BASE_URL}/hris/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        type: 'ANNUAL',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        days: 2,
        reason: 'Keperluan keluarga',
      }),
    });
    const leaveCreateData = await leaveCreateRes.json();
    assert(leaveCreateRes.status === 201 && leaveCreateData.data?.id, 'Leave request created', leaveCreateData);
    const leaveId = leaveCreateData.data.id;

    const leaveStatusRes = await fetch(`${BASE_URL}/hris/leaves/${leaveId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const leaveStatusData = await leaveStatusRes.json();
    assert(leaveStatusRes.status === 200 && leaveStatusData.data?.status === 'APPROVED', 'Leave request approved', leaveStatusData);

    // 14. Test Overtime Request & Review
    console.log('1️⃣4️⃣ Testing Overtime Request & Review...');
    const otCreateRes = await fetch(`${BASE_URL}/hris/overtimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        date: today,
        durationHours: 2.5,
        reason: 'Bantu closing shift dan cuci bar',
      }),
    });
    const otCreateData = await otCreateRes.json();
    assert(otCreateRes.status === 201 && otCreateData.data?.id, 'Overtime request created', otCreateData);
    const otId = otCreateData.data.id;

    const otReviewRes = await fetch(`${BASE_URL}/hris/overtimes/${otId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED', notes: 'Lembur disetujui' }),
    });
    const otReviewData = await otReviewRes.json();
    assert(otReviewRes.status === 200 && otReviewData.data?.status === 'APPROVED', 'Overtime approved', otReviewData);

    // 15. Test Payroll Period Lifecycle (Create -> Calculate -> Finalize -> Publish)
    console.log('1️⃣5️⃣ Testing Payroll Period Lifecycle...');
    const periodName = `Test Payroll ${Date.now()}`;
    const periodCreateRes = await fetch(`${BASE_URL}/hris/payroll/periods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: periodName,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      }),
    });
    const periodCreateData = await periodCreateRes.json();
    assert(periodCreateRes.status === 201 && periodCreateData.data?.id, 'Payroll period created', periodCreateData);
    const periodId = periodCreateData.data.id;

    // Calculate
    const calcRes = await fetch(`${BASE_URL}/hris/payroll/periods/${periodId}/calculate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const calcData = await calcRes.json();
    assert(calcRes.status === 200 && calcData.data?.status === 'CALCULATED', 'Payroll calculated', calcData);

    // Get Payslips
    const payslipsRes = await fetch(`${BASE_URL}/hris/payroll/periods/${periodId}/payslips`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const payslipsData = await payslipsRes.json();
    assert(payslipsRes.status === 200 && Array.isArray(payslipsData.data), 'Period payslips retrieved', payslipsData);

    // Finalize
    const finalizeRes = await fetch(`${BASE_URL}/hris/payroll/periods/${periodId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const finalizeData = await finalizeRes.json();
    assert(finalizeRes.status === 200 && finalizeData.data?.status === 'FINALIZED', 'Payroll finalized', finalizeData);

    // Publish
    const publishRes = await fetch(`${BASE_URL}/hris/payroll/periods/${periodId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const publishData = await publishRes.json();
    assert(publishRes.status === 200 && publishData.data?.status === 'PUBLISHED', 'Payroll published', publishData);

    // My Payslips (Cashier)
    const myPayslipsRes = await fetch(`${BASE_URL}/hris/payroll/my-payslips`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const myPayslipsData = await myPayslipsRes.json();
    assert(myPayslipsRes.status === 200 && Array.isArray(myPayslipsData.data), 'Cashier can view their payslips', myPayslipsData);

    // 16. Test Audit Logs
    console.log('1️⃣6️⃣ Testing GET /hris/audit-logs...');
    const auditRes = await fetch(`${BASE_URL}/hris/audit-logs`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && Array.isArray(auditData.data?.logs || auditData.data), 'Audit logs retrieved', auditData);

    // Clean up created schedule, leave, and test payroll period
    await prisma.staffSchedule.deleteMany({ where: { id: schId } });
    await prisma.staffLeave.deleteMany({ where: { id: leaveId } });
    await prisma.staffOvertime.deleteMany({ where: { id: otId } });
    await prisma.staffAttendanceCorrection.deleteMany({ where: { id: corrId } });
    await prisma.staffPayslip.deleteMany({ where: { periodId } });
    await prisma.payrollPeriod.deleteMany({ where: { id: periodId } });
    await prisma.setting.upsert({
      where: { key: 'enforceScheduleGuard' },
      update: { value: 'false' },
      create: { key: 'enforceScheduleGuard', value: 'false' },
    });
    invalidateSettingsCache();

    console.log('======================================================');
    console.log(`🎉 ALL ${passed}/${total} HRIS API AUDIT TESTS PASSED 100%!`);
    console.log('======================================================');
  } catch (err) {
    console.error('❌ HRIS Audit Test Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testHrisE2E();
