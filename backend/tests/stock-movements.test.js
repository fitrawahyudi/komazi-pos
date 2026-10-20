import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { stockService } from '../src/services/stock.service.js';

test('Stock Movements Service & Log Suite', async (t) => {
  await prisma.$connect();

  let testIngredient = null;
  let createdMovements = [];

  await t.test('1. Setup: Create test ingredient and multiple movements', async () => {
    testIngredient = await prisma.ingredient.create({
      data: {
        name: `Test Bahan Mutasi ${Date.now()}`,
        unit: 'kg',
        stock: 10,
        minStock: 2,
        costPerUnit: 50000,
      },
    });

    assert.ok(testIngredient.id, 'Test ingredient should have an ID');

    // Create 4 distinct movement types
    const m1 = await prisma.stockMovement.create({
      data: {
        ingredientId: testIngredient.id,
        type: 'PURCHASE',
        qty: 15,
        unitCost: 50000,
        totalCost: 750000,
        note: 'Restok Supplier Aji',
        recordedBy: 'Owner Budi',
      },
    });

    const m2 = await prisma.stockMovement.create({
      data: {
        ingredientId: testIngredient.id,
        type: 'WASTE',
        qty: -2,
        unitCost: 50000,
        totalCost: 100000,
        note: 'Kalibrasi Grinder Pagi',
        recordedBy: 'Barista Siti',
      },
    });

    const m3 = await prisma.stockMovement.create({
      data: {
        ingredientId: testIngredient.id,
        type: 'SALE',
        qty: 3,
        unitCost: 50000,
        totalCost: 150000,
        note: 'Sale: Order #KMZ-9988',
        recordedBy: 'POS Kasir',
      },
    });

    const m4 = await prisma.stockMovement.create({
      data: {
        ingredientId: testIngredient.id,
        type: 'ADJUSTMENT',
        qty: -1,
        unitCost: 50000,
        totalCost: 50000,
        note: 'Stok Opname Selisih Fisik',
        recordedBy: 'Manager Doni',
      },
    });

    createdMovements = [m1, m2, m3, m4];
    assert.equal(createdMovements.length, 4, 'Should have created 4 test movements');
  });

  await t.test('2. getMovements: Retrieves all movements for ingredient with relation populated', async () => {
    const result = await stockService.getMovements({
      ingredientId: testIngredient.id,
      page: 1,
      limit: 10,
    });

    assert.ok(result.items, 'Items should exist');
    assert.equal(result.items.length, 4, 'Should return all 4 movements for this ingredient');
    assert.equal(result.meta.total, 4, 'Total in meta should be 4');
    assert.equal(result.meta.page, 1, 'Current page should be 1');

    // Verify ingredient relation is populated
    const first = result.items[0];
    assert.ok(first.ingredient, 'Ingredient relation must be loaded');
    assert.equal(first.ingredient.name, testIngredient.name);
    assert.equal(first.ingredient.unit, 'kg');
  });

  await t.test('3. getMovements: Filters correctly by movement type', async () => {
    const purchaseResult = await stockService.getMovements({
      ingredientId: testIngredient.id,
      type: 'PURCHASE',
    });
    assert.equal(purchaseResult.items.length, 1);
    assert.equal(purchaseResult.items[0].type, 'PURCHASE');
    assert.equal(purchaseResult.items[0].note, 'Restok Supplier Aji');

    const wasteResult = await stockService.getMovements({
      ingredientId: testIngredient.id,
      type: 'WASTE',
    });
    assert.equal(wasteResult.items.length, 1);
    assert.equal(wasteResult.items[0].type, 'WASTE');
    assert.equal(wasteResult.items[0].recordedBy, 'Barista Siti');

    const saleResult = await stockService.getMovements({
      ingredientId: testIngredient.id,
      type: 'SALE',
    });
    assert.equal(saleResult.items.length, 1);
    assert.equal(saleResult.items[0].type, 'SALE');

    const adjResult = await stockService.getMovements({
      ingredientId: testIngredient.id,
      type: 'ADJUSTMENT',
    });
    assert.equal(adjResult.items.length, 1);
    assert.equal(adjResult.items[0].type, 'ADJUSTMENT');
  });

  await t.test('4. getMovements: Search query matches note and recordedBy', async () => {
    const searchAji = await stockService.getMovements({
      ingredientId: testIngredient.id,
      search: 'Supplier Aji',
    });
    assert.equal(searchAji.items.length, 1);
    assert.equal(searchAji.items[0].type, 'PURCHASE');

    const searchBarista = await stockService.getMovements({
      ingredientId: testIngredient.id,
      search: 'Siti',
    });
    assert.equal(searchBarista.items.length, 1);
    assert.equal(searchBarista.items[0].type, 'WASTE');
  });

  await t.test('5. getMovements: Pagination correctly slices items', async () => {
    const page1 = await stockService.getMovements({
      ingredientId: testIngredient.id,
      page: 1,
      limit: 2,
    });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.meta.totalPages, 2);
    assert.equal(page1.meta.total, 4);

    const page2 = await stockService.getMovements({
      ingredientId: testIngredient.id,
      page: 2,
      limit: 2,
    });
    assert.equal(page2.items.length, 2);
    assert.equal(page2.meta.page, 2);

    // Verify page1 and page2 items are distinct
    const idsPage1 = page1.items.map((i) => i.id);
    const idsPage2 = page2.items.map((i) => i.id);
    for (const id of idsPage1) {
      assert.ok(!idsPage2.includes(id), `Item ID ${id} should not appear on both pages`);
    }
  });

  await t.test('6. Cleanup: Remove test data cleanly', async () => {
    if (testIngredient?.id) {
      await prisma.stockMovement.deleteMany({
        where: { ingredientId: testIngredient.id },
      });
      await prisma.ingredient.delete({
        where: { id: testIngredient.id },
      });
    }
    await prisma.$disconnect();
  });
});
