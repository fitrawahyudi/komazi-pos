import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNaturalDateQuery,
  formatIndonesianFullDate,
  formatIndonesianDate,
} from '../src/bot/utils/dateParser.js';

test('NaturalDateQuery: parse "kalo tgl 27 oktober kemarin?"', () => {
  // Reference date: Thursday, 29 October 2026
  const refDate = new Date(2026, 9, 29, 14, 0, 0);
  const res = parseNaturalDateQuery('kalo tgl 27 oktober kemarin?', refDate);

  assert.ok(res, 'Should parse natural question with date');
  assert.equal(res.isHistorical, true);
  assert.equal(res.isToday, false);
  assert.equal(res.periodType, 'SINGLE_DAY');
  assert.equal(res.startDate.getFullYear(), 2026);
  assert.equal(res.startDate.getMonth(), 9); // October is 9
  assert.equal(res.startDate.getDate(), 27);
  assert.equal(res.startDate.getHours(), 0);
  assert.equal(res.endDate.getHours(), 23);
  assert.equal(res.endDate.getMinutes(), 59);
  assert.equal(res.label, 'Selasa, 27 Oktober 2026');
});

test('NaturalDateQuery: parse "kemarin" and "kemarin lusa"', () => {
  const refDate = new Date(2026, 9, 29, 10, 0, 0); // Thursday 29 Oct

  const resKemarin = parseNaturalDateQuery('laporan penjualan kemarin gimana?', refDate);
  assert.ok(resKemarin);
  assert.equal(resKemarin.isHistorical, true);
  assert.equal(resKemarin.startDate.getDate(), 28);
  assert.ok(resKemarin.label.includes('Kemarin'));

  const resLusa = parseNaturalDateQuery('omset kemarin lusa berapa?', refDate);
  assert.ok(resLusa);
  assert.equal(resLusa.isHistorical, true);
  assert.equal(resLusa.startDate.getDate(), 27);
  assert.ok(resLusa.label.includes('Kemarin Lusa'));
});

test('NaturalDateQuery: parse "3 hari lalu"', () => {
  const refDate = new Date(2026, 9, 29, 10, 0, 0);
  const res = parseNaturalDateQuery('cek omset 3 hari lalu', refDate);
  assert.ok(res);
  assert.equal(res.isHistorical, true);
  assert.equal(res.startDate.getDate(), 26);
});

test('NaturalDateQuery: parse day of week "selasa kemarin"', () => {
  const refDate = new Date(2026, 9, 29, 10, 0, 0); // Thursday 29 Oct
  const res = parseNaturalDateQuery('penjualan hari selasa kemarin', refDate);
  assert.ok(res);
  assert.equal(res.isHistorical, true);
  assert.equal(res.startDate.getDate(), 27);
  assert.equal(res.label, 'Selasa, 27 Oktober 2026');
});

test('NaturalDateQuery: parse periods "minggu lalu", "minggu ini", "7 hari terakhir", "bulan ini", "bulan lalu"', () => {
  const refDate = new Date(2026, 9, 29, 10, 0, 0); // Thursday 29 Oct

  const resMingguLalu = parseNaturalDateQuery('laporan minggu lalu', refDate);
  assert.ok(resMingguLalu);
  assert.equal(resMingguLalu.isHistorical, true);
  assert.equal(resMingguLalu.periodType, 'LAST_WEEK');
  assert.equal(resMingguLalu.startDate.getDate(), 19); // Monday of last week
  assert.equal(resMingguLalu.endDate.getDate(), 25); // Sunday of last week

  const resMingguIni = parseNaturalDateQuery('rekap minggu ini', refDate);
  assert.ok(resMingguIni);
  assert.equal(resMingguIni.startDate.getDate(), 26); // Monday of this week
  assert.equal(resMingguIni.endDate.getDate(), 29);

  const res7Hari = parseNaturalDateQuery('rekap 7 hari terakhir', refDate);
  assert.ok(res7Hari);
  assert.equal(res7Hari.startDate.getDate(), 23);
  assert.equal(res7Hari.endDate.getDate(), 29);

  const resBulanIni = parseNaturalDateQuery('omset bulan ini', refDate);
  assert.ok(resBulanIni);
  assert.equal(resBulanIni.startDate.getDate(), 1);
  assert.equal(resBulanIni.endDate.getDate(), 29);

  const resBulanLalu = parseNaturalDateQuery('rekap bulan lalu', refDate);
  assert.ok(resBulanLalu);
  assert.equal(resBulanLalu.startDate.getMonth(), 8); // September is 8
  assert.equal(resBulanLalu.startDate.getDate(), 1);
  assert.equal(resBulanLalu.endDate.getDate(), 30);
});

test('NaturalDateQuery: parse date range "20 sampai 25 oktober 2026"', () => {
  const refDate = new Date(2026, 9, 29, 10, 0, 0);
  const res = parseNaturalDateQuery('penjualan dari tanggal 20 sampai 25 oktober 2026', refDate);
  assert.ok(res);
  assert.equal(res.startDate.getDate(), 20);
  assert.equal(res.endDate.getDate(), 25);
  assert.equal(res.label, '20 - 25 Oktober 2026');
});

test('NaturalDateQuery: non-date query returns null', () => {
  assert.equal(parseNaturalDateQuery('laporan penjualan gimana?'), null);
  assert.equal(parseNaturalDateQuery('menu kopi susu apa saja?'), null);
  assert.equal(parseNaturalDateQuery(''), null);
  assert.equal(parseNaturalDateQuery(null), null);
});
