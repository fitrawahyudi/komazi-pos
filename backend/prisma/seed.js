import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { categoriesData, ingredientsData, productsData } from './data/menuSeedData.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed for Komazi POS & Inventory...');

  // 1. Seed Users
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      name: 'Budi Santoso (Owner)',
      username: 'owner',
      password: hashedPassword,
      role: 'OWNER',
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      name: 'Dewi Lestari (Manager)',
      username: 'manager',
      password: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {},
    create: {
      name: 'Ridho Mckinnon (Kasir)',
      username: 'kasir',
      password: hashedPassword,
      role: 'CASHIER',
      isActive: true,
    },
  });

  const barista = await prisma.user.upsert({
    where: { username: 'barista' },
    update: {},
    create: {
      name: 'Bima Barista (Bar)',
      username: 'barista',
      password: hashedPassword,
      role: 'BARISTA',
      isActive: true,
    },
  });

  const kitchen = await prisma.user.upsert({
    where: { username: 'dapur' },
    update: {},
    create: {
      name: 'Chef Juna (Dapur)',
      username: 'dapur',
      password: hashedPassword,
      role: 'KITCHEN',
      isActive: true,
    },
  });

  console.log('✅ Users seeded successfully:', {
    owner: owner.username,
    manager: manager.username,
    cashier: cashier.username,
    barista: barista.username,
    kitchen: kitchen.username,
  });

  // 2. Seed Stations (KDS & BDS)
  const kitchenStation = await prisma.station.upsert({
    where: { code: 'KITCHEN_MAIN' },
    update: { name: 'Kitchen Utama', type: 'KITCHEN', isActive: true },
    create: {
      name: 'Kitchen Utama',
      code: 'KITCHEN_MAIN',
      type: 'KITCHEN',
      isActive: true,
    },
  });

  const barStation = await prisma.station.upsert({
    where: { code: 'BAR_MAIN' },
    update: { name: 'Bar Utama', type: 'BAR', isActive: true },
    create: {
      name: 'Bar Utama',
      code: 'BAR_MAIN',
      type: 'BAR',
      isActive: true,
    },
  });

  console.log('✅ Stations seeded: KITCHEN_MAIN & BAR_MAIN');

  // 3. Seed Categories
  const categoryMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
    categoryMap[cat.name] = created;
  }
  console.log(`✅ ${Object.keys(categoryMap).length} Categories seeded`);

  // 4. Seed Raw Material Ingredients (with opening balance ledger idempotency)
  const ingredientMap = {};
  let newIngredientsCount = 0;
  for (const ing of ingredientsData) {
    const existing = await prisma.ingredient.findUnique({
      where: { name: ing.name },
    });

    let record;
    if (!existing) {
      record = await prisma.ingredient.create({
        data: {
          name: ing.name,
          unit: ing.unit,
          stock: ing.stock,
          minStock: ing.minStock,
          costPerUnit: ing.costPerUnit,
        },
      });

      // Catat opening stock movement (PURCHASE) hanya saat bahan pertama kali dibuat
      await prisma.stockMovement.create({
        data: {
          ingredientId: record.id,
          type: 'PURCHASE',
          qty: ing.stock,
          unitCost: ing.costPerUnit,
          totalCost: parseFloat(ing.stock) * parseFloat(ing.costPerUnit),
          note: 'Opening Stock Balance (Initial Seed)',
        },
      });
      newIngredientsCount++;
    } else {
      // Pertahankan stock aktual, hanya update metadata satuan, minStock, dan HPP jika ada
      record = await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          unit: ing.unit,
          minStock: ing.minStock,
          costPerUnit: ing.costPerUnit,
        },
      });
    }
    ingredientMap[ing.name] = record;
  }
  console.log(`✅ ${Object.keys(ingredientMap).length} Ingredients seeded (${newIngredientsCount} new with opening movements)`);

  // 5. Seed Products & BOM Recipes
  let productsCount = 0;
  let recipesCount = 0;

  for (const prod of productsData) {
    const category = categoryMap[prod.categoryName];
    if (!category) {
      console.warn(`[Seed Warning] Category "${prod.categoryName}" not found for product "${prod.name}"`);
      continue;
    }

    const targetStation = prod.stationCode === 'BAR_MAIN' ? barStation : kitchenStation;

    const existingProduct = await prisma.product.findUnique({
      where: { sku: prod.sku },
      include: { variants: true },
    });

    let product;
    if (!existingProduct) {
      product = await prisma.product.create({
        data: {
          categoryId: category.id,
          stationId: targetStation.id,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          imageUrl: prod.imageUrl || null,
          description: prod.description || null,
          modifiers: prod.modifiers || null,
          isActive: prod.isActive !== undefined ? prod.isActive : true,
          variants: prod.variants && prod.variants.length > 0 ? {
            create: prod.variants.map((v) => ({
              name: v.name,
              extraPrice: v.extraPrice || 0,
            })),
          } : undefined,
        },
      });
      productsCount++;
    } else {
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          categoryId: category.id,
          stationId: targetStation.id,
          name: prod.name,
          price: prod.price,
          imageUrl: prod.imageUrl || existingProduct.imageUrl,
          description: prod.description || existingProduct.description,
          modifiers: prod.modifiers !== undefined ? prod.modifiers : existingProduct.modifiers,
          isActive: prod.isActive !== undefined ? prod.isActive : existingProduct.isActive,
        },
      });

      // Update / insert variants if specified and not present
      if (prod.variants && prod.variants.length > 0) {
        for (const v of prod.variants) {
          const varExist = await prisma.productVariant.findFirst({
            where: { productId: product.id, name: v.name },
          });
          if (!varExist) {
            await prisma.productVariant.create({
              data: {
                productId: product.id,
                name: v.name,
                extraPrice: v.extraPrice || 0,
              },
            });
          }
        }
      }
    }

    // Seed / Update BOM Recipes (ProductRecipeItem)
    if (prod.recipe && prod.recipe.length > 0) {
      await prisma.productRecipeItem.deleteMany({
        where: { productId: product.id, variantId: null },
      });

      for (const r of prod.recipe) {
        const ingredient = ingredientMap[r.ingredientName];
        if (ingredient) {
          await prisma.productRecipeItem.create({
            data: {
              productId: product.id,
              variantId: null,
              ingredientId: ingredient.id,
              quantity: r.quantity,
            },
          });
          recipesCount++;
        } else {
          console.warn(`[Seed Warning] Ingredient "${r.ingredientName}" not found for recipe of "${prod.name}"`);
        }
      }
    }
  }

  console.log(`✅ Products seeded/verified (${productsData.length} total products, ${recipesCount} recipe items mapped)`);

  // 6. Seed Workspace Areas
  const areasData = [
    { name: 'Meja Komunal 01', capacity: 1 },
    { name: 'Meja Komunal 02', capacity: 1 },
    { name: 'Meja Komunal 03', capacity: 1 },
    { name: 'Meja Komunal 04', capacity: 1 },
    { name: 'Focus Pod Alpha', capacity: 2 },
    { name: 'Focus Pod Beta', capacity: 2 },
    { name: 'Meeting Room Alpha', capacity: 6 },
    { name: 'Lounge Sofa Area', capacity: 4 },
  ];

  for (const area of areasData) {
    await prisma.workspaceArea.upsert({
      where: { name: area.name },
      update: {},
      create: area,
    });
  }
  console.log('✅ Workspace Areas seeded');

  // 7. Seed Workspace Packages
  const packagesData = [
    { name: '1 Jam Fokus', durationMin: 60, price: 20000, overtimePerHr: 15000 },
    { name: '3 Jam Komazi Flow', durationMin: 180, price: 50000, overtimePerHr: 15000 },
    { name: 'Full Day Pass (Harian)', durationMin: 600, price: 85000, overtimePerHr: 0 },
    { name: 'Meeting Room (Per Jam)', durationMin: 60, price: 75000, overtimePerHr: 75000 },
  ];

  for (const pkg of packagesData) {
    const existing = await prisma.workspacePackage.findFirst({ where: { name: pkg.name } });
    if (!existing) {
      await prisma.workspacePackage.create({ data: pkg });
    }
  }
  console.log('✅ Workspace Packages seeded');

  // 8. Seed Store Settings
  const settingsData = [
    { key: 'storeName', value: 'KOMAZI Coffee & Workspace' },
    { key: 'storeTagline', value: 'Coffee & Collaborative Workspace' },
    { key: 'address', value: 'Jl. Diponegoro No. 42, Medan Petisah, Kota Medan' },
    { key: 'phone', value: '0812-6899-7721' },
    { key: 'wifiName', value: 'KOMAZI_HIGH_SPEED' },
    { key: 'wifiPass', value: 'kopikomazi2026' },
    { key: 'receiptFooter', value: 'Terima kasih atas kunjungan Anda!\nFollow IG: @komazi.coffee' },
    { key: 'taxPercentage', value: '10' },
    { key: 'taxEnabled', value: 'true' },
    { key: 'serviceFeePercentage', value: '5' },
    { key: 'serviceFeeEnabled', value: 'true' },
    { key: 'currency', value: 'IDR' },
    { key: 'roundingEnabled', value: 'true' },
    { key: 'attendanceGeofenceEnabled', value: 'true' },
    { key: 'outletLatitude', value: '3.598804' },
    { key: 'outletLongitude', value: '98.7311898' },
    { key: 'attendanceRadiusMeters', value: '100' },
    { key: 'attendanceSelfieRequired', value: 'true' },
  ];

  for (const s of settingsData) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('✅ Settings seeded');

  // 9. Seed Sample Customers & Loyalty Members
  const sampleCustomers = [
    {
      name: 'Budi Santoso',
      phone: '081234567890',
      email: 'budi.santoso@gmail.com',
      notes: 'Pelanggan tetap area VIP & suka Es Kopi Susu Aren Gula Sedang',
      points: 640,
      tier: 'PLATINUM',
      totalSpent: 6400000,
      visitCount: 42,
    },
    {
      name: 'Siti Rahmawati',
      phone: '082198765432',
      email: 'siti.rahma@yahoo.com',
      notes: 'Member Workspace Flow 3 Jam, langganan Cafe Latte',
      points: 280,
      tier: 'GOLD',
      totalSpent: 2800000,
      visitCount: 19,
    },
    {
      name: 'Andi Wijaya',
      phone: '085611223344',
      email: 'andi.wijaya99@gmail.com',
      notes: 'Mahasiswa, sering pakai promo weekday',
      points: 45,
      tier: 'SILVER',
      totalSpent: 450000,
      visitCount: 4,
    },
    {
      name: 'Jessica Tan',
      phone: '081399887766',
      email: 'jessica.tan@techstartup.id',
      notes: 'Founder startup, rutin booking Meeting Room',
      points: 520,
      tier: 'PLATINUM',
      totalSpent: 5200000,
      visitCount: 26,
    },
  ];

  for (const c of sampleCustomers) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    });
  }
  console.log('✅ Customers & Loyalty Members seeded');

  // 10. Seed Default Printer Profiles
  const existingPrinter = await prisma.printerProfile.findFirst();
  if (!existingPrinter) {
    await prisma.printerProfile.createMany({
      data: [
        {
          name: 'Printer Kasir Thermal (Default)',
          role: 'RECEIPT',
          connectionType: 'BLUETOOTH_CLASSIC',
          deviceIdentifier: 'POS-58-BT',
          paperWidthMm: 58,
          isDefaultReceipt: true,
          isDefaultKitchen: false,
          isActive: true,
          copies: 1,
          autoCut: true,
          openCashDrawer: false,
          buzzer: false,
        },
        {
          name: 'Printer Dapur & Bar',
          role: 'KITCHEN',
          connectionType: 'BLUETOOTH_CLASSIC',
          deviceIdentifier: 'KITCHEN-PRINTER-80',
          paperWidthMm: 80,
          isDefaultReceipt: false,
          isDefaultKitchen: true,
          isActive: true,
          copies: 1,
          autoCut: true,
          openCashDrawer: false,
          buzzer: true,
        },
      ],
    });
    console.log('✅ Printer Profiles seeded');
  }

  console.log('🎉 Komazi POS database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
