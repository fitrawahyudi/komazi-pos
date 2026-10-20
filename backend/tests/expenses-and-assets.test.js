import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { expenseService } from '../src/services/expenseService.js';
import { assetService } from '../src/services/assetService.js';
import { depreciationService } from '../src/services/depreciationService.js';
import { profitService } from '../src/services/profitService.js';

test('Financial Modules: Expenses, Assets, and Depreciation', async (t) => {
  // Ambil owner user untuk context pengujian
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  assert.ok(owner, 'Owner user must exist in test database');

  const categories = await expenseService.getCategories();
  assert.ok(categories.length > 0, 'Categories must be seeded');
  const cat = categories[0];

  let testExpenseId = null;
  let testAssetId = null;

  await t.test('1. Expenses: Validation & Creation', async () => {
    // A. Reject non-positive amount
    await assert.rejects(
      async () => {
        await expenseService.createExpense(
          {
            categoryId: cat.id,
            description: 'Biaya minus',
            amount: -50000,
          },
          owner.id
        );
      },
      /Nominal biaya harus lebih besar dari 0/,
      'Must reject negative amount'
    );

    // B. Reject invalid category
    await assert.rejects(
      async () => {
        await expenseService.createExpense(
          {
            categoryId: 999999,
            description: 'Biaya kategori fiktif',
            amount: 50000,
          },
          owner.id
        );
      },
      /Kategori biaya tidak ditemukan/,
      'Must reject non-existent category'
    );

    // C. Valid Expense Creation
    const created = await expenseService.createExpense(
      {
        categoryId: cat.id,
        description: 'Pembelian tissue & detergen uji',
        amount: 75000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        sourceType: 'TEST',
        sourceRef: 'REF-TEST-001',
      },
      owner.id
    );

    assert.ok(created.id, 'Expense ID generated');
    assert.match(created.referenceNo, /^EXP-\d{6}-\d{4}$/, 'Reference number format matches EXP-YYYYMM-XXXX');
    assert.equal(created.amount, 75000);
    testExpenseId = created.id;

    // D. Duplicate sourceRef rejection
    await assert.rejects(
      async () => {
        await expenseService.createExpense(
          {
            categoryId: cat.id,
            description: 'Duplikasi ref',
            amount: 75000,
            sourceRef: 'REF-TEST-001',
          },
          owner.id
        );
      },
      /sudah pernah dicatat/,
      'Must reject duplicate sourceRef'
    );
  });

  await t.test('2. Expenses: Cancellation & Audit', async () => {
    assert.ok(testExpenseId);
    const cancelled = await expenseService.cancelExpense(
      testExpenseId,
      'Koreksi nota salah input oleh kasir',
      owner.id
    );

    assert.equal(cancelled.isCancelled, true);
    assert.equal(cancelled.cancelledReason, 'Koreksi nota salah input oleh kasir');

    // Cek audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'EXPENSE_CANCEL',
        userId: owner.id,
      },
      orderBy: { id: 'desc' },
    });
    assert.ok(audit, 'Audit log for EXPENSE_CANCEL recorded');
  });

  await t.test('3. Fixed Assets: Validation & Creation', async () => {
    // A. Reject residual value > purchase price
    await assert.rejects(
      async () => {
        await assetService.createAsset(
          {
            name: 'Mesin Gagal',
            purchasePrice: 1000000,
            residualValue: 1500000,
            usefulLifeMonths: 12,
          },
          owner.id
        );
      },
      /Nilai residu tidak boleh melebihi harga perolehan/
    );

    // B. Reject usefulLifeMonths <= 0
    await assert.rejects(
      async () => {
        await assetService.createAsset(
          {
            name: 'Mesin Umur Nol',
            purchasePrice: 1000000,
            residualValue: 100000,
            usefulLifeMonths: 0,
          },
          owner.id
        );
      },
      /Umur manfaat aset harus lebih besar dari 0/
    );

    // C. Valid Asset Creation (Straight Line)
    // Harga perolehan: 12.000.000, Residu: 1.200.000, Masa: 60 bulan -> Rp180.000/bln
    const asset = await assetService.createAsset(
      {
        name: 'Mesin Espresso La Marzocco Test',
        category: 'Peralatan Bar & Kopi',
        purchasePrice: 12000000,
        residualValue: 1200000,
        usefulLifeMonths: 60,
        startDate: new Date('2026-01-01'),
        purchaseDate: new Date('2026-01-01'),
        location: 'Station Barista',
      },
      owner.id
    );

    assert.ok(asset.id);
    assert.match(asset.code, /^AST-\d{4}$/);
    assert.equal(asset.bookValue, 12000000);
    assert.equal(asset.accumulatedDepreciation, 0);
    testAssetId = asset.id;
  });

  await t.test('4. Fixed Assets: Depreciation Schedule Projection', async () => {
    assert.ok(testAssetId);
    const scheduleData = await assetService.getDepreciationSchedule(testAssetId);
    assert.equal(scheduleData.schedule.length, 60, 'Should have 60 months schedule');
    assert.equal(scheduleData.schedule[0].depreciationAmount, 180000, 'Monthly depreciation should be 180.000');
    assert.equal(
      scheduleData.schedule[59].closingBookValue,
      1200000,
      'Final book value must equal residual value'
    );
  });

  await t.test('5. Monthly Depreciation: Preview & Idempotent Processing', async () => {
    const preview = await depreciationService.previewDepreciation({ year: 2026, month: 1 });
    assert.ok(preview.eligibleCount > 0, 'Eligible assets found');

    const result1 = await depreciationService.processDepreciation(
      { year: 2026, month: 1, notes: 'Uji penyusutan batch 1' },
      owner.id
    );

    assert.ok(result1.processedCount > 0);
    assert.ok(result1.totalAmount > 0);

    // Idempotency: eksekusi ulang periode yang sama TIDAK boleh menduplikasi beban
    const result2 = await depreciationService.processDepreciation(
      { year: 2026, month: 1, notes: 'Uji eksekusi ulang idempoten' },
      owner.id
    );

    assert.equal(
      result2.processedCount,
      0,
      'Re-running same month must process 0 items due to idempotency'
    );
  });

  await t.test('6. P&L Integration: Reports Include Expenses & Depreciation', async () => {
    const pnl = await profitService.calculateProfitAndLoss({ period: 'today' });
    assert.ok(pnl.summary.expenses, 'Expenses section exists in P&L');
    assert.equal(typeof pnl.summary.expenses.operationalExpenses, 'number');
    assert.equal(typeof pnl.summary.expenses.depreciationCost, 'number');
    assert.equal(typeof pnl.summary.expenses.totalOperatingExpenses, 'number');
    assert.ok(pnl.breakdowns.expensesByCategory, 'Expenses by category breakdown exists');
    assert.ok(pnl.breakdowns.depreciationsByAsset, 'Depreciations by asset breakdown exists');
  });

  // Cleanup data uji
  if (testExpenseId) {
    await prisma.expense.delete({ where: { id: testExpenseId } }).catch(() => {});
  }
  if (testAssetId) {
    await prisma.assetDepreciation.deleteMany({ where: { assetId: testAssetId } }).catch(() => {});
    await prisma.fixedAsset.delete({ where: { id: testAssetId } }).catch(() => {});
  }
});
