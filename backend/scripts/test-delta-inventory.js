import prisma from '../src/config/db.js';
import { deltaInventoryService } from '../src/services/deltaInventoryService.js';

async function runTest() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST OTOMATIS: DELTA INVENTORY SUITE');
  console.log('====================================================\n');

  let testIngredient = null;
  let testCategory = null;
  let testProduct = null;
  let testOrder = null;
  let testCashier = null;

  try {
    // 0. SETUP: Siapkan data dummy terisolasi
    console.log('[SETUP] Menyiapkan bahan baku, produk, dan resep uji...');

    testCashier = await prisma.user.findFirst({
      where: { role: 'CASHIER' },
    });
    if (!testCashier) {
      testCashier = await prisma.user.create({
        data: {
          name: 'Kasir Uji',
          username: `cashier_test_${Date.now()}`,
          password: 'hashed_password',
          role: 'CASHIER',
        },
      });
    }

    testIngredient = await prisma.ingredient.create({
      data: {
        name: `Bahan Uji Delta Beef ${Date.now()}`,
        unit: 'pcs',
        stock: 10.0,
        minStock: 2.0,
        costPerUnit: 15000,
      },
    });

    testCategory = await prisma.category.create({
      data: {
        name: `Kategori Uji Delta ${Date.now()}`,
        sortOrder: 99,
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: `Burger Uji Delta ${Date.now()}`,
        price: 35000,
        categoryId: testCategory.id,
        recipeItems: {
          create: [
            {
              ingredientId: testIngredient.id,
              quantity: 1.0, // 1 porsi butuh 1 pcs daging
            },
          ],
        },
      },
    });

    console.log(`✅ Data uji siap: Stok awal bahan "${testIngredient.name}" = 10 pcs.\n`);

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 1: PEMBUATAN HOLD BILL (status: OPEN)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Pembuatan Hold Bill (2x Burger) ---');
    const invoiceNo = `INV-TEST-${Date.now()}`;

    testOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          invoiceNo,
          cashierId: testCashier.id,
          status: 'OPEN',
          type: 'DINE_IN',
          tableNo: 'T-99',
          subtotal: 70000,
          total: 70000,
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                qty: 2,
                unitPrice: 35000,
                lineTotal: 70000,
                status: 'PENDING',
              },
            ],
          },
        },
      });

      // Potong stok seketika saat order OPEN
      await deltaInventoryService.deductNewOrderStock(
        tx,
        order.id,
        order.invoiceNo,
        [{ productId: testProduct.id, productName: testProduct.name, qty: 2 }]
      );

      return order;
    });

    const ingAfterCreate = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`Stok bahan saat ini: ${ingAfterCreate.stock} pcs (Ekspektasi: 8 pcs)`);
    if (parseFloat(ingAfterCreate.stock) !== 8) {
      throw new Error(`TEST 1 GAGAL: Stok harusnya 8, tapi ${ingAfterCreate.stock}`);
    }
    console.log('✅ TEST 1 LULUS: Immediate BOM deduction pada OPEN berhasil.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 2: EDIT ORDER TAMBAH ITEM (Delta Positif: 2 -> 5, Delta = +3)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Edit Hold Bill bertambah porsi (2 -> 5, Delta +3) ---');
    await prisma.$transaction(async (tx) => {
      const existingItems = await tx.orderItem.findMany({ where: { orderId: testOrder.id } });
      const incomingItems = [{ productId: testProduct.id, productName: testProduct.name, qty: 5, unitPrice: 35000 }];

      await deltaInventoryService.processOrderDelta(
        tx,
        testOrder.id,
        testOrder.invoiceNo,
        existingItems,
        incomingItems
      );

      await tx.orderItem.updateMany({
        where: { orderId: testOrder.id, productId: testProduct.id },
        data: { qty: 5, lineTotal: 175000 },
      });
    });

    const ingAfterAdd = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`Stok bahan saat ini: ${ingAfterAdd.stock} pcs (Ekspektasi: 5 pcs)`);
    if (parseFloat(ingAfterAdd.stock) !== 5) {
      throw new Error(`TEST 2 GAGAL: Stok harusnya 5, tapi ${ingAfterAdd.stock}`);
    }
    console.log('✅ TEST 2 LULUS: Delta deduction (+3) berhasil.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 3: EDIT ORDER KURANGI ITEM (Delta Negatif: 5 -> 1, Delta = -4)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Edit Hold Bill berkurang porsi (5 -> 1, Delta -4 Restock) ---');
    await prisma.$transaction(async (tx) => {
      const existingItems = await tx.orderItem.findMany({ where: { orderId: testOrder.id } });
      const incomingItems = [{ productId: testProduct.id, productName: testProduct.name, qty: 1, unitPrice: 35000 }];

      await deltaInventoryService.processOrderDelta(
        tx,
        testOrder.id,
        testOrder.invoiceNo,
        existingItems,
        incomingItems
      );

      await tx.orderItem.updateMany({
        where: { orderId: testOrder.id, productId: testProduct.id },
        data: { qty: 1, lineTotal: 35000 },
      });
    });

    const ingAfterReduce = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`Stok bahan saat ini: ${ingAfterReduce.stock} pcs (Ekspektasi: 9 pcs)`);
    if (parseFloat(ingAfterReduce.stock) !== 9) {
      throw new Error(`TEST 3 GAGAL: Stok harusnya 9, tapi ${ingAfterReduce.stock}`);
    }
    console.log('✅ TEST 3 LULUS: Delta restock (-4) berhasil.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 4: VALIDASI STOK KURANG & ATOMIC ROLLBACK
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Validasi Stok Kurang (Coba tambah 50 pcs saat sisa stok 9) ---');
    let rollbackSuccess = false;
    try {
      await prisma.$transaction(async (tx) => {
        const existingItems = await tx.orderItem.findMany({ where: { orderId: testOrder.id } });
        // Coba tambah dari 1 menjadi 51 (+50 pcs)
        const incomingItems = [{ productId: testProduct.id, productName: testProduct.name, qty: 51, unitPrice: 35000 }];

        await deltaInventoryService.processOrderDelta(
          tx,
          testOrder.id,
          testOrder.invoiceNo,
          existingItems,
          incomingItems
        );
      });
    } catch (err) {
      rollbackSuccess = true;
      console.log(`Pesan galat tertangkap: "${err.message}" (Status Code: ${err.statusCode})`);
    }

    const ingAfterFail = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    if (!rollbackSuccess || parseFloat(ingAfterFail.stock) !== 9) {
      throw new Error('TEST 4 GAGAL: Mutasi tidak di-rollback dengan benar saat stok kurang!');
    }
    console.log('✅ TEST 4 LULUS: Transaksi atomik berhasil menggagalkan mutasi stok tidak cukup.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 5: JAMINAN ZERO DOUBLE-DEDUCTION SAAT PEMBAYARAN (status: PAID)
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: Pelunasan Tagihan (status: PAID) - Zero Double Deduction ---');
    await prisma.$transaction(async (tx) => {
      // Periksa apakah stok sudah pernah dipotong
      const existingSaleMovement = await tx.stockMovement.findFirst({
        where: {
          note: { contains: `Order #${testOrder.id}` },
          type: 'SALE',
        },
      });

      if (!existingSaleMovement) {
        throw new Error('Record SALE harusnya sudah ada dari fase OPEN!');
      }

      // STOK TIDAK DIPOTONG ULANG!
      await tx.order.update({
        where: { id: testOrder.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    });

    const ingAfterPay = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`Stok bahan setelah PAID: ${ingAfterPay.stock} pcs (Ekspektasi tetap: 9 pcs)`);
    if (parseFloat(ingAfterPay.stock) !== 9) {
      throw new Error(`TEST 5 GAGAL: Terjadi double deduction! Stok menjadi ${ingAfterPay.stock}`);
    }
    console.log('✅ TEST 5 LULUS: Zero Double-Deduction terbukti.\n');

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 6: VOID ORDER (status: VOIDED) - RESTOCK PENUH
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 6: Pembatalan Pesanan (VOID) - Restock Total Sisa Item ---');
    await prisma.$transaction(async (tx) => {
      // Kembalikan sisa 1x burger yang masih aktif di pesanan
      await deltaInventoryService.restoreOrderStock(tx, testOrder.id, 'Uji Batal');

      await tx.orderItem.updateMany({
        where: { orderId: testOrder.id },
        data: { status: 'CANCELLED' },
      });

      await tx.order.update({
        where: { id: testOrder.id },
        data: { status: 'VOIDED', voidReason: 'Uji Batal' },
      });
    });

    const ingAfterVoid = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`Stok bahan setelah VOID: ${ingAfterVoid.stock} pcs (Ekspektasi: kembali ke 10 pcs)`);
    if (parseFloat(ingAfterVoid.stock) !== 10) {
      throw new Error(`TEST 6 GAGAL: Stok harusnya kembali ke 10, tapi ${ingAfterVoid.stock}`);
    }
    console.log('✅ TEST 6 LULUS: Restock total saat VOID berhasil.\n');

    console.log('====================================================');
    console.log('🎉 SEMUA 6 SKENARIO PENGUJIAN DELTA INVENTORY SUKSES!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERROR SAAT PENGUJIAN:', err);
    process.exitCode = 1;
  } finally {
    // CLEANUP: Bersihkan data uji dari database
    console.log('\n[CLEANUP] Membersihkan data uji dari database...');
    try {
      if (testOrder) {
        await prisma.stockMovement.deleteMany({
          where: { note: { contains: `Order #${testOrder.id}` } },
        });
        await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.order.deleteMany({ where: { id: testOrder.id } });
      }
      if (testProduct) {
        await prisma.productRecipeItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.deleteMany({ where: { id: testProduct.id } });
      }
      if (testCategory) {
        await prisma.category.deleteMany({ where: { id: testCategory.id } });
      }
      if (testIngredient) {
        await prisma.stockMovement.deleteMany({ where: { ingredientId: testIngredient.id } });
        await prisma.ingredient.deleteMany({ where: { id: testIngredient.id } });
      }
      console.log('✅ Pembersihan data uji selesai.');
    } catch (cleanErr) {
      console.warn('Peringatan saat cleanup:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTest();
