import dotenv from 'dotenv';
dotenv.config();

import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { invalidateSettingsCache } from '../src/services/settingsCache.service.js';

test('Integration: Presensi Pulang dan Tutup Sesi Kasir Independen', async (t) => {
  await prisma.$connect();
  const PORT = 4015;
  const server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  try {
    // Disable anti-fraud strict enforcement for automated test flow
    await prisma.setting.upsert({
      where: { key: 'attendanceGeofenceEnabled' },
      update: { value: 'false' },
      create: { key: 'attendanceGeofenceEnabled', value: 'false' },
    });
    await prisma.setting.upsert({
      where: { key: 'attendanceSelfieRequired' },
      update: { value: 'false' },
      create: { key: 'attendanceSelfieRequired', value: 'false' },
    });
    invalidateSettingsCache();

    const today = new Date().toISOString().split('T')[0];
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Setup Test Users: Owner, Kasir A, Kasir B
    const ownerUser = await prisma.user.upsert({
      where: { username: 'test_owner_indep' },
      update: { isActive: true },
      create: {
        name: 'Owner Test Indep',
        username: 'test_owner_indep',
        password: passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    const cashierA = await prisma.user.upsert({
      where: { username: 'test_kasir_a' },
      update: { isActive: true },
      create: {
        name: 'Kasir A Indep',
        username: 'test_kasir_a',
        password: passwordHash,
        role: 'CASHIER',
        isActive: true,
      },
    });

    const cashierB = await prisma.user.upsert({
      where: { username: 'test_kasir_b' },
      update: { isActive: true },
      create: {
        name: 'Kasir B Indep',
        username: 'test_kasir_b',
        password: passwordHash,
        role: 'CASHIER',
        isActive: true,
      },
    });

    // Ensure registers exist: Register 1 and Register 2
    const reg1 = await prisma.register.upsert({
      where: { code: 'REG-TEST-01' },
      update: { isActive: true },
      create: { name: 'Kasir 1 Test', code: 'REG-TEST-01', isActive: true },
    });

    const reg2 = await prisma.register.upsert({
      where: { code: 'REG-TEST-02' },
      update: { isActive: true },
      create: { name: 'Kasir 2 Test', code: 'REG-TEST-02', isActive: true },
    });

    // Ensure test product exists
    let testCategory = await prisma.category.findFirst();
    if (!testCategory) {
      testCategory = await prisma.category.create({ data: { name: 'Test Category' } });
    }

    const testProduct = await prisma.product.upsert({
      where: { sku: 'TEST-SKU-INDEP' },
      update: { isActive: true, isSoldOut: false },
      create: {
        sku: 'TEST-SKU-INDEP',
        name: 'Produk Uji Kasir',
        price: 25000,
        categoryId: testCategory.id,
        isActive: true,
      },
    });

    // Clean up test data for today
    await prisma.shift.updateMany({
      where: { registerId: { in: [reg1.id, reg2.id] }, closedAt: null },
      data: { closedAt: new Date() },
    });
    await prisma.staffAttendance.deleteMany({
      where: { userId: { in: [cashierA.id, cashierB.id] }, date: today },
    });
    await prisma.staffSchedule.deleteMany({
      where: { userId: { in: [cashierA.id, cashierB.id] }, date: today },
    });

    // Ensure schedules for today exist
    await prisma.staffSchedule.createMany({
      data: [
        {
          userId: cashierA.id,
          date: today,
          shiftName: 'PAGI',
          startTime: '07:00',
          endTime: '15:00',
          status: 'PUBLISHED',
        },
        {
          userId: cashierB.id,
          date: today,
          shiftName: 'PAGI',
          startTime: '07:00',
          endTime: '15:00',
          status: 'PUBLISHED',
        },
      ],
    });

    // 2. Helper login function
    async function login(username, password = 'password123') {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(`Login failed for ${username}: ${data.message}`);
      return {
        token: data.data.token,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.data.token}`,
        },
        user: data.data.user,
      };
    }

    const ownerAuth = await login('test_owner_indep');
    const kasirAAuth = await login('test_kasir_a');
    const kasirBAuth = await login('test_kasir_b');

    // Subtest 1: Clock-In both cashiers
    await t.test('1. Clock-In kedua kasir berhasil', async () => {
      const clockInA = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({}),
      });
      const dataA = await clockInA.json();
      assert.equal(clockInA.status, 201);
      assert.ok(dataA.data.clockIn);

      const clockInB = await fetch(`${BASE_URL}/hris/attendance/clock-in`, {
        method: 'POST',
        headers: kasirBAuth.headers,
        body: JSON.stringify({}),
      });
      const dataB = await clockInB.json();
      assert.equal(clockInB.status, 201);
      assert.ok(dataB.data.clockIn);
    });

    // Subtest 2: Kasir A membuka sesi kasir pada Register 1
    let shiftAId = null;
    await t.test('2. Kasir A membuka sesi kasir pada Register 1', async () => {
      const openRes = await fetch(`${BASE_URL}/shifts/open`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({ openingCash: 150000, registerId: reg1.id }),
      });
      const openData = await openRes.json();
      if (openRes.status !== 201) {
        throw new Error(`openShift failed: ${openRes.status} -> ${JSON.stringify(openData)}`);
      }
      assert.equal(openRes.status, 201);
      assert.ok(openData.data.id);
      shiftAId = openData.data.id;
    });

    // Subtest 3: Status presensi Kasir B menunjukkan tidak ada sesi aktif miliknya
    await t.test('3. Status presensi Kasir B dapat pulang meskipun Kasir A memiliki sesi aktif', async () => {
      const schedRes = await fetch(`${BASE_URL}/hris/my-schedule-today`, {
        headers: kasirBAuth.headers,
      });
      const schedData = await schedRes.json();
      assert.equal(schedRes.status, 200);
      assert.equal(schedData.data.hasActiveShift, false);
      assert.equal(schedData.data.activeShift, null);
      assert.match(schedData.data.shiftActionMessage, /Sesi kasir milik karyawan lain tidak terpengaruh/);
    });

    // Subtest 4: Kasir B presensi pulang (clock-out) BERHASIL meskipun sesi Kasir A masih AKTIF
    await t.test('4. Kasir B clock-out berhasil tanpa terpengaruh sesi aktif Kasir A', async () => {
      const clockOutRes = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
        method: 'POST',
        headers: kasirBAuth.headers,
        body: JSON.stringify({ notes: 'Pulang giliran kerja Kasir B' }),
      });
      const clockOutData = await clockOutRes.json();
      assert.equal(clockOutRes.status, 200);
      assert.ok(clockOutData.data.clockOut);
      assert.equal(clockOutData.message, 'Clock-Out berhasil dicatat');

      // Verifikasi sesi Kasir A tetap aktif dan tidak tertutup otomatis
      const shiftACheck = await prisma.shift.findUnique({ where: { id: shiftAId } });
      assert.equal(shiftACheck.closedAt, null, 'Sesi Kasir A HARUS tetap aktif (closedAt: null)!');
    });

    // Subtest 5: Kasir A tetap dapat bertransaksi setelah Kasir B pulang
    await t.test('5. Kasir A tetap dapat membuat pesanan & transaksi setelah Kasir B pulang', async () => {
      const orderRes = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({
          type: 'DINE_IN',
          shiftId: shiftAId,
          items: [{ productId: testProduct.id, qty: 2, unitPrice: 25000 }],
          payments: [{ method: 'CASH', amount: 50000 }],
        }),
      });
      const orderData = await orderRes.json();
      assert.equal(orderRes.status, 201);
      assert.equal(orderData.data.shiftId, shiftAId);
    });

    // Subtest 6: Kasir A mencoba presensi pulang saat sesi miliknya masih aktif -> DITOLAK
    await t.test('6. Kasir A DITOLAK presensi pulang karena masih memiliki sesi aktif miliknya sendiri', async () => {
      const clockOutARes = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({}),
      });
      const clockOutAData = await clockOutARes.json();
      assert.equal(clockOutARes.status, 400);
      assert.match(clockOutAData.message, /Anda masih memiliki sesi kasir aktif/);
      const shiftInfo = clockOutAData.errors || clockOutAData.data;
      assert.equal(shiftInfo?.code, 'ACTIVE_CASHIER_SESSION_EXISTS');
      assert.equal(shiftInfo?.shiftId, shiftAId);
    });

    // Subtest 7: Kasir B tidak boleh menutup sesi milik Kasir A (RBAC protection)
    await t.test('7. Kasir B DITOLAK menutup sesi kasir milik Kasir A tanpa hak akses', async () => {
      const closeByOtherRes = await fetch(`${BASE_URL}/shifts/close`, {
        method: 'POST',
        headers: kasirBAuth.headers,
        body: JSON.stringify({
          closingCash: 200000,
          shiftId: shiftAId,
          notes: 'Mencoba menutup sesi orang lain',
        }),
      });
      const closeByOtherData = await closeByOtherRes.json();
      assert.equal(closeByOtherRes.status, 403);
      assert.match(closeByOtherData.message, /tidak memiliki izin untuk menutup sesi kasir milik karyawan lain/);
    });

    // Subtest 8: Kasir A menutup sesi kasir miliknya dengan rekonsiliasi kas
    await t.test('8. Kasir A menutup sesi kasir miliknya dengan selisih kas fisik', async () => {
      const closeRes = await fetch(`${BASE_URL}/shifts/close`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({
          closingCash: 200000,
          shiftId: shiftAId,
          notes: 'Tutup sesi Kasir A normal',
        }),
      });
      const closeData = await closeRes.json();
      assert.equal(closeRes.status, 200);
      assert.equal(closeData.data.isClosed, true);
      assert.equal(closeData.data.closingCash, 200000);
      assert.ok(closeData.data.closedAt);

      // Verifikasi database: shift sudah tertutup
      const shiftClosedCheck = await prisma.shift.findUnique({ where: { id: shiftAId } });
      assert.notEqual(shiftClosedCheck.closedAt, null);
    });

    // Subtest 9: Kasir A sekarang dapat presensi pulang setelah sesi ditutup
    await t.test('9. Kasir A sekarang DAPAT presensi pulang setelah sesinya ditutup', async () => {
      const clockOutARes2 = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({ notes: 'Pulang setelah sesi ditutup' }),
      });
      const clockOutAData2 = await clockOutARes2.json();
      assert.equal(clockOutARes2.status, 200);
      assert.ok(clockOutAData2.data.clockOut);
    });

    // Subtest 10: Presensi pulang ganda ditolak (Idempotency)
    await t.test('10. Presensi pulang ganda ditolak dan tidak membuat catatan tambahan', async () => {
      const dupClockOutRes = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({ notes: 'Percobaan kedua' }),
      });
      const dupClockOutData = await dupClockOutRes.json();
      assert.equal(dupClockOutRes.status, 400);
      assert.match(dupClockOutData.message, /sudah melakukan Clock-Out hari ini/);
    });

    // Subtest 11: Tutup sesi ganda ditolak
    await t.test('11. Permintaan tutup sesi yang sudah tertutup ditolak dengan pesan yang jelas', async () => {
      const dupCloseRes = await fetch(`${BASE_URL}/shifts/close`, {
        method: 'POST',
        headers: kasirAAuth.headers,
        body: JSON.stringify({
          closingCash: 200000,
          shiftId: shiftAId,
        }),
      });
      const dupCloseData = await dupCloseRes.json();
      assert.equal(dupCloseRes.status, 400);
      assert.match(dupCloseData.message, /Tidak ada shift aktif yang ditemukan untuk ditutup|sudah ditutup/);
    });

    // Subtest 12: Pengguna tanpa autentikasi ditolak
    await t.test('12. Pengguna tanpa autentikasi ditolak', async () => {
      const unauthRes = await fetch(`${BASE_URL}/hris/attendance/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(unauthRes.status, 401);
    });

    // Subtest 13: Endpoint alias /api/v1/attendance/status berfungsi
    await t.test('13. Endpoint alias /api/v1/attendance/status berfungsi konsisten', async () => {
      const statusRes = await fetch(`${BASE_URL}/attendance/status`, {
        headers: kasirAAuth.headers,
      });
      const statusData = await statusRes.json();
      assert.equal(statusRes.status, 200);
      assert.equal(statusData.data.isClockedOut, true);
    });
  } finally {
    if (typeof server?.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close();
    await prisma.$disconnect();
    setTimeout(() => {
      process.exit(0);
    }, 1000).unref();
  }
});
