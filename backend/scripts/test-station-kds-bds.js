import prisma from '../src/config/db.js';
import {
  getStationOrders,
  bumpOrderItem,
  bumpTicket,
  updateOrderItemStatus,
  isDrinkItemHelper,
  isItemForStation,
} from '../src/services/kdsService.js';

async function runTest() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST OTOMATIS: KDS & BDS STATION SUITE');
  console.log('====================================================\n');

  let kitchenStation = null;
  let barStation = null;
  let testCategoryFood = null;
  let testCategoryDrink = null;
  let testProductFood = null;
  let testProductDrink = null;
  let testOrder = null;
  let testCashier = null;

  try {
    // 0. SETUP: Pastikan Station KITCHEN_MAIN dan BAR_MAIN tersedia
    console.log('[SETUP] Memeriksa stasiun produksi & data master uji...');

    kitchenStation = await prisma.station.upsert({
      where: { code: 'KITCHEN_MAIN' },
      update: { isActive: true },
      create: {
        name: 'Dapur Utama Uji',
        code: 'KITCHEN_MAIN',
        type: 'KITCHEN',
        isActive: true,
      },
    });

    barStation = await prisma.station.upsert({
      where: { code: 'BAR_MAIN' },
      update: { isActive: true },
      create: {
        name: 'Bar Minuman Uji',
        code: 'BAR_MAIN',
        type: 'BAR',
        isActive: true,
      },
    });

    testCashier = await prisma.user.findFirst({
      where: { role: 'CASHIER' },
    });
    if (!testCashier) {
      testCashier = await prisma.user.create({
        data: {
          name: 'Kasir Uji KDS',
          username: `cashier_kds_${Date.now()}`,
          password: 'hashed_password',
          role: 'CASHIER',
        },
      });
    }

    testCategoryFood = await prisma.category.create({
      data: { name: `Makanan Uji ${Date.now()}`, sortOrder: 1 },
    });

    testCategoryDrink = await prisma.category.create({
      data: { name: `Kopi Bar Uji ${Date.now()}`, sortOrder: 2 },
    });

    testProductFood = await prisma.product.create({
      data: {
        name: `Nasi Goreng Uji ${Date.now()}`,
        price: 30000,
        categoryId: testCategoryFood.id,
        stationId: kitchenStation.id,
      },
    });

    testProductDrink = await prisma.product.create({
      data: {
        name: `Iced Latte Uji ${Date.now()}`,
        price: 25000,
        categoryId: testCategoryDrink.id,
        stationId: barStation.id,
      },
    });

    console.log('✅ Data master siap: KDS (Makanan) & BDS (Minuman) terkonfigurasi.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 1: PEMBUATAN PESANAN CAMPURAN (MAKANAN + MINUMAN)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Pembuatan Pesanan Campuran (1x Makanan + 1x Minuman) ---');
    const invoiceNo = `INV-KDS-${Date.now()}`;

    testOrder = await prisma.order.create({
      data: {
        invoiceNo,
        cashierId: testCashier.id,
        status: 'OPEN',
        kitchenStatus: 'PENDING',
        barStatus: 'PENDING',
        type: 'DINE_IN',
        tableNo: 'Meja 88',
        subtotal: 55000,
        total: 55000,
        items: {
          create: [
            {
              productId: testProductFood.id,
              stationId: kitchenStation.id,
              productName: testProductFood.name,
              qty: 1,
              unitPrice: 30000,
              lineTotal: 30000,
              status: 'PENDING',
            },
            {
              productId: testProductDrink.id,
              stationId: barStation.id,
              productName: testProductDrink.name,
              qty: 1,
              unitPrice: 25000,
              lineTotal: 25000,
              status: 'PENDING',
            },
          ],
        },
      },
      include: {
        items: { include: { station: true } },
      },
    });

    const foodItem = testOrder.items.find((i) => i.productId === testProductFood.id);
    const drinkItem = testOrder.items.find((i) => i.productId === testProductDrink.id);

    console.log(`Order dibuat #${testOrder.id} (${testOrder.invoiceNo}) - Status: ${testOrder.status}`);
    console.log(`Food Item ID: ${foodItem.id}, Drink Item ID: ${drinkItem.id}`);
    console.log('✅ TEST 1 LULUS: Pesanan campuran berhasil dibuat.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 2: ISOLASI STASIUN (KDS Hanya Makanan, BDS Hanya Minuman)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Isolasi Stasiun KDS & BDS ---');
    const kdsOrders = await getStationOrders({ stationType: 'KITCHEN', status: 'ACTIVE' });
    const bdsOrders = await getStationOrders({ stationType: 'BAR', status: 'ACTIVE' });

    const kdsMatch = kdsOrders.find((o) => o.id === testOrder.id);
    const bdsMatch = bdsOrders.find((o) => o.id === testOrder.id);

    if (!kdsMatch || !bdsMatch) {
      throw new Error('TEST 2 GAGAL: Pesanan tidak muncul di antrean KDS atau BDS!');
    }

    console.log(`KDS items count: ${kdsMatch.items.length} (Ekspektasi: 1 item makanan)`);
    console.log(`BDS items count: ${bdsMatch.items.length} (Ekspektasi: 1 item minuman)`);

    const kdsHasDrink = kdsMatch.items.some((i) => i.productId === testProductDrink.id);
    const bdsHasFood = bdsMatch.items.some((i) => i.productId === testProductFood.id);

    if (kdsHasDrink) throw new Error('TEST 2 GAGAL: Item minuman bocor ke KDS!');
    if (bdsHasFood) throw new Error('TEST 2 GAGAL: Item makanan bocor ke BDS!');

    console.log('✅ TEST 2 LULUS: Isolasi stasiun KDS dan BDS sempurna.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 3: BUMP ITEM MAKANAN DARI PENDING -> PREPARING -> READY -> SERVED
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Alur Siklus Bump Item Makanan ---');

    // 3a: PENDING -> PREPARING
    console.log('3a: Bump ke PREPARING...');
    const step1 = await bumpOrderItem({ itemId: foodItem.id, userId: testCashier.id });
    if (step1.updatedItem.status !== 'PREPARING' || !step1.updatedItem.preparingAt) {
      throw new Error('TEST 3a GAGAL: Status item bukan PREPARING atau preparingAt kosong!');
    }
    if (step1.updatedOrder.kitchenStatus !== 'IN_PROGRESS') {
      throw new Error(`TEST 3a GAGAL: kitchenStatus harusnya IN_PROGRESS, tapi ${step1.updatedOrder.kitchenStatus}`);
    }
    if (step1.updatedOrder.barStatus !== 'PENDING') {
      throw new Error('TEST 3a GAGAL: barStatus terpengaruh perubahan kitchen!');
    }
    if (step1.updatedOrder.status !== 'OPEN') {
      throw new Error('TEST 3a GAGAL: status finansial OPEN tertimpa!');
    }
    console.log('  -> Status: PREPARING (preparingAt terisi, kitchenStatus: IN_PROGRESS)');

    // 3b: PREPARING -> READY
    console.log('3b: Bump ke READY...');
    const step2 = await bumpOrderItem({ itemId: foodItem.id, userId: testCashier.id });
    if (step2.updatedItem.status !== 'READY' || !step2.updatedItem.readyAt) {
      throw new Error('TEST 3b GAGAL: Status item bukan READY atau readyAt kosong!');
    }
    if (step2.updatedOrder.kitchenStatus !== 'READY') {
      throw new Error(`TEST 3b GAGAL: kitchenStatus harusnya READY, tapi ${step2.updatedOrder.kitchenStatus}`);
    }
    console.log('  -> Status: READY (readyAt terisi, kitchenStatus: READY)');

    // 3c: READY -> SERVED
    console.log('3c: Bump ke SERVED...');
    const step3 = await bumpOrderItem({ itemId: foodItem.id, userId: testCashier.id });
    if (step3.updatedItem.status !== 'SERVED' || !step3.updatedItem.servedAt) {
      throw new Error('TEST 3c GAGAL: Status item bukan SERVED atau servedAt kosong!');
    }
    if (step3.updatedOrder.kitchenStatus !== 'SERVED') {
      throw new Error(`TEST 3c GAGAL: kitchenStatus harusnya SERVED, tapi ${step3.updatedOrder.kitchenStatus}`);
    }
    if (step3.updatedOrder.status !== 'OPEN') {
      throw new Error('TEST 3c GAGAL: status finansial OPEN tertimpa saat disajikan!');
    }
    console.log('  -> Status: SERVED (servedAt terisi, kitchenStatus: SERVED, order: OPEN)');
    console.log('✅ TEST 3 LULUS: Siklus Bump Item & Timestamp sukses.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 4: TICKET BATCH BUMP UNTUK STASIUN BAR (BDS)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Batch Bump Tiket Bar (BDS) ---');

    // 4a: Batch bump ke READY
    console.log('4a: Batch bump tiket ke READY...');
    const bumpTicketReady = await bumpTicket({
      orderId: testOrder.id,
      stationType: 'BAR',
      userId: testCashier.id,
    });
    const refreshedDrinkAfterReady = await prisma.orderItem.findUnique({ where: { id: drinkItem.id } });
    if (refreshedDrinkAfterReady.status !== 'READY' || !refreshedDrinkAfterReady.readyAt) {
      throw new Error('TEST 4a GAGAL: Item minuman belum READY setelah batch bump!');
    }
    if (bumpTicketReady.order.barStatus !== 'READY') {
      throw new Error(`TEST 4a GAGAL: barStatus harusnya READY, tapi ${bumpTicketReady.order.barStatus}`);
    }
    console.log('  -> Batch bump berhasil: Item minuman READY, barStatus: READY');

    // 4b: Batch bump ke SERVED
    console.log('4b: Batch bump tiket ke SERVED...');
    const bumpTicketServed = await bumpTicket({
      orderId: testOrder.id,
      stationType: 'BAR',
      userId: testCashier.id,
    });
    const refreshedDrinkAfterServed = await prisma.orderItem.findUnique({ where: { id: drinkItem.id } });
    if (refreshedDrinkAfterServed.status !== 'SERVED' || !refreshedDrinkAfterServed.servedAt) {
      throw new Error('TEST 4b GAGAL: Item minuman belum SERVED setelah batch bump kedua!');
    }
    if (bumpTicketServed.order.barStatus !== 'SERVED') {
      throw new Error(`TEST 4b GAGAL: barStatus harusnya SERVED, tapi ${bumpTicketServed.order.barStatus}`);
    }
    console.log('  -> Batch bump berhasil: Item minuman SERVED, barStatus: SERVED');
    console.log('✅ TEST 4 LULUS: Batch Bump Tiket sukses.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 5: ANTREAN AKTIF OTOMATIS BERSIH SAAT ITEM SELESAI
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: Antrean Aktif Bersih setelah Seluruh Item SERVED ---');
    const activeKdsAfter = await getStationOrders({ stationType: 'KITCHEN', status: 'ACTIVE' });
    const activeBdsAfter = await getStationOrders({ stationType: 'BAR', status: 'ACTIVE' });

    const kdsStillHasOrder = activeKdsAfter.some((o) => o.id === testOrder.id);
    const bdsStillHasOrder = activeBdsAfter.some((o) => o.id === testOrder.id);

    if (kdsStillHasOrder || bdsStillHasOrder) {
      throw new Error('TEST 5 GAGAL: Pesanan yang seluruh itemnya SERVED masih muncul di antrean aktif!');
    }
    console.log('✅ TEST 5 LULUS: Pesanan selesai otomatis hilang dari antrean aktif KDS & BDS.\n');

    console.log('====================================================');
    console.log('🎉 SEMUA 5 SKENARIO PENGUJIAN KDS & BDS SUKSES!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERROR SAAT PENGUJIAN KDS/BDS:', err);
    process.exitCode = 1;
  } finally {
    // CLEANUP: Bersihkan data uji dari database
    console.log('\n[CLEANUP] Membersihkan data uji dari database...');
    try {
      if (testOrder) {
        await prisma.auditLog.deleteMany({
          where: { action: { in: ['UPDATE_ORDER_ITEM_STATUS', 'BUMP_TICKET'] } },
        });
        await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.order.deleteMany({ where: { id: testOrder.id } });
      }
      if (testProductFood) {
        await prisma.product.deleteMany({ where: { id: testProductFood.id } });
      }
      if (testProductDrink) {
        await prisma.product.deleteMany({ where: { id: testProductDrink.id } });
      }
      if (testCategoryFood) {
        await prisma.category.deleteMany({ where: { id: testCategoryFood.id } });
      }
      if (testCategoryDrink) {
        await prisma.category.deleteMany({ where: { id: testCategoryDrink.id } });
      }
      console.log('✅ Pembersihan data uji selesai.');
    } catch (cleanErr) {
      console.warn('Peringatan saat cleanup:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTest();
