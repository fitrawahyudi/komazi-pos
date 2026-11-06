import prisma from '../src/config/db.js';
import {
  validateCartStock,
  checkoutQrOrder,
  getPendingQrOrders,
  confirmQrOrderPayment,
  rejectQrOrderPayment,
  updateQrOrderConfig,
} from '../src/controllers/qrOrderController.js';

function mockReq(body = {}, params = {}, query = {}) {
  return {
    body,
    params,
    query,
    user: { id: 1, role: 'CASHIER', name: 'Kasir Uji Coba' },
  };
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

// 1x1 transparent PNG base64
const DUMMY_BASE64_PROOF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runCheckoutTests() {
  console.log('=== TEST 1: validateCartStock when Feature Flag is OFF ===');
  await updateQrOrderConfig(mockReq({ enabled: false }), mockRes());

  const res1 = mockRes();
  await validateCartStock(mockReq({ items: [{ productId: 1, qty: 1 }] }), res1);
  console.log('[PASS] Status Code (Expected 403):', res1.statusCode);
  if (res1.statusCode !== 403) {
    throw new Error('validateCartStock must be blocked when qrOrderEnabled is false');
  }

  console.log('\n=== TEST 2: Toggle Feature Flag ON for Testing ===');
  await updateQrOrderConfig(mockReq({
    enabled: true,
    bankName: 'BCA',
    accountNo: '8720192831',
    accountHolder: 'Komazi Space',
  }), mockRes());

  // Ambil produk nyata dari database
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true, isSoldOut: false },
    take: 2,
  });
  if (activeProducts.length === 0) {
    throw new Error('No active products found in DB for test');
  }
  const testProduct = activeProducts[0];
  console.log(`[INFO] Using Product: ${testProduct.name} (ID: ${testProduct.id}, Price: ${testProduct.price})`);

  console.log('\n=== TEST 3: validateCartStock with Ready Item ===');
  const res3 = mockRes();
  await validateCartStock(mockReq({ items: [{ productId: testProduct.id, qty: 1 }] }), res3);
  console.log('[PASS] Valid?:', res3.data?.data?.valid);
  if (res3.data?.data?.valid !== true) {
    throw new Error('Cart stock validation failed for active ready item');
  }

  console.log('\n=== TEST 4: validateCartStock with Sold Out Item ===');
  // Buat produk sementara sold out untuk uji proteksi
  await prisma.product.update({
    where: { id: testProduct.id },
    data: { isSoldOut: true },
  });

  const res4 = mockRes();
  await validateCartStock(mockReq({ items: [{ productId: testProduct.id, qty: 1 }] }), res4);
  console.log('[PASS] Valid result for sold out:', res4.data?.valid === false);
  console.log('[PASS] Unavailable reasons:', res4.data?.unavailableItems);
  if (res4.data?.valid !== false) {
    throw new Error('Sold out item must fail cart stock validation');
  }

  // Kembalikan produk jadi tersedia lagi
  await prisma.product.update({
    where: { id: testProduct.id },
    data: { isSoldOut: false },
  });

  console.log('\n=== TEST 5: checkoutQrOrder (Create Pending Order) ===');
  const res5 = mockRes();
  await checkoutQrOrder(
    mockReq({
      tableNo: 'Meja 04',
      customerName: 'Budi Santoso',
      paymentMethod: 'QRIS',
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          qty: 2,
          unitPrice: Number(testProduct.price),
        },
      ],
      proofImage: DUMMY_BASE64_PROOF,
    }),
    res5
  );

  console.log('[PASS] Status Code (Expected 201):', res5.statusCode);
  const createdOrder = res5.data?.data;
  console.log('[PASS] Order Created:', createdOrder?.invoiceNo, '| Table:', createdOrder?.tableNo, '| Total:', createdOrder?.total);
  console.log('[PASS] Order Status (Expected PENDING_PAYMENT):', createdOrder?.status);
  console.log('[PASS] Proof URL:', createdOrder?.proofUrl);

  if (createdOrder?.status !== 'PENDING_PAYMENT' || !createdOrder?.proofUrl) {
    throw new Error('Order was not created with PENDING_PAYMENT or proofUrl missing');
  }

  console.log('\n=== TEST 6: getPendingQrOrders (Cashier Reviews List) ===');
  const res6 = mockRes();
  await getPendingQrOrders(mockReq(), res6);
  const pendingList = res6.data?.data || [];
  const foundInPending = pendingList.some((o) => o.id === createdOrder.id);
  console.log('[PASS] Order found in Cashier Pending List?:', foundInPending);
  if (!foundInPending) {
    throw new Error('Created order does not appear in pending QR orders list');
  }

  console.log('\n=== TEST 7: confirmQrOrderPayment (Cashier Approves Payment) ===');
  const res7 = mockRes();
  await confirmQrOrderPayment(mockReq({}, { id: createdOrder.id }), res7);
  console.log('[PASS] Status Code:', res7.statusCode);
  const confirmedOrder = res7.data?.data;
  console.log('[PASS] Confirmed Status (Expected PAID):', confirmedOrder?.status);
  console.log('[PASS] Paid At timestamp:', confirmedOrder?.paidAt);
  if (confirmedOrder?.status !== 'PAID' || !confirmedOrder?.paidAt) {
    throw new Error('Failed to confirm QR order payment');
  }

  console.log('\n=== TEST 8: rejectQrOrderPayment (Cashier Rejects Invalid Proof) ===');
  // Buat order kedua untuk diuji penolakannya
  const res8a = mockRes();
  await checkoutQrOrder(
    mockReq({
      tableNo: 'Meja 07',
      customerName: 'Tamu Iseng',
      paymentMethod: 'TRANSFER',
      items: [{ productId: testProduct.id, qty: 1, unitPrice: Number(testProduct.price) }],
      proofImage: DUMMY_BASE64_PROOF,
    }),
    res8a
  );
  const orderToReject = res8a.data?.data;

  const res8b = mockRes();
  await rejectQrOrderPayment(
    mockReq({ reason: 'Struk transfer blur tidak terbaca' }, { id: orderToReject.id }),
    res8b
  );
  console.log('[PASS] Rejected Status (Expected VOIDED):', res8b.data?.data?.status);
  console.log('[PASS] Void Reason:', res8b.data?.data?.voidReason);
  if (res8b.data?.data?.status !== 'VOIDED') {
    throw new Error('Failed to reject invalid QR order');
  }

  console.log('\n=== TEST 9: Reset Feature Flag to False (Trial default) ===');
  await updateQrOrderConfig(mockReq({ enabled: false }), mockRes());
  console.log('[PASS] Reset to OFF successfully');

  console.log('\nALL TASK 2 CHECKOUT & VERIFICATION INTEGRATION TESTS PASSED!');
  process.exit(0);
}

runCheckoutTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});

