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
      name: 'Doni Aritonang',
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
      name: 'Risma Br Ginting',
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
      name: 'Mail Sudarsono',
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
      name: 'Putri Handayani',
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
      name: 'Indra Siregar',
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
  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        sortOrder: cat.sortOrder,
      },
    });
  }
  console.log(`✅ Categories seeded successfully (${categoriesData.length} categories)`);

  // 4. Seed Ingredients
  const ingredientMap = new Map();
  for (const ing of ingredientsData) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: ing.name },
    });
    let saved;
    if (existing) {
      saved = await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          unit: ing.unit,
          stock: ing.stock,
          minStock: ing.minStock,
          costPerUnit: ing.costPerUnit,
        },
      });
    } else {
      saved = await prisma.ingredient.create({
        data: {
          name: ing.name,
          unit: ing.unit,
          stock: ing.stock,
          minStock: ing.minStock,
          costPerUnit: ing.costPerUnit,
        },
      });
    }
    ingredientMap.set(saved.name, saved.id);
  }
  console.log(`✅ Ingredients seeded successfully (${ingredientsData.length} ingredients)`);

  // 5. Seed / Link Recipes (BOM) for Products
  let linkedCount = 0;
  for (const prodData of productsData) {
    if (!prodData.recipe || prodData.recipe.length === 0) continue;
    const product = await prisma.product.findFirst({
      where: { name: prodData.name },
    });
    if (product) {
      await prisma.productRecipeItem.deleteMany({
        where: { productId: product.id },
      });
      for (const item of prodData.recipe) {
        const ingId = ingredientMap.get(item.ingredientName);
        if (ingId) {
          await prisma.productRecipeItem.create({
            data: {
              productId: product.id,
              ingredientId: ingId,
              quantity: item.quantity,
            },
          });
        }
      }
      linkedCount++;
    }
  }
  console.log(`✅ Linked BOM recipes for ${linkedCount} products`);

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
