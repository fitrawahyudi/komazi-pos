import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReportDateInput,
  parseSingleDateToken,
  formatIndonesianDate,
} from '../src/bot/utils/dateParser.js';
import { orderService } from '../src/services/order.service.js';
import { buildSalesReportCaption } from '../src/bot/utils/salesReportHelper.js';
import { customReportConversation } from '../src/bot/conversations/customReportConversation.js';

test('1. DateParser: Single date parsing (various Indonesian formats)', () => {
  // ISO: YYYY-MM-DD
  const resIso = parseReportDateInput('2026-10-15');
  assert.ok(resIso);
  assert.equal(resIso.startDate.getFullYear(), 2026);
  assert.equal(resIso.startDate.getMonth(), 9); // October is 9
  assert.equal(resIso.startDate.getDate(), 15);
  assert.equal(resIso.startDate.getHours(), 0);
  assert.equal(resIso.endDate.getHours(), 23);
  assert.equal(resIso.endDate.getMinutes(), 59);
  assert.equal(resIso.isSingleDay, true);
  assert.equal(resIso.label, '15 Oktober 2026');

  // Indonesian format: DD-MM-YYYY
  const resDmy = parseReportDateInput('15-10-2026');
  assert.ok(resDmy);
  assert.equal(resDmy.startDate.getDate(), 15);
  assert.equal(resDmy.startDate.getMonth(), 9);
  assert.equal(resDmy.startDate.getFullYear(), 2026);

  // Slash format: DD/MM/YYYY
  const resSlash = parseReportDateInput('20/05/2026');
  assert.ok(resSlash);
  assert.equal(resSlash.startDate.getDate(), 20);
  assert.equal(resSlash.startDate.getMonth(), 4); // May is 4
  assert.equal(resSlash.startDate.getFullYear(), 2026);

  // Dot format: DD.MM.YYYY
  const resDot = parseReportDateInput('01.01.2026');
  assert.ok(resDot);
  assert.equal(resDot.startDate.getDate(), 1);
  assert.equal(resDot.startDate.getMonth(), 0);

  // Short format without year: DD-MM
  const currentYear = new Date().getFullYear();
  const resShort = parseReportDateInput('17-08');
  assert.ok(resShort);
  assert.equal(resShort.startDate.getDate(), 17);
  assert.equal(resShort.startDate.getMonth(), 7); // August is 7
  assert.equal(resShort.startDate.getFullYear(), currentYear);

  // Indonesian month text: "15 Oktober 2026" and short "15 Okt 2026"
  const resText = parseReportDateInput('15 Oktober 2026');
  assert.ok(resText);
  assert.equal(resText.startDate.getDate(), 15);
  assert.equal(resText.startDate.getMonth(), 9);
  assert.equal(resText.startDate.getFullYear(), 2026);

  const resTextShort = parseReportDateInput('5 Des 2026');
  assert.ok(resTextShort);
  assert.equal(resTextShort.startDate.getDate(), 5);
  assert.equal(resTextShort.startDate.getMonth(), 11);
});

test('2. DateParser: Command prefix stripping (/laporan ...)', () => {
  const res = parseReportDateInput('/laporan 25-12-2026');
  assert.ok(res);
  assert.equal(res.startDate.getDate(), 25);
  assert.equal(res.startDate.getMonth(), 11);
  assert.equal(res.startDate.getFullYear(), 2026);

  const resRange = parseReportDateInput('/laporan 01-10-2026 s/d 07-10-2026');
  assert.ok(resRange);
  assert.equal(resRange.startDate.getDate(), 1);
  assert.equal(resRange.endDate.getDate(), 7);
});

test('3. DateParser: Date range parsing with various separators', () => {
  // s/d
  const r1 = parseReportDateInput('10-10-2026 s/d 15-10-2026');
  assert.ok(r1);
  assert.equal(r1.startDate.getDate(), 10);
  assert.equal(r1.endDate.getDate(), 15);
  assert.equal(r1.isSingleDay, false);
  assert.equal(r1.label, '10 Okt 2026 - 15 Okt 2026');

  // sampai
  const r2 = parseReportDateInput('01/10/2026 sampai 05/10/2026');
  assert.ok(r2);
  assert.equal(r2.startDate.getDate(), 1);
  assert.equal(r2.endDate.getDate(), 5);

  // dash separator: 10-10-2026 - 15-10-2026
  const r3 = parseReportDateInput('10-10-2026 - 15-10-2026');
  assert.ok(r3);
  assert.equal(r3.startDate.getDate(), 10);
  assert.equal(r3.endDate.getDate(), 15);

  // Text range: 10 - 15 Oktober 2026
  const r4 = parseReportDateInput('10 - 15 Oktober 2026');
  assert.ok(r4);
  assert.equal(r4.startDate.getDate(), 10);
  assert.equal(r4.endDate.getDate(), 15);
  assert.equal(r4.startDate.getMonth(), 9);
  assert.equal(r4.endDate.getMonth(), 9);

  // Auto-flip inverted date range (e.g. 15-10-2026 s/d 10-10-2026)
  const rInverted = parseReportDateInput('15-10-2026 s/d 10-10-2026');
  assert.ok(rInverted);
  assert.ok(rInverted.startDate <= rInverted.endDate);
  assert.equal(rInverted.startDate.getDate(), 10);
  assert.equal(rInverted.endDate.getDate(), 15);
});

test('4. DateParser: Invalid inputs return null', () => {
  assert.equal(parseReportDateInput(''), null);
  assert.equal(parseReportDateInput(null), null);
  assert.equal(parseReportDateInput('bukan tanggal'), null);
  assert.equal(parseReportDateInput('32-10-2026'), null); // Invalid day
  assert.equal(parseReportDateInput('29-02-2025'), null); // 2025 is not a leap year
  assert.equal(parseReportDateInput('15-13-2026'), null); // Invalid month 13
});

test('5. OrderService.getSummary: Supports custom date range', async () => {
  const customStart = new Date(2026, 9, 1, 0, 0, 0, 0);
  const customEnd = new Date(2026, 9, 15, 23, 59, 59, 999);

  // Call with (period = 'custom', customRange)
  const summary1 = await orderService.getSummary('custom', {
    startDate: customStart,
    endDate: customEnd,
    label: '1 Okt 2026 - 15 Okt 2026',
  });

  assert.equal(summary1.period, 'custom');
  assert.equal(summary1.periodLabel, '1 Okt 2026 - 15 Okt 2026');
  assert.ok(summary1.startDate);
  assert.ok(summary1.endDate);
  assert.equal(typeof summary1.totalRevenue, 'number');
  assert.equal(typeof summary1.totalTransactions, 'number');
  assert.ok(summary1.byMethod);
  assert.ok(Array.isArray(summary1.topProducts));

  // Call with object argument directly: getSummary({ startDate, endDate, label })
  const summary2 = await orderService.getSummary({
    startDate: customStart,
    endDate: customEnd,
    label: '15 Oktober 2026',
  });

  assert.equal(summary2.period, 'custom');
  assert.equal(summary2.periodLabel, '15 Oktober 2026');

  // Verify standard periods still work as before
  const todaySummary = await orderService.getSummary('today');
  assert.equal(todaySummary.period, 'today');
  assert.equal(todaySummary.periodLabel, 'Hari Ini');
});

test('6. SalesReportHelper: buildSalesReportCaption constructs clear message', () => {
  const dummySummary = {
    totalRevenue: 1500000,
    totalTransactions: 25,
    byMethod: { CASH: 500000, QRIS: 800000, TRANSFER: 200000 },
    topProducts: [
      { name: 'Kopi Susu Gula Aren', qty: 15 },
      { name: 'Croissant Coklat', qty: 10 },
    ],
  };

  const caption = buildSalesReportCaption(dummySummary, '15 Oktober 2026');
  assert.ok(caption.includes('LAPORAN PENJUALAN (15 OKTOBER 2026)'));
  assert.ok(caption.includes('1.500.000'));
  assert.ok(caption.includes('25 Pesanan'));
  assert.ok(caption.includes('Kopi Susu Gula Aren'));
  assert.ok(caption.includes('15 terjual'));
});

test('7. CustomReportConversation: is registered and callable', () => {
  assert.equal(typeof customReportConversation, 'function');
});
