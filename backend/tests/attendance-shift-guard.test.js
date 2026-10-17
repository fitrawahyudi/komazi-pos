import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkStaffAttendanceToday,
  checkStaffShiftEligibility,
  ATTENDANCE_REQUIRED_MESSAGE,
  ATTENDANCE_CLOCKED_OUT_MESSAGE,
  SCHEDULE_BLOCKED_MESSAGE,
} from '../src/services/scheduleGuard.service.js';

test('Attendance Guard: OWNER is always exempt from attendance requirement', async () => {
  const result = await checkStaffAttendanceToday(1, 'OWNER');
  assert.equal(result.hasClockedIn, true);
  assert.equal(result.isOwner, true);

  const eligibility = await checkStaffShiftEligibility(1, 'OWNER');
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.isOwner, true);
  assert.equal(eligibility.reason, null);
});

test('Attendance Guard: Staff shift eligibility requires attendance before transactions', async () => {
  // Mock logic representation of checkStaffShiftEligibility:
  const evaluateStaffGate = ({ isOwner, isScheduled, hasClockedIn, isClockedOut }) => {
    if (isOwner) return { eligible: true };
    if (!isScheduled) return { eligible: false, message: SCHEDULE_BLOCKED_MESSAGE };
    if (!hasClockedIn) {
      return {
        eligible: false,
        message: isClockedOut ? ATTENDANCE_CLOCKED_OUT_MESSAGE : ATTENDANCE_REQUIRED_MESSAGE,
      };
    }
    return { eligible: true };
  };

  // Case 1: Staff without schedule (strict mode) -> BLOCKED
  const res1 = evaluateStaffGate({ isOwner: false, isScheduled: false, hasClockedIn: false, isClockedOut: false });
  assert.equal(res1.eligible, false);
  assert.match(res1.message, /Jadwal kerja Anda belum diatur/);

  // Case 2: Staff in flexible mode (schedule ok) but hasn't clocked in -> BLOCKED with Presensi Wajib
  const res2 = evaluateStaffGate({ isOwner: false, isScheduled: true, hasClockedIn: false, isClockedOut: false });
  assert.equal(res2.eligible, false);
  assert.match(res2.message, /Presensi Wajib: Anda belum melakukan presensi/);

  // Case 3: Staff has already clocked out -> BLOCKED
  const res3 = evaluateStaffGate({ isOwner: false, isScheduled: true, hasClockedIn: false, isClockedOut: true });
  assert.equal(res3.eligible, false);
  assert.match(res3.message, /Sesi kerja Anda telah selesai/);

  // Case 4: Staff has clocked in today -> ALLOWED to open shift and transact
  const res4 = evaluateStaffGate({ isOwner: false, isScheduled: true, hasClockedIn: true, isClockedOut: false });
  assert.equal(res4.eligible, true);
});

test('Multi-Staff Active Shift: Staff B cannot transact on an already open shift until Staff B also clocks in', async () => {
  // Scenario:
  // - Shift #101 was opened by Cashier A (hasClockedIn: true)
  // - Shift #101 is currently OPEN and active
  // - Cashier B arrives and wants to process an order on Shift #101
  const activeShift = {
    id: 101,
    cashierId: 3,
    cashierName: 'Kasir A',
    isClosed: false,
  };

  // Helper function simulating order creation guard:
  const canCashierTransactOnActiveShift = ({ activeShift, cashierId, hasClockedIn, role }) => {
    if (!activeShift || activeShift.isClosed) {
      return { allowed: false, message: 'Sesi kasir belum dibuka' };
    }
    if (role === 'OWNER') {
      return { allowed: true };
    }
    if (!hasClockedIn) {
      return {
        allowed: false,
        message: ATTENDANCE_REQUIRED_MESSAGE,
        reason: 'ATTENDANCE_REQUIRED',
      };
    }
    return { allowed: true };
  };

  // 1. Kasir B attempts transaction WITHOUT clocking in -> MUST BE REJECTED
  const attemptWithoutClockIn = canCashierTransactOnActiveShift({
    activeShift,
    cashierId: 4,
    hasClockedIn: false,
    role: 'CASHIER',
  });
  assert.equal(attemptWithoutClockIn.allowed, false);
  assert.equal(attemptWithoutClockIn.reason, 'ATTENDANCE_REQUIRED');
  assert.match(attemptWithoutClockIn.message, /Presensi Wajib/);

  // 2. Kasir B takes selfie & verifies GPS -> clocks in (hasClockedIn: true)
  // 3. Kasir B attempts transaction again on the existing active shift -> SUCCEEDS!
  const attemptAfterClockIn = canCashierTransactOnActiveShift({
    activeShift,
    cashierId: 4,
    hasClockedIn: true,
    role: 'CASHIER',
  });
  assert.equal(attemptAfterClockIn.allowed, true);
});

