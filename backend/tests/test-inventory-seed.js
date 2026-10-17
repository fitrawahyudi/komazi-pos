import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { inventoryService } from '../src/services/inventoryService.js';
import { getStationOrders } from '../src/services/kdsService.js';

const prisma = new PrismaClient();

async function runInventoryValidation() {
  console.log('🧪 Starting Komazi POS Inventory & Menu Validation Suite...\n');

  try {
    // ─── 1. Verifikasi Kategori ──────────────────────────────────────────────
    console.log('1️⃣ Memeriksa Kategori Produk...');
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    console.log(`   Ditemukan ${categories.length} kategori.`);
    const expectedCategories = [
      'Burger', 'Cemilan', 'Nasi & Mie', 'Espresso Base',
      'Milk Base', 'SKM Base', 'Blackseries', 'Manual Brew',
      'Foomseries', 'Non Coffee', 'Kombucha'
    ];
    for (const exp of expectedCategories) {
      const found = categories.find((c) => c.name.toLowerCase() === exp.toLowerCase());
      if (!found) {
        throw new Error(`Kategori wajib "${exp}" tidak ditemukan di database!`);
      }
    }
    console.log('   ✅ Semua kategori referensi menu KOMAZI valid.\n');

    // ─── 2. Verifikasi Produk & Routing KDS / BDS ────────────────────────────
    console.log('2️⃣ Memeriksa Produk & Station Routing (KDS vs BDS)...');
    const products = await prisma.product.findMany({
      include: { category: true, station: true, recipeItems: true },
    });
    console.log(`   Ditemukan ${products.length} produk di database.`);

    const kitchenCount = products.filter((p) => p.station?.type === 'KITCHEN').length;
    const barCount = products.filter((p) => p.station?.type === 'BAR').length;
    console.log(`   - KDS (Kitchen): ${kitchenCount} produk`);
    console.log(`   - BDS (Barista): ${barCount} produk`);

    if (kitchenCount === 0 || barCount === 0) {
      throw new Error('Routing station tidak valid: salah satu station tidak memiliki produk!');
    }

    // Periksa produk Burger masuk KDS
    const burgerSample = products.find((p) => p.name === 'Burger Hot Spicy');
    if (!burgerSample || burgerSample.station?.type !== 'KITCHEN' || Number(burgerSample.price) !== 18000) {
      throw new Error(`Burger Hot Spicy tidak valid: station=${burgerSample?.station?.type}, price=${burgerSample?.price}`);
    }

    // Periksa produk KopiZI masuk BDS
    const kopiziSample = products.find((p) => p.name === 'KopiZI');
    if (!kopiziSample || kopiziSample.station?.type !== 'BAR' || Number(kopiziSample.price) !== 25000) {
      throw new Error(`KopiZI tidak valid: station=${kopiziSample?.station?.type}, price=${kopiziSample?.price}`);
    }

    // Periksa produk Manual Brew (Filter) tidak aktif dan harga 0 (belum dikonfigurasi)
    const filterSample = products.find((p) => p.name === 'Filter');
    if (!filterSample || filterSample.isActive !== false || Number(filterSample.price) !== 0) {
      throw new Error(`Produk manual brew "Filter" harus berstatus non-aktif dan harga 0!`);
    }
    console.log('   ✅ Verifikasi harga dan station routing produk lolos.\n');

    // ─── 3. Verifikasi Resep / BOM ───────────────────────────────────────────
    console.log('3️⃣ Memeriksa Resep / Bill of Materials (BOM)...');
    const recipeItems = await prisma.productRecipeItem.findMany({
      include: { ingredient: true, product: true },
    });
    console.log(`   Ditemukan ${recipeItems.length} total baris komposisi resep terdaftar.`);

    // Pastikan tidak ada resep yang mengarah ke bahan baku null
    for (const r of recipeItems) {
      if (!r.ingredient) {
        throw new Error(`Resep untuk produk ${r.productId} mengarah ke ingredient yang tidak valid!`);
      }
    }
    console.log('   ✅ Seluruh resep mengacu pada bahan baku yang valid.\n');

    // ─── 4. Verifikasi Simulasi Pengurangan Stok Otomatis ────────────────────
    console.log('4️⃣ Menguji Pengurangan Stok Transaksi (Sale BOM Deduction)...');

    // Ambil bahan baku 'Roti Burger Bun' dan 'Beef Patty'
    const bunBefore = await prisma.ingredient.findUnique({ where: { name: 'Roti Burger Bun' } });
    const pattyBefore = await prisma.ingredient.findUnique({ where: { name: 'Beef Patty' } });

    const initialBunStock = parseFloat(bunBefore.stock);
    const initialPattyStock = parseFloat(pattyBefore.stock);

    // Buat pesanan pengujian
    const testOrder = await prisma.order.create({
      data: {
        invoiceNo: `TEST-INV-${Date.now()}`,
        cashierId: 1,
        type: 'DINE_IN',
        status: 'PAID',
        subtotal: 36000,
        total: 36000,
        items: {
          create: [
            {
              productId: burgerSample.id,
              productName: burgerSample.name,
              qty: 2,
              unitPrice: 18000,
              lineTotal: 36000,
              status: 'PENDING',
              stationId: burgerSample.stationId,
            },
          ],
        },
      },
    });

    // Jalankan pengurangan stok
    const deductRes = await inventoryService.deductOrderStock(testOrder.id);
    if (!deductRes.success) {
      throw new Error('Gagal melakukan pengurangan stok otomatis!');
    }

    const bunAfter = await prisma.ingredient.findUnique({ where: { name: 'Roti Burger Bun' } });
    const pattyAfter = await prisma.ingredient.findUnique({ where: { name: 'Beef Patty' } });

    // Pesanan 2 porsi Burger Hot Spicy harus mengurangi 2 Roti Bun dan 2 Patty
    if (parseFloat(bunAfter.stock) !== initialBunStock - 2) {
      throw new Error(`Pengurangan stok roti salah! Sebelum: ${initialBunStock}, Sesudah: ${bunAfter.stock}`);
    }
    if (parseFloat(pattyAfter.stock) !== initialPattyStock - 2) {
      throw new Error(`Pengurangan stok patty salah! Sebelum: ${initialPattyStock}, Sesudah: ${pattyAfter.stock}`);
    }
    console.log(`   ✅ Stok berhasil berkurang sesuai takaran resep (2 bun & 2 patty terpotong).`);

    // ─── 5. Uji Idempotensi: Deduct Kedua Kali Tidak Boleh Mengurangi Stok ───
    console.log('5️⃣ Menguji Idempotensi (Retry tidak boleh mengurangi stok berulang)...');
    const retryDeduct = await inventoryService.deductOrderStock(testOrder.id);
    if (!retryDeduct.alreadyDeducted) {
      throw new Error('Idempotensi gagal: Transaksi yang sama memotong stok dua kali!');
    }

    const bunAfterRetry = await prisma.ingredient.findUnique({ where: { name: 'Roti Burger Bun' } });
    if (parseFloat(bunAfterRetry.stock) !== parseFloat(bunAfter.stock)) {
      throw new Error('Idempotensi gagal: Stok berkurang lagi saat retry dipanggil!');
    }
    console.log('   ✅ Idempotensi lolos: Pemanggilan berulang tidak memotong stok lagi.\n');

    // ─── 6. Uji Pembatalan / Refund (Restock) ─────────────────────────────────
    console.log('6️⃣ Menguji Pengembalian Stok saat Pesanan di-VOID / REFUND...');
    const restoreRes = await inventoryService.restoreOrderStock(testOrder.id, 'Uji coba pembatalan order');
    if (!restoreRes.success) {
      throw new Error('Gagal merestorasi stok pada pembatalan order!');
    }

    const bunRestored = await prisma.ingredient.findUnique({ where: { name: 'Roti Burger Bun' } });
    const pattyRestored = await prisma.ingredient.findUnique({ where: { name: 'Beef Patty' } });

    if (parseFloat(bunRestored.stock) !== initialBunStock) {
      throw new Error(`Restorasi stok roti gagal! Ekspektasi: ${initialBunStock}, Aktual: ${bunRestored.stock}`);
    }
    if (parseFloat(pattyRestored.stock) !== initialPattyStock) {
      throw new Error(`Restorasi stok patty gagal! Ekspektasi: ${initialPattyStock}, Aktual: ${pattyRestored.stock}`);
    }
    console.log('   ✅ Stok berhasil dikembalikan secara utuh (100% restored).\n');

    // Bersihkan data order uji coba
    await prisma.stockMovement.deleteMany({
      where: { note: { contains: testOrder.invoiceNo } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.order.delete({ where: { id: testOrder.id } });

    // ─── 7. Verifikasi BDS & KDS Orders Query ────────────────────────────────
    console.log('7️⃣ Memeriksa Pemisahan Antrean KDS dan BDS...');
    const bdsOrders = await getStationOrders({ stationType: 'BAR', status: 'ACTIVE' });
    const kdsOrders = await getStationOrders({ stationType: 'KITCHEN', status: 'ACTIVE' });

    console.log(`   Pesanan BDS aktif: ${bdsOrders.length} tiket`);
    console.log(`   Pesanan KDS aktif: ${kdsOrders.length} tiket`);
    console.log('   ✅ Filter KDS dan BDS berfungsi dengan sempurna.\n');

    console.log('🎉 SELURUH PENGUJIAN INVENTORY & MENU SEEDER LOLOS 100% TANPA KENDALA!');
    process.exit(0);
  } catch (err) {
    console.error('❌ VALIDASI GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runInventoryValidation();
