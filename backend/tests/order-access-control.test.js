import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { invalidateSettingsCache } from '../src/services/settingsCache.service.js';

function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );
}

test('Security & Access Control: Riwayat Pesanan & Order Safeguards', async (t) => {
  await prisma.$connect();
  const PORT = 4018;
  const server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  let ownerToken = '';
  let cashierAToken = '';
  let cashierBToken = '';
  let cashierAUser = null;
  let cashierBUser = null;
  let testProduct = null;
  let testOpenOrderId = null;
  let testPaidOrderId = null;

  try {
    // Nonaktifkan sementara enforceAttendanceGuard agar kasir uji bebas bertransaksi
    await prisma.setting.upsert({
      where: { key: 'enforceAttendanceGuard' },
      update: { value: 'false' },
      create: { key: 'enforceAttendanceGuard', value: 'false' },
    });
    invalidateSettingsCache();

    const passwordHash = await bcrypt.hash('password123', 10);

    const owner = await prisma.user.upsert({
      where: { username: 'test_sec_owner' },
      update: { isActive: true },
      create: {
        name: 'Owner Security Test',
        username: 'test_sec_owner',
        password: passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });
    ownerToken = createToken(owner);

    cashierAUser = await prisma.user.upsert({
      where: { username: 'test_sec_cashier_a' },
      update: { isActive: true },
      create: {
        name: 'Kasir Alpha',
        username: 'test_sec_cashier_a',
        password: passwordHash,
        role: 'CASHIER',
        isActive: true,
      },
    });
    cashierAToken = createToken(cashierAUser);

    cashierBUser = await prisma.user.upsert({
      where: { username: 'test_sec_cashier_b' },
      update: { isActive: true },
      create: {
        name: 'Kasir Beta',
        username: 'test_sec_cashier_b',
        password: passwordHash,
        role: 'CASHIER',
        isActive: true,
      },
    });
    cashierBToken = createToken(cashierBUser);

    // Pastikan ada produk untuk item pesanan
    testProduct = await prisma.product.findFirst({ where: { isActive: true } });
    assert.ok(testProduct, 'Test product must exist');

    // Buat pesanan OPEN milik Kasir A
    const orderA = await prisma.order.create({
      data: {
        invoiceNo: `KMZ-TEST-A-${Date.now()}`,
        status: 'OPEN',
        type: 'DINE_IN',
        tableNo: '01',
        customerName: 'Pelanggan Meja 1',
        cashierId: cashierAUser.id,
        subtotal: 30000,
        total: 30000,
        items: {
          create: [
            {
              productId: testProduct.id,
              productName: testProduct.name,
              qty: 1,
              unitPrice: 30000,
              lineTotal: 30000,
            },
          ],
        },
      },
    });
    testOpenOrderId = orderA.id;

    // Buat pesanan PAID
    const orderPaid = await prisma.order.create({
      data: {
        invoiceNo: `KMZ-TEST-PAID-${Date.now()}`,
        status: 'PAID',
        type: 'TAKE_AWAY',
        customerName: 'Pelanggan Lunas',
        cashierId: cashierAUser.id,
        subtotal: 50000,
        total: 50000,
        paidAt: new Date(),
        items: {
          create: [
            {
              productId: testProduct.id,
              productName: testProduct.name,
              qty: 2,
              unitPrice: 25000,
              lineTotal: 50000,
            },
          ],
        },
        payments: {
          create: [
            {
              method: 'CASH',
              amount: 50000,
            },
          ],
        },
      },
    });
    testPaidOrderId = orderPaid.id;

    await t.test('1. Visibility: Kasir B dapat melihat pesanan Kasir A dan semua riwayat', async () => {
      const res = await fetch(`${BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${cashierBToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));

      const foundA = json.data.find((o) => o.id === testOpenOrderId);
      assert.ok(foundA, 'Kasir B harus dapat melihat pesanan yang dibuat oleh Kasir A');
      assert.strictEqual(foundA.cashierName, cashierAUser.name);
    });

    await t.test('2. Ownership: Kasir B DITOLAK mengedit pesanan OPEN milik Kasir A', async () => {
      const res = await fetch(`${BASE_URL}/orders/${testOpenOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierBToken}`,
        },
        body: JSON.stringify({
          type: 'DINE_IN',
          items: [{ productId: testProduct.id, qty: 2, unitPrice: 30000 }],
        }),
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /milik kasir lain/i);
    });

    await t.test('3. Immutability: DITOLAK mengedit pesanan yang sudah berstatus PAID', async () => {
      const res = await fetch(`${BASE_URL}/orders/${testPaidOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          type: 'TAKE_AWAY',
          items: [{ productId: testProduct.id, qty: 1, unitPrice: 25000 }],
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /belum dibayar/i);
    });

    await t.test('4. Anti-Deletion: DELETE /orders/:id DITOLAK dengan status 403', async () => {
      const res = await fetch(`${BASE_URL}/orders/${testPaidOrderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /tidak dapat dihapus/i);
    });

    await t.test('5. Refund Guard: Ditolak jika nominal refund > total tagihan atau <= 0', async () => {
      // Nominal lebih besar dari total
      const resOver = await fetch(`${BASE_URL}/orders/${testPaidOrderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          reason: 'Pelanggan minta ganti',
          refundAmount: 999999,
        }),
      });
      assert.strictEqual(resOver.status, 400);
      const jsonOver = await resOver.json();
      assert.strictEqual(jsonOver.success, false);
      assert.match(jsonOver.message, /melebihi/i);
    });

    await t.test('6. Refund Approval & Duplicate Guard: Pengajuan refund berhasil dan duplikasi ditolak', async () => {
      // Pengajuan pertama oleh Kasir A
      const res1 = await fetch(`${BASE_URL}/orders/${testPaidOrderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          reason: 'Komplain menu tumpah',
          refundAmount: 50000,
        }),
      });
      assert.strictEqual(res1.status, 200);
      const json1 = await res1.json();
      assert.strictEqual(json1.success, true);
      assert.strictEqual(json1.data.pendingApproval, true);

      // Pengajuan kedua saat status masih PENDING harus ditolak
      const res2 = await fetch(`${BASE_URL}/orders/${testPaidOrderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          reason: 'Komplain kedua',
          refundAmount: 50000,
        }),
      });
      assert.strictEqual(res2.status, 400);
      const json2 = await res2.json();
      assert.strictEqual(json2.success, false);
      assert.match(json2.message, /sudah diajukan/i);
    });
  } finally {
    // Bersihkan data uji
    if (testOpenOrderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: testOpenOrderId } });
      await prisma.order.deleteMany({ where: { id: testOpenOrderId } });
    }
    if (testPaidOrderId) {
      await prisma.approvalRequest.deleteMany({ where: { orderId: testPaidOrderId } });
      await prisma.payment.deleteMany({ where: { orderId: testPaidOrderId } });
      await prisma.orderItem.deleteMany({ where: { orderId: testPaidOrderId } });
      await prisma.order.deleteMany({ where: { id: testPaidOrderId } });
    }
    // Kembalikan konfigurasi setting
    await prisma.setting.upsert({
      where: { key: 'enforceAttendanceGuard' },
      update: { value: 'true' },
      create: { key: 'enforceAttendanceGuard', value: 'true' },
    });
    invalidateSettingsCache();
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    setTimeout(() => process.exit(0), 50);
  }
});
