import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { shiftService } from '../src/services/shift.service.js';
import { createCashMovementSchema } from '../src/validators/schemas.js';

test('Cash Drawer Movement Suite (Kas Masuk, Kas Keluar, Setor Brankas)', async (t) => {
  // Setup users
  let owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  let cashierA = await prisma.user.findFirst({ where: { role: 'CASHIER' } });
  
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'Test Owner',
        username: 'test_owner_mov',
        passwordHash: 'dummyhash',
        role: 'OWNER',
        pin: '123456',
      },
    });
  }

  if (!cashierA) {
    cashierA = await prisma.user.create({
      data: {
        name: 'Test Cashier A',
        username: 'test_cashier_a_mov',
        passwordHash: 'dummyhash',
        role: 'CASHIER',
        pin: '111111',
      },
    });
  }

  let testRegister = await prisma.register.findFirst();
  if (!testRegister) {
    testRegister = await prisma.register.create({
      data: { name: 'Kasir Uji', code: 'REG-TEST', isActive: true },
    });
  }

  await t.test('1. Schema Normalization: IN, OUT, and DROP successfully parse and normalize', async () => {
    const parsedIn = createCashMovementSchema.parse({
      type: 'IN',
      amount: 50000,
      reason: 'Tambahan modal kembalian',
    });
    assert.equal(parsedIn.type, 'CASH_IN');
    assert.equal(parsedIn.amount, 50000);

    const parsedOut = createCashMovementSchema.parse({
      type: 'OUT',
      amount: '25000',
      reason: 'Beli es batu darurat',
    });
    assert.equal(parsedOut.type, 'CASH_OUT');
    assert.equal(parsedOut.amount, 25000);

    const parsedDrop = createCashMovementSchema.parse({
      type: 'DROP',
      amount: 100000,
      reason: 'Setor brankas siang',
    });
    assert.equal(parsedDrop.type, 'CASH_DROP');

    // Reject unknown type
    assert.throws(() => {
      createCashMovementSchema.parse({
        type: 'TRANSFER_UNKNOWN',
        amount: 50000,
        reason: 'Uji gagal',
      });
    }, /Tipe kas harus CASH_IN, CASH_OUT, atau CASH_DROP/);

    // Reject non-positive amount
    assert.throws(() => {
      createCashMovementSchema.parse({
        type: 'CASH_IN',
        amount: 0,
        reason: 'Uji nol',
      });
    }, /Nominal kas harus lebih dari Rp 0/);
  });

  let shiftA = null;
  let shiftB = null;
  let cashierB = null;

  await t.test('2. Cashier Isolation & Multi-Shift Movement Ownership', async () => {
    cashierB = await prisma.user.findFirst({
      where: { role: 'CASHIER', id: { not: cashierA.id } },
    });
    if (!cashierB) {
      cashierB = await prisma.user.create({
        data: {
          name: 'Test Cashier B',
          username: 'test_cashier_b_mov',
          passwordHash: 'dummyhash',
          role: 'CASHIER',
          pin: '222222',
        },
      });
    }

    // Close any dangling shifts for cleaner tests
    await prisma.shift.updateMany({
      where: { closedAt: null },
      data: { closedAt: new Date() },
    });

    // Buka shift untuk Cashier A (Modal: 100.000)
    shiftA = await prisma.shift.create({
      data: {
        registerId: testRegister.id,
        cashierId: cashierA.id,
        openingCash: 100000,
        openedAt: new Date(),
      },
    });

    // Buka shift untuk Cashier B (Modal: 50.000)
    shiftB = await prisma.shift.create({
      data: {
        registerId: testRegister.id,
        cashierId: cashierB.id,
        openingCash: 50000,
        openedAt: new Date(),
      },
    });

    // Cashier A records movement without specifying shiftId -> must auto-target shiftA
    const movA = await shiftService.addMovement(cashierA.id, {
      type: 'CASH_IN',
      amount: 20000,
      reason: 'Kas masuk kasir A auto-resolve',
      userRole: 'CASHIER',
    });
    assert.equal(movA.shiftId, shiftA.id, 'Must auto-target caller cashier active shift');

    // Cashier A attempts to record movement into shiftB -> must be rejected with 403
    await assert.rejects(
      async () => {
        await shiftService.addMovement(cashierA.id, {
          type: 'CASH_OUT',
          amount: 15000,
          reason: 'Mencoba ambil kas shift B',
          shiftId: shiftB.id,
          userRole: 'CASHIER',
        });
      },
      (err) => {
        assert.match(err.message, /Akses ditolak: Anda hanya dapat mencatat arus kas pada sesi kasir Anda sendiri/);
        assert.equal(err.statusCode, 403);
        return true;
      },
      'Cashier cannot record movement into another cashier shift'
    );

    // Manager/Owner is permitted to record movement into any shift
    const movOwner = await shiftService.addMovement(owner.id, {
      type: 'CASH_IN',
      amount: 50000,
      reason: 'Injeksi modal darurat oleh Owner',
      shiftId: shiftB.id,
      userRole: 'OWNER',
    });
    assert.equal(movOwner.shiftId, shiftB.id, 'Owner can record into any active shift');
  });

  await t.test('3. Overdraft Guard: CASH_DROP cannot exceed drawer balance', async () => {
    // Current shiftA balance: 100.000 (opening) + 20.000 (movA) = 120.000
    // Attempting to drop 200.000 into safe must fail
    await assert.rejects(
      async () => {
        await shiftService.addMovement(cashierA.id, {
          type: 'CASH_DROP',
          amount: 200000,
          reason: 'Setor brankas fiktif melebihi saldo laci',
          shiftId: shiftA.id,
          userRole: 'CASHIER',
        });
      },
      /Setor brankas .* tidak boleh melebihi saldo kas fisik yang ada di laci/,
      'Must reject cash drop exceeding drawer balance'
    );

    // Valid drop within balance (50.000 <= 120.000)
    const validDrop = await shiftService.addMovement(cashierA.id, {
      type: 'CASH_DROP',
      amount: 50000,
      reason: 'Setor brankas valid',
      shiftId: shiftA.id,
      userRole: 'CASHIER',
    });
    assert.equal(Number(validDrop.amount), 50000);

    // Recheck metrics: opening(100k) + in(20k) - drop(50k) = 70.000 expected
    const refreshedShiftA = await prisma.shift.findUnique({
      where: { id: shiftA.id },
      include: { cashMovements: true, orders: { include: { payments: true } } },
    });
    const metricsA = shiftService.calculateShiftMetrics(refreshedShiftA);
    assert.equal(metricsA.expectedCash, 70000);
    assert.equal(metricsA.cashIn, 20000);
    assert.equal(metricsA.cashDrop, 50000);
  });

  // Cleanup test shifts
  await prisma.cashMovement.deleteMany({
    where: { shiftId: { in: [shiftA.id, shiftB.id] } },
  });
  await prisma.auditLog.deleteMany({
    where: { action: 'CASH_MOVEMENT', userId: { in: [cashierA.id, cashierB?.id, owner.id].filter(Boolean) } },
  });
  await prisma.shift.deleteMany({
    where: { id: { in: [shiftA.id, shiftB.id] } },
  });
});
