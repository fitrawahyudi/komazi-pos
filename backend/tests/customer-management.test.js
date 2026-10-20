import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );
}

test('Customer Management & Deletion Suite (Production Mode Safe)', async (t) => {
  await prisma.$connect();
  const PORT = 4019;
  const server = app.listen(PORT);
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  let cashierToken = '';
  let managerToken = '';
  let ownerToken = '';
  let cashierUser = null;

  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    // Setup Cashier user
    cashierUser = await prisma.user.upsert({
      where: { username: 'test_cust_kasir' },
      update: { isActive: true, role: 'CASHIER' },
      create: {
        name: 'Kasir Customer Test',
        username: 'test_cust_kasir',
        password: passwordHash,
        role: 'CASHIER',
        isActive: true,
      },
    });
    cashierToken = createToken(cashierUser);

    // Setup Manager user
    const managerUser = await prisma.user.upsert({
      where: { username: 'test_cust_manager' },
      update: { isActive: true, role: 'MANAGER' },
      create: {
        name: 'Manager Customer Test',
        username: 'test_cust_manager',
        password: passwordHash,
        role: 'MANAGER',
        isActive: true,
      },
    });
    managerToken = createToken(managerUser);

    // Setup Owner user
    const ownerUser = await prisma.user.upsert({
      where: { username: 'test_cust_owner' },
      update: { isActive: true, role: 'OWNER' },
      create: {
        name: 'Owner Customer Test',
        username: 'test_cust_owner',
        password: passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });
    ownerToken = createToken(ownerUser);

    const cashierHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    };
    const managerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    };

    // 1. Create a fresh test customer (no orders)
    await t.test('1. CASHIER can delete customer without transactions (Hard Delete)', async () => {
      const phone = '0899990001';
      // Cleanup if existed
      await prisma.customer.deleteMany({ where: { phone } });

      const createRes = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          name: 'Pelanggan Baru Tanpa Transaksi',
          phone,
        }),
      });
      const createData = await createRes.json();
      assert.equal(createRes.status, 201);
      const custId = createData.data.id;

      // Delete by CASHIER
      const delRes = await fetch(`${BASE_URL}/customers/${custId}`, {
        method: 'DELETE',
        headers: cashierHeaders,
      });
      const delData = await delRes.json();
      assert.equal(delRes.status, 200, 'Cashier should be allowed to delete customer');
      assert.equal(delData.success, true);
      assert.equal(delData.data?.isDeleted, true);

      // Verify no longer in GET /customers
      const getRes = await fetch(`${BASE_URL}/customers`, { headers: cashierHeaders });
      const getData = await getRes.json();
      const found = getData.data.customers.find((c) => c.id === custId);
      assert.equal(found, undefined, 'Hard-deleted customer must not be returned');
    });

    // 2. Soft-delete customer with orders (as in production)
    await t.test('2. Customer with transaction history is soft-deleted and hidden from GET /customers', async () => {
      const phone = '0899990002';
      // Cleanup previous run
      const prevCust = await prisma.customer.findUnique({ where: { phone } });
      if (prevCust) {
        await prisma.order.deleteMany({ where: { customerId: prevCust.id } });
        await prisma.customer.delete({ where: { id: prevCust.id } });
      }

      // Create customer
      const cust = await prisma.customer.create({
        data: {
          name: 'Pelanggan Riwayat Transaksi',
          phone,
          isActive: true,
        },
      });

      // Create an order linked to this customer
      const order = await prisma.order.create({
        data: {
          invoiceNo: `INV-TEST-CUST-${Date.now()}`,
          cashierId: cashierUser.id,
          customerId: cust.id,
          customerName: cust.name,
          type: 'DINE_IN',
          status: 'PAID',
          subtotal: 50000,
          total: 50000,
        },
      });

      // Delete by Cashier
      const delRes = await fetch(`${BASE_URL}/customers/${cust.id}`, {
        method: 'DELETE',
        headers: cashierHeaders,
      });
      const delData = await delRes.json();
      assert.equal(delRes.status, 200);
      assert.equal(delData.success, true);
      assert.equal(delData.data?.isDeactivated, true, 'Should be deactivated due to orders');

      // Check database state
      const checkDb = await prisma.customer.findUnique({ where: { id: cust.id } });
      assert.equal(checkDb.isActive, false, 'Database isActive must be false');

      // Verify GET /customers excludes the soft-deleted customer
      const getRes = await fetch(`${BASE_URL}/customers`, { headers: cashierHeaders });
      const getData = await getRes.json();
      const found = getData.data.customers.find((c) => c.id === cust.id);
      assert.equal(found, undefined, 'Soft-deleted customer MUST NOT be returned in active list');

      // 3. Re-registering the same phone should reactivate the customer
      const reCreateRes = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          name: 'Pelanggan Reaktif',
          phone,
        }),
      });
      const reCreateData = await reCreateRes.json();
      assert.equal(reCreateRes.status, 201, 'Re-registration should succeed and reactivate');
      assert.equal(reCreateData.data.id, cust.id);
      assert.equal(reCreateData.data.isActive, true);

      // Verify now present again in GET /customers
      const getResAfter = await fetch(`${BASE_URL}/customers`, { headers: cashierHeaders });
      const getDataAfter = await getResAfter.json();
      const foundAfter = getDataAfter.data.customers.find((c) => c.id === cust.id);
      assert.ok(foundAfter, 'Reactivated customer must appear in active list');

      // Cleanup
      await prisma.order.deleteMany({ where: { id: order.id } });
      await prisma.customer.delete({ where: { id: cust.id } });
    });

    // 4. Force delete on customer with transaction safely nullifies references without FK error
    await t.test('4. Force delete cleanly removes customer and nullifies FK relations without P2003 error', async () => {
      const phone = '0899990003';
      const cust = await prisma.customer.create({
        data: {
          name: 'Pelanggan Force Delete',
          phone,
          isActive: true,
        },
      });

      const order = await prisma.order.create({
        data: {
          invoiceNo: `INV-FORCE-${Date.now()}`,
          cashierId: cashierUser.id,
          customerId: cust.id,
          customerName: cust.name,
          type: 'TAKE_AWAY',
          status: 'PAID',
          subtotal: 25000,
          total: 25000,
        },
      });

      // Force delete
      const delRes = await fetch(`${BASE_URL}/customers/${cust.id}?force=true`, {
        method: 'DELETE',
        headers: managerHeaders,
      });
      const delData = await delRes.json();
      assert.equal(delRes.status, 200);
      assert.equal(delData.data?.isDeleted, true);

      // Verify customer record is completely gone
      const checkCust = await prisma.customer.findUnique({ where: { id: cust.id } });
      assert.equal(checkCust, null, 'Customer must be hard deleted');

      // Verify order still exists and customerId is nullified
      const checkOrder = await prisma.order.findUnique({ where: { id: order.id } });
      assert.ok(checkOrder, 'Order must still exist');
      assert.equal(checkOrder.customerId, null, 'Order customerId must be set to null');
      assert.equal(checkOrder.customerName, 'Pelanggan Force Delete', 'Order customerName preserved');

      // Cleanup order
      await prisma.order.delete({ where: { id: order.id } });
    });

  } finally {
    // Cleanup users
    await prisma.user.deleteMany({
      where: {
        username: { in: ['test_cust_kasir', 'test_cust_manager', 'test_cust_owner'] },
      },
    });
    server.close();
    await prisma.$disconnect();
  }
});
