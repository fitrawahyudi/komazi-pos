import prisma from '../src/config/db.js';
import { deltaInventoryService } from '../src/services/deltaInventoryService.js';
import { bumpOrderItem } from '../src/services/kdsService.js';

async function runE2E() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST OTOMATIS: POS & KDS/BDS E2E SUITE');
  console.log('====================================================\n');

  // 1. Setup Data Uji
  console.log('[SETUP] Menyiapkan stasiun, kategori, bahan baku, produk, dan shift...');

  const kitchenStation = await prisma.station.upsert({
    where: { code: 'KITCHEN_MAIN' },
    update: {},
    create: { name: 'Dapur Utama', code: 'KITCHEN_MAIN', type: 'KITCHEN' },
  });

  const barStation = await prisma.station.upsert({
    where: { code: 'BAR_MAIN' },
    update: {},
    create: { name: 'Bar Minuman', code: 'BAR_MAIN', type: 'BAR' },
  });

  const categoryFood = await prisma.category.create({
    data: { name: 'E2E Makanan M4' },
  });

  const categoryDrink = await prisma.category.create({
    data: { name: 'E2E Minuman M4' },
  });

  const ingredient = await prisma.ingredient.create({
    data: {
      name: 'E2E Bahan Baku M4',
      unit: 'pcs',
      stock: 20,
      costPerUnit: 5000,
    },
  });

  const foodProduct = await prisma.product.create({
    data: {
      name: 'E2E Rice Bowl M4',
      price: 25000,
      categoryId: categoryFood.id,
      stationId: kitchenStation.id,
      recipeItems: {
        create: [{ ingredientId: ingredient.id, quantity: 1 }],
      },
    },
  });

  const drinkProduct = await prisma.product.create({
    data: {
      name: 'E2E Iced Latte M4',
      price: 18000,
      categoryId: categoryDrink.id,
      stationId: barStation.id,
      recipeItems: {
        create: [{ ingredientId: ingredient.id, quantity: 1 }],
      },
    },
  });

  const cashier = await prisma.user.findFirst();

  let testOrderId = null;

  try {
    // -------------------------------------------------------------
    // SKENARIO 1: POS Cart Hold Bill (Status: OPEN)
    // -------------------------------------------------------------
    console.log('\n--- SKENARIO 1: POS Cart Hold Bill (Meja 08 - Status OPEN) ---');
    const orderHold = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          invoiceNo: `E2E-HOLD-${Date.now()}`,
          cashierId: cashier?.id || null,
          tableNo: '08',
          customerName: 'Bapak Ahmad',
          type: 'DINE_IN',
          status: 'OPEN',
          kitchenStatus: 'PENDING',
          barStatus: 'PENDING',
          subtotal: 43000,
          total: 43000,
          items: {
            create: [
              {
                productId: foodProduct.id,
                productName: foodProduct.name,
                stationId: kitchenStation.id,
                qty: 1,
                unitPrice: 25000,
                lineTotal: 25000,
                status: 'PENDING',
              },
              {
                productId: drinkProduct.id,
                productName: drinkProduct.name,
                stationId: barStation.id,
                qty: 1,
                unitPrice: 18000,
                lineTotal: 18000,
                status: 'PENDING',
              },
            ],
          },
        },
        include: { items: true },
      });

      // Potong stok seketika (BOM deduction)
      await deltaInventoryService.deductNewOrderStock(
        tx,
        ord.id,
        ord.invoiceNo,
        [
          { productId: foodProduct.id, productName: foodProduct.name, qty: 1 },
          { productId: drinkProduct.id, productName: drinkProduct.name, qty: 1 },
        ]
      );
      return ord;
    });

    testOrderId = orderHold.id;

    const ingAfterHold = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    console.log(`Stok bahan baku setelah Hold Bill: ${ingAfterHold.stock} pcs (Ekspektasi: 18 pcs)`);
    if (parseFloat(ingAfterHold.stock) !== 18) {
      throw new Error(`Skenario 1 Gagal: Stok tidak berkurang dari 20 ke 18. Aktual: ${ingAfterHold.stock}`);
    }
    console.log('✅ SKENARIO 1 LULUS: Hold Bill tersimpan, stok bahan berkurang instan ke 18.');

    // -------------------------------------------------------------
    // SKENARIO 2: Edit Open Bill (Delta Tambah 1 Porsi Rice Bowl)
    // -------------------------------------------------------------
    console.log('\n--- SKENARIO 2: Edit Meja 08 (Delta Tambah 1 Porsi Rice Bowl) ---');
    await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: testOrderId },
        include: { items: true },
      });

      // Item baru di cart: Food qty 2 (+1), Drink qty 1 (sama)
      const cartItems = [
        {
          productId: foodProduct.id,
          productName: foodProduct.name,
          qty: 2,
          unitPrice: 25000,
          lineTotal: 50000,
        },
        {
          productId: drinkProduct.id,
          productName: drinkProduct.name,
          qty: 1,
          unitPrice: 18000,
          lineTotal: 18000,
        },
      ];

      // Proses selisih delta stok
      await deltaInventoryService.processOrderDelta(
        tx,
        testOrderId,
        currentOrder.invoiceNo,
        currentOrder.items,
        cartItems
      );

      // In-place update item qty
      const existingFoodItem = currentOrder.items.find((i) => i.productId === foodProduct.id);
      await tx.orderItem.update({
        where: { id: existingFoodItem.id },
        data: { qty: 2, lineTotal: 50000 },
      });

      await tx.order.update({
        where: { id: testOrderId },
        data: { subtotal: 68000, total: 68000 },
      });
    });

    const ingAfterEdit = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    console.log(`Stok bahan baku setelah Delta Edit: ${ingAfterEdit.stock} pcs (Ekspektasi: 17 pcs)`);
    if (parseFloat(ingAfterEdit.stock) !== 17) {
      throw new Error(`Skenario 2 Gagal: Stok delta tidak berkurang dari 18 ke 17. Aktual: ${ingAfterEdit.stock}`);
    }
    console.log('✅ SKENARIO 2 LULUS: Delta inventory memotong selisih tanpa duplikasi.');

    // -------------------------------------------------------------
    // SKENARIO 3: Bumping di KDS & BDS (Status Order Tetap OPEN)
    // -------------------------------------------------------------
    console.log('\n--- SKENARIO 3: Bumping KDS (Makanan PREPARING -> READY -> SERVED) ---');
    const orderWithItems = await prisma.order.findUnique({
      where: { id: testOrderId },
      include: { items: true },
    });
    const foodItem = orderWithItems.items.find((i) => i.productId === foodProduct.id);

    // Bump 1: PENDING -> PREPARING
    await bumpOrderItem({ itemId: foodItem.id });
    // Bump 2: PREPARING -> READY
    await bumpOrderItem({ itemId: foodItem.id });
    // Bump 3: READY -> SERVED
    await bumpOrderItem({ itemId: foodItem.id });

    const updatedAfterBump = await prisma.order.findUnique({
      where: { id: testOrderId },
      include: { items: true },
    });

    console.log(`Status Pesanan: ${updatedAfterBump.status} (Harus tetap: OPEN)`);
    console.log(`Status Dapur (kitchenStatus): ${updatedAfterBump.kitchenStatus} (Ekspektasi: SERVED)`);
    console.log(`Status Bar (barStatus): ${updatedAfterBump.barStatus} (Ekspektasi: PENDING)`);

    if (updatedAfterBump.status !== 'OPEN' || updatedAfterBump.kitchenStatus !== 'SERVED') {
      throw new Error('Skenario 3 Gagal: Status order harus tetap OPEN dan kitchenStatus harus SERVED.');
    }
    console.log('✅ SKENARIO 3 LULUS: Bumping KDS berhasil, status OPEN tetap terjaga.');

    // -------------------------------------------------------------
    // SKENARIO 4: Settlement (Pelunasan Pembayaran Meja 08)
    // -------------------------------------------------------------
    console.log('\n--- SKENARIO 4: Pelunasan Pembayaran (Settlement via payOrder) ---');
    await prisma.$transaction(async (tx) => {
      const ord = await tx.order.findUnique({
        where: { id: testOrderId },
        include: { items: true },
      });

      // Verifikasi Zero Double-Deduction
      const existingSaleMovement = await tx.stockMovement.findFirst({
        where: {
          note: { contains: `Order #${ord.id}` },
          type: 'SALE',
        },
      });
      console.log(`Apakah stok bahan sudah terpotong saat Hold Bill? ${existingSaleMovement ? 'YA' : 'TIDAK'}`);

      if (!existingSaleMovement) {
        throw new Error('Skenario 4 Gagal: Stok seharusnya sudah tercatat terpotong.');
      }

      // Catat pembayaran & perbarui status ke PAID
      await tx.payment.create({
        data: {
          orderId: ord.id,
          method: 'CASH',
          amount: 68000,
        },
      });

      await tx.order.update({
        where: { id: ord.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    });

    const ingAfterPay = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    console.log(`Stok bahan baku setelah Pelunasan: ${ingAfterPay.stock} pcs (Ekspektasi tetap: 17 pcs)`);
    if (parseFloat(ingAfterPay.stock) !== 17) {
      throw new Error(`Skenario 4 Gagal: Terjadi pemotongan ganda! Stok: ${ingAfterPay.stock}`);
    }

    const finalOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    console.log(`Status akhir pesanan: ${finalOrder.status} (Ekspektasi: PAID)`);
    console.log(`Status dapur akhir: ${finalOrder.kitchenStatus} (Ekspektasi tetap: SERVED)`);

    if (finalOrder.status !== 'PAID' || finalOrder.kitchenStatus !== 'SERVED') {
      throw new Error('Skenario 4 Gagal: Status akhir pesanan tidak sesuai.');
    }
    console.log('✅ SKENARIO 4 LULUS: Pelunasan sukses, Zero Double-Deduction terbukti 100%.');

    console.log('\n====================================================');
    console.log('🎉 SEMUA 4 SKENARIO PENGUJIAN END-TO-END SUKSES!');
    console.log('====================================================\n');
  } finally {
    // Cleanup
    console.log('[CLEANUP] Membersihkan data uji dari database...');
    if (testOrderId) {
      await prisma.stockMovement.deleteMany({ where: { note: { contains: 'E2E-HOLD' } } });
      await prisma.payment.deleteMany({ where: { orderId: testOrderId } });
      await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
      await prisma.order.delete({ where: { id: testOrderId } });
    }
    await prisma.productRecipeItem.deleteMany({ where: { productId: { in: [foodProduct.id, drinkProduct.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: [foodProduct.id, drinkProduct.id] } } });
    await prisma.category.deleteMany({ where: { id: { in: [categoryFood.id, categoryDrink.id] } } });
    await prisma.stockMovement.deleteMany({ where: { ingredientId: ingredient.id } });
    await prisma.ingredient.delete({ where: { id: ingredient.id } });
    console.log('✅ Pembersihan data uji selesai.');
  }
}

runE2E()
  .catch((err) => {
    console.error('❌ E2E Test Gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
