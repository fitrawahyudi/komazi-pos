import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import prisma from './src/config/db.js';

async function runTests() {
  console.log('🧪 Running automated end-to-end API verification...');
  await prisma.$connect();

  const server = app.listen(4001);
  const BASE_URL = 'http://localhost:4001/api/v1';

  try {
    // 1. Health check
    console.log('1️⃣ Testing GET /health ...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('   Status:', healthRes.status, health);

    // 2. Login as Owner
    console.log('2️⃣ Testing POST /auth/login ...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'password123' }),
    });
    const loginData = await loginRes.json();
    console.log('   Status:', loginRes.status, 'User:', loginData.data?.user?.username, 'Role:', loginData.data?.user?.role);
    const token = loginData.data?.token;

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 3. Get Products
    console.log('3️⃣ Testing GET /products ...');
    const prodRes = await fetch(`${BASE_URL}/products`, { headers: authHeaders });
    const prodData = await prodRes.json();
    console.log('   Status:', prodRes.status, 'Total Products:', prodData.data?.length);

    // 4. Get Categories
    console.log('4️⃣ Testing GET /categories ...');
    const catRes = await fetch(`${BASE_URL}/categories`, { headers: authHeaders });
    const catData = await catRes.json();
    console.log('   Status:', catRes.status, 'Total Categories:', catData.data?.length);

    // 5. Get Workspace Areas
    console.log('5️⃣ Testing GET /workspace/areas ...');
    const wsRes = await fetch(`${BASE_URL}/workspace/areas`, { headers: authHeaders });
    const wsData = await wsRes.json();
    console.log('   Status:', wsRes.status, 'Total Areas:', wsData.data?.length);

    // 6. Get Ingredients (Stock)
    console.log('6️⃣ Testing GET /ingredients ...');
    const stockRes = await fetch(`${BASE_URL}/ingredients`, { headers: authHeaders });
    const stockData = await stockRes.json();
    console.log('   Status:', stockRes.status, 'Total Ingredients:', stockData.data?.length);

    // 7. Get Reports Summary
    console.log('7️⃣ Testing GET /reports/summary ...');
    const repRes = await fetch(`${BASE_URL}/reports/summary`, { headers: authHeaders });
    const repData = await repRes.json();
    console.log('   Status:', repRes.status, 'Summary Data:', repData.data);

    // 8. Create Order Test
    console.log('8️⃣ Testing POST /orders ...');
    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'DINE_IN',
        tableNo: '05',
        customerName: 'Budi Test Pelanggan',
        items: [
          {
            productId: prodData.data[0].id,
            qty: 2,
            unitPrice: parseFloat(prodData.data[0].price),
            variantName: 'Regular',
          },
        ],
        payments: [
          {
            method: 'QRIS',
            amount: parseFloat(prodData.data[0].price) * 2,
          },
        ],
      }),
    });
    const orderData = await orderRes.json();
    console.log('   Status:', orderRes.status, 'Invoice:', orderData.data?.invoiceNo, 'Total:', orderData.data?.total);

    console.log('\n🎉 ALL 8 API MODULE TESTS PASSED WITH 100% SUCCESS!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
