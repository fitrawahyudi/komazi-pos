import prisma from '../src/config/db.js';
import {
  registerDeviceToken,
  deactivateDeviceToken,
  resolveRecipientsForEvent,
  dispatchNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../src/services/notification.service.js';
import { fcmService, isFCMConfigured } from '../src/services/fcm.service.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
  passedTests++;
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🚀 KOMAZI POS — ROLE-BASED PUSH NOTIFICATION TEST SUITE');
  console.log('============================================================\n');

  try {
    // 0. Verify Database Connection and Seeded Users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, username: true, role: true },
    });
    assert(users.length > 0, `Database has ${users.length} active users`);

    const owner = users.find((u) => u.role === 'OWNER') || users[0];
    const cashier = users.find((u) => u.role === 'CASHIER') || users[0];
    const kitchen = users.find((u) => u.role === 'KITCHEN') || users[0];
    const barista = users.find((u) => u.role === 'BARISTA') || users[0];
    const manager = users.find((u) => u.role === 'MANAGER') || owner;

    console.log(`Staff fixtures resolved:`);
    console.log(`- OWNER: ${owner.name} (id=${owner.id})`);
    console.log(`- MANAGER: ${manager.name} (id=${manager.id})`);
    console.log(`- CASHIER: ${cashier.name} (id=${cashier.id})`);
    console.log(`- KITCHEN: ${kitchen.name} (id=${kitchen.id})`);
    console.log(`- BARISTA: ${barista.name} (id=${barista.id})\n`);

    // 1. Test Device Token Registration & Unique Constraint
    console.log('--- TEST GROUP 1: Device Token Lifecycle ---');
    const testTokenA = `fcm_test_token_alpha_${Date.now()}`;
    const registeredA = await registerDeviceToken({
      userId: cashier.id,
      token: testTokenA,
      platform: 'android',
      deviceModel: 'Samsung Galaxy Tab A8',
    });
    assert(registeredA.userId === cashier.id, 'DeviceToken registered for cashier');
    assert(registeredA.isActive === true, 'DeviceToken is marked active');

    // 2. Test Device Handoff / User Switch on Same Device
    const registeredB = await registerDeviceToken({
      userId: barista.id,
      token: testTokenA,
      platform: 'android',
      deviceModel: 'Samsung Galaxy Tab A8',
    });
    assert(registeredB.userId === barista.id, 'DeviceToken successfully reassigned to new user on account switch');
    assert(registeredB.id === registeredA.id, 'DeviceToken record reused without duplicate row creation');

    // Verify token count in DB for testTokenA is exactly 1
    const tokenCount = await prisma.deviceToken.count({ where: { token: testTokenA } });
    assert(tokenCount === 1, 'Strict uniqueness: Exactly 1 row exists for physical token string');

    // 3. Test Token Deactivation on Logout
    await deactivateDeviceToken({ userId: barista.id, token: testTokenA });
    const deactivatedToken = await prisma.deviceToken.findUnique({ where: { token: testTokenA } });
    assert(deactivatedToken.isActive === false, 'DeviceToken deactivated on user logout');

    // 4. Test Role-Based Recipient Resolution
    console.log('\n--- TEST GROUP 2: Role-Based Recipient Resolution ---');

    // Event: NEW_ORDER (Food & Drink items)
    const newOrderRecipients = await resolveRecipientsForEvent('NEW_ORDER', {
      hasKitchen: true,
      hasBar: true,
      initiatorId: cashier.id,
      excludeInitiator: true,
    });
    assert(newOrderRecipients.includes(kitchen.id), 'NEW_ORDER routes to KITCHEN role');
    assert(newOrderRecipients.includes(barista.id), 'NEW_ORDER routes to BARISTA role');
    assert(!newOrderRecipients.includes(cashier.id), 'NEW_ORDER excludes cashier initiator');

    // Event: ORDER_PAID
    const paidRecipients = await resolveRecipientsForEvent('ORDER_PAID', {});
    assert(paidRecipients.includes(owner.id), 'ORDER_PAID routes to OWNER');

    // Event: ORDER_READY
    const readyRecipients = await resolveRecipientsForEvent('ORDER_READY', { cashierId: cashier.id });
    assert(readyRecipients.includes(cashier.id), 'ORDER_READY routes to CASHIER role and opening cashier');

    // Event: ORDER_VOIDED
    const voidRecipients = await resolveRecipientsForEvent('ORDER_VOIDED', { hadActivePrep: true });
    assert(voidRecipients.includes(owner.id), 'ORDER_VOIDED routes to OWNER/MANAGER');

    // Event: REFUND_REQUEST / APPROVAL_REQUEST
    const approvalRecipients = await resolveRecipientsForEvent('REFUND_REQUEST', {});
    assert(approvalRecipients.includes(owner.id), 'REFUND_REQUEST strictly routes to OWNER/MANAGER');
    assert(!approvalRecipients.includes(cashier.id), 'REFUND_REQUEST denies non-privileged CASHIER role');

    // Event: LOW_STOCK
    const stockRecipients = await resolveRecipientsForEvent('LOW_STOCK', { isCoffeeOrDrink: true });
    assert(stockRecipients.includes(owner.id), 'LOW_STOCK routes to OWNER');
    assert(stockRecipients.includes(barista.id), 'LOW_STOCK coffee routes to BARISTA');

    // 5. Test Notification Dispatch & In-App Persistence
    console.log('\n--- TEST GROUP 3: Notification Dispatch & History ---');
    const dispatchResult = await dispatchNotification({
      event: 'ORDER_PAID',
      category: 'ORDERS',
      title: 'Struk Transaksi #KMZ-TEST-999',
      body: 'Pembayaran Rp75.000 via QRIS Dinamis berhasil diverifikasi',
      data: { invoiceNo: 'KMZ-TEST-999', total: '75000', url: '/orders' },
      targetUserIds: [owner.id],
    });
    assert(dispatchResult.success === true, 'Notification dispatch succeeded non-blockingly');
    assert(dispatchResult.persistedCount >= 1, 'In-App notification record persisted in MySQL database');

    // Verify In-App history query
    const ownerHistory = await getUserNotifications({ userId: owner.id, limit: 10 });
    assert(ownerHistory.notifications.length > 0, 'Owner retrieved in-app notification history');
    const latestNotif = ownerHistory.notifications[0];
    assert(latestNotif.title === 'Struk Transaksi #KMZ-TEST-999', 'Retrieved latest notification content matches');
    assert(latestNotif.isRead === false, 'Fresh notification initialized with isRead=false');

    // Unread Count
    const unreadCountBefore = await getUnreadCount(owner.id);
    assert(unreadCountBefore > 0, `Unread count before markAsRead is ${unreadCountBefore}`);

    // Mark as Read
    await markAsRead({ id: latestNotif.id, userId: owner.id });
    const updatedNotif = await prisma.notification.findUnique({ where: { id: latestNotif.id } });
    assert(updatedNotif.isRead === true, 'Notification marked as isRead=true');
    assert(updatedNotif.readAt !== null, 'readAt timestamp recorded');

    // Mark All as Read
    await markAllAsRead(owner.id);
    const unreadCountAfter = await getUnreadCount(owner.id);
    assert(unreadCountAfter === 0, 'Unread count becomes 0 after markAllAsRead');

    // 6. Test Non-Blocking Resiliency
    console.log('\n--- TEST GROUP 4: Non-Blocking Fault Tolerance ---');
    const startDispatch = Date.now();
    const resilientResult = await dispatchNotification({
      event: 'NEW_ORDER',
      category: 'ORDERS',
      title: 'Resiliency Benchmark Order',
      body: 'Simulating FCM dispatch with inactive/empty tokens',
      targetUserIds: [kitchen.id],
    });
    const duration = Date.now() - startDispatch;
    assert(resilientResult.success === true, 'Dispatch returns success even when no active device tokens present');
    assert(duration < 2000, `Dispatch completed rapidly (${duration}ms) ensuring zero POS transaction lag`);

    // Clean up test tokens & test notifications
    await prisma.deviceToken.deleteMany({ where: { token: testTokenA } });
    await prisma.notification.deleteMany({
      where: { title: { in: ['Struk Transaksi #KMZ-TEST-999', 'Resiliency Benchmark Order'] } },
    });

    console.log('\n============================================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} checks verified!`);
    console.log(`FCM Provider Status: ${isFCMConfigured() ? 'Firebase Admin Active' : 'Simulated/Dev Mode (Graceful)'}`);
    console.log('============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE ENCOUNTERED FATAL ERROR:', err);
    process.exit(1);
  }
}

runTests();
