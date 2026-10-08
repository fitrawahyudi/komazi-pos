import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Komazi POS...');

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

  console.log('✅ Users seeded:', {
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
  const categoriesData = [
    { name: 'Kopi', sortOrder: 1 },
    { name: 'Non-Kopi', sortOrder: 2 },
    { name: 'Makanan', sortOrder: 3 },
    { name: 'Snack & Pastry', sortOrder: 4 },
  ];

  const categories = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
    categories[cat.name] = created;
  }
  console.log('✅ Categories seeded');

  // 4. Seed Products with Variants and Stations
  const productsData = [
    {
      categoryId: categories['Kopi'].id,
      sku: 'KMZ-COP-001',
      name: 'Komazi Aren Latte',
      price: 26000,
      imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
      variants: [
        { name: 'Regular (Hot)', extraPrice: 0 },
        { name: 'Large (Hot)', extraPrice: 4000 },
        { name: 'Regular (Iced)', extraPrice: 2000 },
        { name: 'Large (Iced)', extraPrice: 6000 },
      ],
    },
    {
      categoryId: categories['Kopi'].id,
      sku: 'KMZ-COP-002',
      name: 'Cafe Latte',
      price: 25000,
      imageUrl: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=500&auto=format&fit=crop&q=80',
      variants: [
        { name: 'Hot (8oz)', extraPrice: 0 },
        { name: 'Iced (16oz)', extraPrice: 3000 },
      ],
    },
    {
      categoryId: categories['Kopi'].id,
      sku: 'KMZ-COP-003',
      name: 'Americano / Long Black',
      price: 22000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
      variants: [
        { name: 'Hot', extraPrice: 0 },
        { name: 'Iced', extraPrice: 2000 },
      ],
    },
    {
      categoryId: categories['Non-Kopi'].id,
      sku: 'KMZ-NON-001',
      name: 'Uji Matcha Latte',
      price: 26000,
      imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=80',
      variants: [
        { name: 'Hot', extraPrice: 0 },
        { name: 'Iced', extraPrice: 2000 },
      ],
    },
    {
      categoryId: categories['Makanan'].id,
      sku: 'KMZ-FOD-001',
      name: 'Nasi Goreng Spesial Komazi',
      price: 34000,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80',
      variants: [],
    },
    {
      categoryId: categories['Snack & Pastry'].id,
      sku: 'KMZ-SNK-001',
      name: 'Artisan Butter Croissant',
      price: 22000,
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80',
      variants: [
        { name: 'Original Butter', extraPrice: 0 },
        { name: 'Almond Topping', extraPrice: 6000 },
      ],
    },
  ];

  for (const prod of productsData) {
    const isDrink = prod.categoryId === categories['Kopi'].id || prod.categoryId === categories['Non-Kopi'].id;
    const targetStationId = isDrink ? barStation.id : kitchenStation.id;

    const existing = await prisma.product.findFirst({ where: { sku: prod.sku } });
    if (!existing) {
      await prisma.product.create({
        data: {
          categoryId: prod.categoryId,
          stationId: targetStationId,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          imageUrl: prod.imageUrl,
          variants: {
            create: prod.variants,
          },
        },
      });
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: { stationId: targetStationId },
      });
    }
  }

  // Juga sinkronkan semua produk yang sudah ada di database ke station yang sesuai
  const allProds = await prisma.product.findMany({ include: { category: true } });
  for (const p of allProds) {
    const catName = (p.category?.name || '').toLowerCase();
    const isDrink = catName.includes('kopi') || catName.includes('drink') || catName.includes('minuman');
    await prisma.product.update({
      where: { id: p.id },
      data: { stationId: isDrink ? barStation.id : kitchenStation.id },
    });
  }
  console.log('✅ Products & Variants seeded & assigned to stations');

  // 4. Seed Workspace Areas
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

  // 5. Seed Workspace Packages
  const packagesData = [
    {
      name: '1 Jam Fokus',
      durationMin: 60,
      price: 20000,
      overtimePerHr: 15000,
    },
    {
      name: '3 Jam Komazi Flow',
      durationMin: 180,
      price: 50000,
      overtimePerHr: 15000,
    },
    {
      name: 'Full Day Pass (Harian)',
      durationMin: 600,
      price: 85000,
      overtimePerHr: 0,
    },
    {
      name: 'Meeting Room (Per Jam)',
      durationMin: 60,
      price: 75000,
      overtimePerHr: 75000,
    },
  ];

  for (const pkg of packagesData) {
    const existing = await prisma.workspacePackage.findFirst({ where: { name: pkg.name } });
    if (!existing) {
      await prisma.workspacePackage.create({ data: pkg });
    }
  }
  console.log('✅ Workspace Packages seeded');

  // 6. Seed Ingredients with costPerUnit
  const ingredientsData = [
    { name: 'Biji Kopi Arabika House Blend', unit: 'gram', stock: 8500, minStock: 3000, costPerUnit: 250 },
    { name: 'Fresh Milk Greenfields', unit: 'ml', stock: 16000, minStock: 10000, costPerUnit: 22 },
    { name: 'Oat Milk Barista Edition (Oatside)', unit: 'ml', stock: 2000, minStock: 5000, costPerUnit: 42 },
    { name: 'Gula Aren Organik Cair', unit: 'ml', stock: 4500, minStock: 2000, costPerUnit: 40 },
    { name: 'Bubuk Matcha Uji Premium', unit: 'gram', stock: 650, minStock: 300, costPerUnit: 350 },
    { name: 'Paper Cup Hot 8oz', unit: 'pcs', stock: 240, minStock: 100, costPerUnit: 850 },
    { name: 'Cold Cup & Lid 16oz', unit: 'pcs', stock: 350, minStock: 100, costPerUnit: 1200 },
  ];

  const ingredientMap = {};
  for (const ing of ingredientsData) {
    const created = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: { unit: ing.unit, stock: ing.stock, minStock: ing.minStock, costPerUnit: ing.costPerUnit },
      create: ing,
    });
    ingredientMap[ing.name] = created;
  }
  console.log('✅ Ingredients seeded with costPerUnit');

  // 6.1 Seed Product Recipes (BOM)
  const arenLatte = await prisma.product.findFirst({ where: { sku: 'KMZ-COP-001' } });
  if (arenLatte) {
    await prisma.productRecipeItem.deleteMany({ where: { productId: arenLatte.id } });
    await prisma.productRecipeItem.createMany({
      data: [
        { productId: arenLatte.id, ingredientId: ingredientMap['Biji Kopi Arabika House Blend'].id, quantity: 18 },
        { productId: arenLatte.id, ingredientId: ingredientMap['Fresh Milk Greenfields'].id, quantity: 150 },
        { productId: arenLatte.id, ingredientId: ingredientMap['Gula Aren Organik Cair'].id, quantity: 25 },
        { productId: arenLatte.id, ingredientId: ingredientMap['Cold Cup & Lid 16oz'].id, quantity: 1 },
      ],
    });
  }

  const cafeLatte = await prisma.product.findFirst({ where: { sku: 'KMZ-COP-002' } });
  if (cafeLatte) {
    await prisma.productRecipeItem.deleteMany({ where: { productId: cafeLatte.id } });
    await prisma.productRecipeItem.createMany({
      data: [
        { productId: cafeLatte.id, ingredientId: ingredientMap['Biji Kopi Arabika House Blend'].id, quantity: 18 },
        { productId: cafeLatte.id, ingredientId: ingredientMap['Fresh Milk Greenfields'].id, quantity: 180 },
        { productId: cafeLatte.id, ingredientId: ingredientMap['Paper Cup Hot 8oz'].id, quantity: 1 },
      ],
    });
  }

  const americano = await prisma.product.findFirst({ where: { sku: 'KMZ-COP-003' } });
  if (americano) {
    await prisma.productRecipeItem.deleteMany({ where: { productId: americano.id } });
    await prisma.productRecipeItem.createMany({
      data: [
        { productId: americano.id, ingredientId: ingredientMap['Biji Kopi Arabika House Blend'].id, quantity: 18 },
        { productId: americano.id, ingredientId: ingredientMap['Paper Cup Hot 8oz'].id, quantity: 1 },
      ],
    });
  }
  console.log('✅ Product Recipes (BOM) seeded');

  // 7. Seed Settings
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
  ];

  for (const s of settingsData) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('✅ Settings seeded');

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
