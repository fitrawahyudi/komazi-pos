import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchHistoricalSalesData,
  formatHistoricalSalesForPrompt,
} from '../src/services/ai/historicalSalesEngine.js';
import { buildAiSystemContext } from '../src/bot/ai/aiContextService.js';
import { parseNaturalDateQuery } from '../src/bot/utils/dateParser.js';

test('1. RBAC: Role OWNER & MANAGER can fetch historical sales data', async () => {
  const startDate = new Date(2026, 9, 27, 0, 0, 0, 0);
  const endDate = new Date(2026, 9, 27, 23, 59, 59, 999);
  const label = 'Selasa, 27 Oktober 2026';

  const resOwner = await fetchHistoricalSalesData({
    startDate,
    endDate,
    label,
    userRole: 'OWNER',
  });

  assert.equal(resOwner.isAllowed, true);
  assert.equal(resOwner.label, label);
  assert.equal(typeof resOwner.totalRevenue, 'number');
  assert.equal(typeof resOwner.totalRevenueFormatted, 'string');
  assert.equal(typeof resOwner.totalTransactions, 'number');

  const resManager = await fetchHistoricalSalesData({
    startDate,
    endDate,
    label,
    userRole: 'MANAGER',
  });
  assert.equal(resManager.isAllowed, true);
});

test('2. RBAC: Role CASHIER & BARISTA are restricted from historical revenue data', async () => {
  const startDate = new Date(2026, 9, 27, 0, 0, 0, 0);
  const endDate = new Date(2026, 9, 27, 23, 59, 59, 999);
  const label = 'Selasa, 27 Oktober 2026';

  const resCashier = await fetchHistoricalSalesData({
    startDate,
    endDate,
    label,
    userRole: 'CASHIER',
  });

  assert.equal(resCashier.isAllowed, false);
  assert.equal(resCashier.reason, 'ROLE_RESTRICTED');
  assert.equal(resCashier.role, 'CASHIER');

  const resBarista = await fetchHistoricalSalesData({
    startDate,
    endDate,
    label,
    userRole: 'BARISTA',
  });
  assert.equal(resBarista.isAllowed, false);
  assert.equal(resBarista.reason, 'ROLE_RESTRICTED');
});

test('3. Prompt Formatter: formats historical sales prompt for LLM', () => {
  // Test case A: Has sales
  const mockHistSales = {
    isAllowed: true,
    label: 'Selasa, 27 Oktober 2026',
    totalRevenueFormatted: 'Rp 450.000',
    totalTransactions: 15,
    averageBasketFormatted: 'Rp 30.000',
    hasSales: true,
    topProducts: [{ name: 'Kopi Susu Gula Aren', qty: 10 }],
    byMethod: { QRIS: 350000, CASH: 100000, TRANSFER: 0 },
  };

  const promptA = formatHistoricalSalesForPrompt(mockHistSales, 'Owner Doni');
  assert.ok(promptA.includes('DATA PENJUALAN HISTORIS YANG DIMINTA (SELASA, 27 OKTOBER 2026)'));
  assert.ok(promptA.includes('Rp 450.000'));
  assert.ok(promptA.includes('15 transaksi'));
  assert.ok(promptA.includes('Kopi Susu Gula Aren'));
  assert.ok(promptA.includes('DILARANG KERAS berdalih "Komazi belum punya datanya"'));

  // Test case B: Zero sales (store closed/no sales)
  const mockZeroSales = {
    isAllowed: true,
    label: 'Selasa, 27 Oktober 2026',
    hasSales: false,
    totalRevenueFormatted: 'Rp 0',
    totalTransactions: 0,
  };

  const promptB = formatHistoricalSalesForPrompt(mockZeroSales, 'Owner Doni');
  assert.ok(promptB.includes('Tidak ada transaksi penjualan lunas yang tercatat'));
  assert.ok(promptB.includes('DILARANG menyuruh Owner Doni mengirim foto struk'));

  // Test case C: Role restricted
  const mockRestricted = {
    isAllowed: false,
    role: 'CASHIER',
    label: 'Selasa, 27 Oktober 2026',
  };

  const promptC = formatHistoricalSalesForPrompt(mockRestricted, 'Kasir Budi');
  assert.ok(promptC.includes('KEBIJAKAN AKSES DATA LAPORAN HISTORIS'));
  assert.ok(promptC.includes('HANYA BOLEH diakses oleh OWNER dan MANAGER'));
});

test('4. End-to-End: buildAiSystemContext injects historical sales for query "kalo tgl 27 oktober kemarin?"', async () => {
  const user = { id: 1, name: 'Doni Aritonang', role: 'OWNER' };
  const query = 'kalo tgl 27 oktober kemarin?';

  const systemPrompt = await buildAiSystemContext(user, query);

  assert.ok(systemPrompt.includes('DATA PENJUALAN HISTORIS YANG DIMINTA (SELASA, 27 OKTOBER 2026)'));
  assert.ok(systemPrompt.includes('Periode Laporan: Selasa, 27 Oktober 2026'));
  assert.ok(systemPrompt.includes('Total Omset Penjualan:'));
  assert.ok(systemPrompt.includes('DILARANG KERAS berdalih "Komazi belum punya datanya"'));
});

test('5. Multi-turn Awareness: detects historical date from recent conversation history', async () => {
  const user = { id: 1, name: 'Doni Aritonang', role: 'OWNER' };
  const query = 'menu terlarisnya apa saja?';
  const history = [
    { role: 'user', content: 'kalo tgl 27 oktober kemarin?' },
    { role: 'assistant', content: 'Berikut penjualan tanggal 27 Oktober...' },
  ];

  const systemPrompt = await buildAiSystemContext(user, query, { history });

  assert.ok(systemPrompt.includes('DATA PENJUALAN HISTORIS YANG DIMINTA (SELASA, 27 OKTOBER 2026)'),
    'Should identify 27 Oktober from conversation history when user asks follow up');
});
